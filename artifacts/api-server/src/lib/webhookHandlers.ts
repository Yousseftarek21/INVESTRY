import type Stripe from "stripe";
import { getStripeSync } from "./stripeClient";
import { stripeStorage } from "./stripeStorage";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "Received type: " + typeof payload + ". " +
          "This usually means express.json() parsed the body before reaching this handler. " +
          "FIX: Ensure webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    // sync.processWebhook verifies the signature (tolerantly, if no webhook
    // secret is configured on the connection) and mirrors the raw stripe.*
    // tables. We reuse the same already-trusted payload below to react to
    // subscription changes for our own `users` table.
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    const event = JSON.parse(payload.toString()) as Stripe.Event;
    await WebhookHandlers.syncEntitlement(event);
  }

  /**
   * The stripe-replit-sync engine only mirrors raw Stripe tables — it has no
   * knowledge of our app's `users` table. This is the sole place that grants
   * or revokes plan entitlement based on the authoritative subscription
   * status coming straight from Stripe's webhook payload.
   */
  private static async syncEntitlement(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await stripeStorage.syncSubscriptionFromStripe(subscription);
        break;
      }
      default:
        break;
    }
  }
}
