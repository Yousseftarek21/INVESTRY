import { Router, type IRouter } from "express";
import { clerkMiddleware, clerkClient, getAuth } from "@clerk/express";
import { stripeStorage } from "../lib/stripeStorage";
import { stripeService } from "../lib/stripeService";

const router: IRouter = Router();

// Launch Access mode: grant everyone a plan for free, without touching
// Stripe or the checkout/webhook wiring. Set FREE_ACCESS_PLAN=pro or
// pro_plus to turn this on; unset it (or set to "off") once you're ready to
// start charging — real Stripe subscriptions immediately take back over
// with no code changes on either the server or the client. This is the
// single source of truth for "Launch Access" — the client never derives
// entitlement any other way, it always reads it from this endpoint.
const FREE_ACCESS_PLAN = (() => {
  const raw = (process.env.FREE_ACCESS_PLAN ?? "off").trim().toLowerCase();
  return raw === "pro" || raw === "pro_plus" ? raw : null;
})();

// Require a valid Clerk session for all subscription/checkout routes
router.use(clerkMiddleware(), (req, res, next) => {
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
    // Launch Access is on — report everyone as subscribed without touching
    // Stripe or the users table. `launchAccess: true` is the explicit flag
    // the client uses to swap purchase UI for the "Included During Launch"
    // badge; `status: "promo"` is kept for backward compatibility.
    res.json({ plan: FREE_ACCESS_PLAN, billingPeriod: "monthly", status: "promo", launchAccess: true });
    return;
  }

  try {
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
