import { Router, type IRouter } from "express";
import { clerkMiddleware, clerkClient, getAuth } from "@clerk/express";
import { stripeStorage } from "../lib/stripeStorage";
import { stripeService } from "../lib/stripeService";

const router: IRouter = Router();

// Launch Access mode: grant everyone a plan for free, without touching
// Stripe or the checkout/webhook wiring. This is the single source of
// truth for "Launch Access" — the client never derives entitlement any
// other way, it always reads it from this endpoint.
//
// Two independent free-access paths:
//   1. Time-boxed for everyone: LAUNCH_ACCESS_UNTIL is an ISO date/time.
//      While `now < LAUNCH_ACCESS_UNTIL`, every signed-in user gets Pro
//      for free. Once that date passes, this path stops applying on its
//      own — no code change needed, real Stripe subscriptions take back
//      over automatically.
//   2. Permanent allowlist: PERMANENT_FREE_EMAILS is a comma-separated
//      list of emails (developers/team) that always get Pro for free,
//      regardless of the launch window or date.
// Set FREE_ACCESS_PLAN=pro as a manual override/kill-switch if you ever
// want to force free access for everyone regardless of the two rules
// above (e.g. to reinstate launch access early).
const FREE_ACCESS_PLAN = (() => {
  const raw = (process.env.FREE_ACCESS_PLAN ?? "off").trim().toLowerCase();
  return raw === "pro" ? raw : null;
})();

const LAUNCH_ACCESS_UNTIL = (() => {
  const raw = process.env.LAUNCH_ACCESS_UNTIL?.trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
})();

const PERMANENT_FREE_EMAILS = (process.env.PERMANENT_FREE_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isLaunchWindowActive(): boolean {
  return LAUNCH_ACCESS_UNTIL !== null && new Date() < LAUNCH_ACCESS_UNTIL;
}

async function isPermanentFreeUser(userId: string): Promise<boolean> {
  if (PERMANENT_FREE_EMAILS.length === 0) return false;
  const clerkUser = await clerkClient.users.getUser(userId);
  const email = clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase();
  return !!email && PERMANENT_FREE_EMAILS.includes(email);
}

// Require a valid Clerk session for all subscription/checkout routes
router.use("/stripe", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/stripe/prices — active price catalog, keyed by plan + billing period
router.get("/stripe/prices", async (req, res) => {
  try {
    const prices = await stripeStorage.getPriceCatalog();
    res.json({
      prices: prices.map((p) => ({
        priceId: p.id,
        plan: p.plan_key,
        billingPeriod: p.billing_period,
        unitAmount: p.unit_amount,
        currency: p.currency,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "GET /stripe/prices failed");
    res.status(500).json({ error: "Failed to fetch price catalog" });
  }
});

// GET /api/subscription — current plan for the authenticated user
router.get("/subscription", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  if (FREE_ACCESS_PLAN) {
    // Manual kill-switch override is on — report everyone as subscribed
    // without touching Stripe or the users table. `launchAccess: true` is
    // the explicit flag the client uses to swap purchase UI for the
    // "Included During Launch" badge; `status: "promo"` is kept for
    // backward compatibility.
    res.json({ plan: FREE_ACCESS_PLAN, billingPeriod: "monthly", status: "promo", launchAccess: true });
    return;
  }

  try {
    if (isLaunchWindowActive() || (await isPermanentFreeUser(userId))) {
      res.json({ plan: "pro", billingPeriod: "monthly", status: "promo", launchAccess: true });
      return;
    }

    const user = await stripeStorage.getUser(userId);
    if (!user || !user.stripeSubscriptionId) {
      res.json({ plan: "free", billingPeriod: "monthly", status: null, launchAccess: false });
      return;
    }

    const subscription = await stripeStorage.getSubscription(user.stripeSubscriptionId);
    res.json({
      plan: user.plan,
      billingPeriod: user.billingPeriod,
      status: (subscription as { status?: string } | null)?.status ?? null,
      launchAccess: false,
    });
  } catch (err) {
    req.log.error({ err }, "GET /subscription failed");
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

// POST /api/stripe/checkout — create a Checkout Session for a plan
router.post("/stripe/checkout", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { priceId, plan, billingPeriod, successUrl, cancelUrl } = req.body as {
    priceId?: string;
    plan?: string;
    billingPeriod?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!priceId || !successUrl || !cancelUrl) {
    res.status(400).json({ error: "priceId, successUrl and cancelUrl are required" });
    return;
  }

  try {
    let user = await stripeStorage.getUser(userId);

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
      user = await stripeStorage.upsertUser(userId, email);
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(user.email, userId);
      await stripeStorage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      successUrl,
      cancelUrl,
    );

    // Remember intended plan so the webhook (which only has price/customer IDs)
    // can be cross-checked; final source of truth is still the Stripe subscription status.
    if (plan) {
      await stripeStorage.updateUserStripeInfo(userId, {
        plan,
        billingPeriod: billingPeriod ?? "monthly",
      });
    }

    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "POST /stripe/checkout failed");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// POST /api/stripe/portal — Stripe customer billing portal (manage/cancel plan)
router.post("/stripe/portal", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { returnUrl } = req.body as { returnUrl?: string };
  if (!returnUrl) { res.status(400).json({ error: "returnUrl is required" }); return; }

  try {
    const user = await stripeStorage.getUser(userId);
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: "No Stripe customer on file" });
      return;
    }

    const session = await stripeService.createCustomerPortalSession(
      user.stripeCustomerId,
      returnUrl,
    );
    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "POST /stripe/portal failed");
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

export default router;
