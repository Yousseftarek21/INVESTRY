---
name: Stripe entitlement sync via stripe-replit-sync
description: stripe-replit-sync mirrors raw stripe.* tables but never touches app-owned tables (e.g. users.plan) — you must wire that yourself in the webhook handler.
---

`stripe-replit-sync`'s `processWebhook`/`processEvent` only upserts its own `stripe.*` schema (customers, subscriptions, prices, invoices, etc). It has no knowledge of app-specific tables. If your app grants entitlement based on a `users.plan` / `users.stripeSubscriptionId` column, nothing sets those fields unless you add explicit logic in the webhook handler that reacts to `customer.subscription.created/updated/deleted` and writes to your own table.

**Why:** Silent gap — checkout completes, Stripe webhooks return 200, `stripe.subscriptions` rows exist, but the app's own subscription-status endpoint keeps reporting "free" forever because the linking column was never populated. Looks like a webhook delivery problem but isn't.

**How to apply:** After calling `sync.processWebhook(payload, signature)` (which tolerantly verifies signature and syncs raw tables), separately parse the same payload as a `Stripe.Event` and run your own handler for subscription lifecycle events — resolve the app user by `stripeCustomerId`, look up plan metadata from the synced `stripe.prices` table by price ID, and update your own user row's plan/subscriptionId. Only treat `active`/`trialing` statuses as entitled; anything else should reset to free.

Also: don't require `webhook_secret` to be present and throw if missing — the underlying sync engine tolerates a missing/empty webhook secret (some connector setups don't populate it), so gating your own logic on its presence causes false failures when the sync itself would have succeeded.
