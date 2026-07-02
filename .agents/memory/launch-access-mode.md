---
name: Launch Access mode (Stripe disabled)
description: How INVESTRY grants free Pro+ access during launch, and a testing gotcha with the dev-unlock bypass.
---

## What it is
Premium status is fully centralized through `SubscriptionContext` on the client and `GET /api/subscription` on the server. A single server-side env var (`FREE_ACCESS_PLAN`, set to `pro`/`pro_plus`) makes the endpoint return that plan plus `launchAccess: true` for every authenticated user, bypassing Stripe entirely. See `replit.md` "Architecture decisions" for the full breakdown of files involved.

## Testing gotcha: DEV_UNLOCKED masks the real flow
`SubscriptionContext.tsx` has a `DEV_UNLOCKED = __DEV__` bypass that force-sets `plan = 'pro_plus'` locally and **skips the backend fetch entirely** whenever running in a dev build (which includes the Expo web preview used for e2e testing here).

**Why it matters:** this means `launchAccess` stays `false` and the real "Included During Launch" UI never renders in the normal dev preview, even though the backend flag is correctly set — because the client never even calls `/api/subscription` to learn about it.

**How to apply:** to actually verify launch-access UI (badges, banners, disabled purchase flows) end-to-end in this dev environment, temporarily set `DEV_UNLOCKED = false`, restart the mobile workflow, run the test, then revert and restart again. Don't conclude the feature is broken just because it doesn't show up in a normal dev-mode screenshot/test.

## Testing gotcha: Clerk e2e sign-in requires an explicit flag
When calling `runTest()` with a `[Clerk Auth] Sign in as ...` step, you must also pass `testClerkAuth: true` in the `runTest()` call itself. Without it, the test falls back to trying to interact with Clerk's real sign-in UI (which fails since there's no known password) instead of signing in programmatically.

## Signed-out users still see a paywall, and that's a UX bug not a logic bug
`launchAccess`/`plan` are derived per-authenticated-user (`GET /api/subscription` requires a Clerk session), so a signed-out visitor always has `plan='free'`, `launchAccess=false` — regardless of `FREE_ACCESS_PLAN`. `(tabs)/_layout.tsx` intentionally skips the sign-in redirect on web (`if (!isSignedIn && !IS_WEB) return <Redirect .../>`), so anonymous users can reach premium screens directly in the web/canvas preview.

**Why it matters:** `PremiumGate` originally couldn't distinguish "needs to pay" from "needs to sign in (then gets it free)", so anonymous users saw a confusing "Upgrade to PRO" paywall during Launch Access.

**How to apply:** gate components should check `useAuth().isSignedIn` from `@clerk/expo` first — if signed out, show a "Sign In" CTA (routes to `/(auth)/welcome`) instead of the pay prompt; only fall through to the real paywall once signed in and still lacking access.
