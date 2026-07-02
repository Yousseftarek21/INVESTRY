---
name: Stripe connector settings field names
description: Correct field names for reading Stripe credentials from the Replit connector API response.
---

## Rule
When fetching Stripe credentials from the connector API (`GET /api/v2/connection?include_secrets=true&connector_names=stripe`), the settings object uses `settings.secret` for the API key and `settings.publishable` for the publishable key — NOT `secret_key`/`publishable_key` as generic connector-skill templates may suggest. There is no separate `webhook_secret` field; managed webhooks (via `stripe-replit-sync`'s `findOrCreateManagedWebhook`) are provisioned dynamically instead.

**Why:** Code written against the generic template checked `settings.secret_key`, which is always undefined for the Stripe connector, causing a false "Stripe integration not connected" error even when the connection was healthy. Only inspecting the raw JSON response (`Object.keys(item.settings)`) revealed the actual field names.

## How to apply
- Any custom `getStripeCredentials()` helper should read `settings.secret` (and `settings.publishable` if needed).
- If a Stripe-related script/service throws "not connected or missing secret key" despite `listConnections`/health checks showing a healthy connection, suspect a field-name mismatch first — dump `Object.keys(item.settings)` to confirm before assuming an auth/propagation issue.
