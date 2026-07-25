import { Router, type IRouter } from "express";
import express from "express";
import Stripe from "stripe";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

// Mounted directly in app.ts, BEFORE express.json() — Stripe's signature
// verification needs the exact raw request body, not the parsed JSON the
// rest of the API uses. This route is the only place on this backend that
// talks to Stripe at all: the website owns Checkout/the billing portal, and
// this just listens for the result and syncs it into our own DB, keyed by
// the Clerk user ID the website's Checkout Session was created with.
const router: IRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

function billingPeriodFromPrice(price: Stripe.Price | undefined): "monthly" | "annual" {
  return price?.recurring?.interval === "year" ? "annual" : "monthly";
}

router.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    logger.warn("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured");
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"] as string,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    switch (event.type) {
      // The website's Checkout Session must be created with
      // `subscription_data.metadata.clerkUserId` (or `metadata.clerkUserId`
      // for the session itself) set to the signed-in Clerk user's ID — this
      // is the only link between "who paid on the website" and "which app
      // account to unlock."
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const clerkUserId = sub.metadata?.clerkUserId;
        if (!clerkUserId) {
          logger.warn({ subscriptionId: sub.id }, "Stripe subscription has no clerkUserId metadata — cannot sync");
          break;
        }
        await db.update(usersTable).set({
          plan: sub.status === "active" || sub.status === "trialing" ? "pro" : "free",
          billingPeriod: billingPeriodFromPrice(sub.items.data[0]?.price),
          stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          stripeSubscriptionId: sub.id,
        }).where(eq(usersTable.id, clerkUserId));
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const clerkUserId = sub.metadata?.clerkUserId;
        if (!clerkUserId) break;
        await db.update(usersTable).set({ plan: "free" }).where(eq(usersTable.id, clerkUserId));
        break;
      }
      default:
        break; // Ignore event types we don't act on
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Failed to process Stripe webhook");
    res.status(500).json({ error: "Webhook processing failed" });
    return;
  }

  res.json({ received: true });
});

export default router;
