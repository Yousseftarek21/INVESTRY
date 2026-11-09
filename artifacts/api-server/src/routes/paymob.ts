import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { EGP_PRICES } from "../lib/stripePrices";
import { createPaymobCheckout, paymobBuyer, paymobConfigured, PRO_MONTHS, verifyPaymobHmac } from "../lib/paymob";
import { logger } from "../lib/logger";

// Website checkout through Paymob (see lib/paymob.ts). The app never calls
// these; iPhone purchases stay on Apple In-App Purchase.
const router: IRouter = Router();

// GET /api/payments/config — which checkout the website uses and its EGP
// prices. PAYMENTS_PROVIDER picks one explicitly; otherwise Paymob when it's
// configured, else Stripe. Public, no sign-in needed.
router.get("/payments/config", (_req, res) => {
  const wanted = process.env.PAYMENTS_PROVIDER;
  const stripeReady = !!process.env.STRIPE_SECRET_KEY;
  // An explicit choice is never swapped for the other provider: a half-set-up
  // Paymob shows "not available" rather than quietly charging through Stripe.
  const provider = wanted === "stripe" ? (stripeReady ? "stripe" : null)
    : wanted === "paymob" ? (paymobConfigured() ? "paymob" : null)
    : paymobConfigured() ? "paymob" : stripeReady ? "stripe" : null;
  res.json({
    provider,
    currency: "EGP",
    monthly: EGP_PRICES.monthly,
    annual: EGP_PRICES.annual,
    // Stripe plans auto-renew; Paymob sells one-time 1-month / 1-year passes.
    renews: provider === "stripe",
  });
});

router.use("/paymob/create-checkout", clerkMiddleware(), (req, res, next) => {
  if (!getAuth(req).userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// POST /api/paymob/create-checkout — { billingPeriod: 'monthly' | 'annual', email?, firstName?, lastName? }
router.post("/paymob/create-checkout", async (req, res) => {
  const { userId } = getAuth(req);
  if (!paymobConfigured()) { res.status(503).json({ error: "Payments are not available yet" }); return; }
  const period = req.body?.billingPeriod === "annual" ? "annual" : "monthly";
  try {
    const url = await createPaymobCheckout({
      userId: userId!, period,
      email: typeof req.body?.email === "string" ? req.body.email : undefined,
      firstName: typeof req.body?.firstName === "string" ? req.body.firstName : undefined,
      lastName: typeof req.body?.lastName === "string" ? req.body.lastName : undefined,
      websiteUrl: process.env.WEBSITE_URL ?? "https://investry.app",
      apiUrl: process.env.API_PUBLIC_URL ?? "https://api.investry.app",
    });
    res.json({ url });
  } catch (err) {
    logger.error({ err }, "POST /paymob/create-checkout failed");
    res.status(500).json({ error: "Could not start checkout" });
  }
});

// POST /api/paymob/webhook — Paymob's transaction-processed callback.
// Signed with our HMAC secret; a successful payment extends Pro by the
// plan's months from today or from the current expiry, whichever is later.
// Each Paymob transaction is applied once, however many times it's resent.
router.post("/paymob/webhook", async (req, res) => {
  const obj = (req.body?.obj ?? {}) as Record<string, unknown>;
  const hmac = typeof req.query.hmac === "string" ? req.query.hmac : undefined;
  if (!verifyPaymobHmac(obj, hmac)) {
    logger.warn({ txn: obj.id }, "Paymob webhook with a bad or missing HMAC — ignored");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }
  // Acknowledge anything that isn't a completed payment (pending, failed, refunds, voids).
  if (req.body?.type !== "TRANSACTION" || obj.success !== true || obj.pending === true || obj.is_refunded === true || obj.is_voided === true) {
    res.json({ ok: true });
    return;
  }
  const buyer = paymobBuyer(obj);
  if (!buyer) {
    logger.error({ txn: obj.id }, "Paymob payment without a buyer reference — cannot unlock Pro");
    res.json({ ok: true });
    return;
  }
  try {
    await db.transaction(async (tx) => {
      const claimed = await tx.execute(sql`
        INSERT INTO "paymob_payments" ("id", "user_id", "period", "amount_cents")
        VALUES (${String(obj.id)}, ${buyer.userId}, ${buyer.period}, ${Number(obj.amount_cents) || 0})
        ON CONFLICT ("id") DO NOTHING RETURNING "id"
      `);
      if ((claimed.rows?.length ?? 0) === 0) return; // already applied
      await tx.insert(usersTable).values({ id: buyer.userId }).onConflictDoNothing();
      const [user] = await tx.select({ until: usersTable.proCreditExpiresAt }).from(usersTable).where(eq(usersTable.id, buyer.userId));
      const from = user?.until && user.until.getTime() > Date.now() ? new Date(user.until) : new Date();
      from.setMonth(from.getMonth() + PRO_MONTHS[buyer.period]);
      await tx.update(usersTable).set({ proCreditExpiresAt: from, updatedAt: new Date() }).where(eq(usersTable.id, buyer.userId));
      logger.info({ userId: buyer.userId, period: buyer.period, until: from.toISOString() }, "Paymob payment — Pro extended");
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, txn: obj.id }, "Paymob webhook failed");
    res.status(500).json({ error: "Webhook failed" }); // Paymob retries
  }
});

export default router;
