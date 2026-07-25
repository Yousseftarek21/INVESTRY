import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getStripe } from "../lib/stripe";
import { logger } from "../lib/logger";

// The website's side of the subscription flow — the mobile app never hits
// either of these. Both require the caller to already be signed in with
// Clerk; the website calls them with the same session token it gets from
// Clerk's own JS SDK.
const router: IRouter = Router();

router.use(["/stripe/create-checkout-session", "/stripe/create-portal-session"], clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

const PRICE_IDS: Record<"monthly" | "annual", string | undefined> = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
  annual: process.env.STRIPE_PRICE_ID_ANNUAL,
};

// POST /api/stripe/create-checkout-session — { billingPeriod: 'monthly' | 'annual' }
router.post("/stripe/create-checkout-session", async (req, res) => {
  const { userId } = getAuth(req);
  const stripe = getStripe();
  const billingPeriod = req.body?.billingPeriod === "annual" ? "annual" : "monthly";
  const priceId = PRICE_IDS[billingPeriod];

  if (!stripe || !priceId) {
    logger.warn({ billingPeriod }, "Checkout requested but Stripe is not fully configured");
    res.status(503).json({ error: "Subscriptions are not available yet" });
    return;
  }

  try {
    // Ensure a row exists, then reuse an existing Stripe customer if this
    // user already has one (e.g. from a prior cancelled subscription)
    // rather than creating a duplicate customer every time they check out.
    await db.insert(usersTable).values({ id: userId! }).onConflictDoNothing();
    const [existing] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(eq(usersTable.id, userId!));

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: existing?.stripeCustomerId ?? undefined,
      customer_email: existing?.stripeCustomerId ? undefined : req.body?.email,
      line_items: [{ price: priceId, quantity: 1 }],
      // This is the only link the webhook has back to the app account —
      // set on the subscription itself so it's present on every
      // subscription.* event, not just the initial checkout.
      subscription_data: { metadata: { clerkUserId: userId! } },
      success_url: `${process.env.WEBSITE_URL ?? "https://investry.app"}/?checkout=success`,
      cancel_url: `${process.env.WEBSITE_URL ?? "https://investry.app"}/?checkout=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "POST /stripe/create-checkout-session failed");
    res.status(500).json({ error: "Could not start checkout" });
  }
});

// POST /api/stripe/create-portal-session — for existing subscribers only
router.post("/stripe/create-portal-session", async (req, res) => {
  const { userId } = getAuth(req);
  const stripe = getStripe();

  if (!stripe) {
    res.status(503).json({ error: "Billing portal is not available yet" });
    return;
  }

  try {
    const [user] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(eq(usersTable.id, userId!));

    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: "No subscription found for this account" });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: process.env.WEBSITE_URL ?? "https://investry.app",
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "POST /stripe/create-portal-session failed");
    res.status(500).json({ error: "Could not open billing portal" });
  }
});

export default router;
