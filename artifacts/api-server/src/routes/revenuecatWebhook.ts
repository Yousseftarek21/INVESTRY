import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

// RevenueCat → this backend, syncing native IAP entitlement into the same
// `usersTable.plan` field the website's Stripe webhook already writes to —
// one source of truth (`/api/subscription`) regardless of which payment
// rail a given user came through. `app_user_id` is always the Clerk user
// id: the app calls Purchases.logIn(clerkUserId) right after sign-in (see
// mobile/utils/revenuecat.ts), so RevenueCat's own identity always matches
// ours — no separate mapping table needed.
//
// Auth: RevenueCat doesn't sign webhook payloads the way Stripe does: it
// just echoes back a fixed Authorization header value you configure in its
// dashboard (Project Settings > Integrations > Webhooks). REVENUECAT_WEBHOOK_SECRET
// here must match that exact value.
const router: IRouter = Router();

function billingPeriodFromProductId(productId: string | undefined): "monthly" | "annual" {
  return productId?.includes("annual") ? "annual" : "monthly";
}

router.post("/revenuecat/webhook", async (req, res) => {
  if (!process.env.REVENUECAT_WEBHOOK_SECRET) {
    logger.warn("RevenueCat webhook received but REVENUECAT_WEBHOOK_SECRET is not configured");
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }
  if (req.headers["authorization"] !== `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`) {
    logger.warn("RevenueCat webhook received with missing/invalid auth header");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const event = req.body?.event as
      | { type?: string; app_user_id?: string; product_id?: string }
      | undefined;
    const clerkUserId = event?.app_user_id;
    if (!clerkUserId || !event?.type) {
      res.json({ received: true });
      return;
    }

    switch (event.type) {
      // Entitlement is active (or just renewed/reinstated) — upsert, not
      // update: RevenueCat may report a purchase before this user has ever
      // hit our own API, same reasoning as the Stripe webhook.
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "PRODUCT_CHANGE": {
        const fields = { plan: "pro" as const, billingPeriod: billingPeriodFromProductId(event.product_id) };
        await db.insert(usersTable).values({ id: clerkUserId, ...fields })
          .onConflictDoUpdate({ target: usersTable.id, set: fields });
        break;
      }
      // Only a real expiration downgrades. CANCELLATION just means
      // auto-renew was turned off — the user keeps access until the period
      // they already paid for actually runs out (that's the EXPIRATION
      // event). BILLING_ISSUE is Apple's own retry/grace-period window and
      // deliberately doesn't downgrade either.
      case "EXPIRATION": {
        await db.insert(usersTable).values({ id: clerkUserId, plan: "free" })
          .onConflictDoUpdate({ target: usersTable.id, set: { plan: "free" } });
        break;
      }
      default:
        break; // Ignore event types we don't act on
    }
  } catch (err) {
    logger.error({ err }, "Failed to process RevenueCat webhook");
    res.status(500).json({ error: "Webhook processing failed" });
    return;
  }

  res.json({ received: true });
});

export default router;
