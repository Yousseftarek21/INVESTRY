# Threat Model

## Project Overview

INVESTRY is an Expo/React Native investment-tracking app with an Express API server and PostgreSQL backing store. Users authenticate with Clerk, manage personal holdings, and view market data for metals, FX, and EGX stocks. The mobile client also keeps local state in AsyncStorage for offline-first behavior and premium entitlements are currently enforced in client code.

The currently deployed Replit app is `private`, so public internet exposure to deployment endpoints is reduced by platform controls. This threat model still treats the mobile app, local device storage, authenticated API calls, and backend data isolation as production-relevant.

## Assets

- **User holdings and portfolio history** — gold, silver, stock, and real-estate positions are sensitive financial data. Unauthorized disclosure exposes a user’s investment behavior and net worth.
- **User sessions and identity** — Clerk session tokens and authenticated user IDs control access to holdings and account surfaces. Compromise enables impersonation.
- **Subscription entitlements** — plan status controls access to premium analytics and unlimited holdings. Forged entitlements create direct revenue loss and unauthorized feature access.
- **Application secrets** — `DATABASE_URL`, `CLERK_SECRET_KEY`, and `COMMODITY_API_KEY` allow backend data access, identity operations, and third-party API usage.
- **Backend holdings records** — database rows must remain isolated per authenticated user and resist cross-account tampering.

## Trust Boundaries

- **Mobile device / local storage boundary** — AsyncStorage and SecureStore persist data on the client. The app must prevent one signed-in user from seeing or inheriting another user’s cached data on a shared device.
- **Mobile app / API boundary** — the client is untrusted. The API must derive identity from validated Clerk credentials and must not trust client-supplied ownership fields or entitlements.
- **API / database boundary** — the Express server has direct write access to holdings data. Authorization bugs here can become cross-account data disclosure or tampering.
- **API / Clerk boundary** — Clerk authentication and the Clerk proxy handle identity-related traffic. Proxy behavior must not weaken origin or token trust.
- **API / third-party market-data boundary** — market routes call external providers and must bound latency, validate responses, and avoid exposing secrets.
- **Production / dev-only boundary** — `artifacts/mockup-sandbox/` is dev-only and should be ignored unless production reachability is demonstrated. Build scripts and local Expo helpers are lower priority unless they affect shipped runtime behavior.

## Scan Anchors

- Production mobile entry point: `artifacts/mobile/app/_layout.tsx`
- Highest-risk mobile state paths: `artifacts/mobile/context/HoldingsContext.tsx`, `artifacts/mobile/context/SubscriptionContext.tsx`, `artifacts/mobile/utils/api.ts`
- Production backend entry points: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/holdings.ts`, `artifacts/api-server/src/routes/markets.ts`, `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts`
- Database ownership model: `lib/db/src/schema/holdings.ts`
- Usually ignore as dev-only: `artifacts/mockup-sandbox/`, Expo build helper scripts unless they influence runtime auth or API exposure

## Threat Categories

### Spoofing

All protected holdings operations must require a valid Clerk-authenticated session, and the backend must derive the acting user from verified auth state rather than client-controlled fields. Session tokens stored on device or web must not be exposed across users or origins.

### Tampering

The client can send arbitrary holding IDs, types, and payloads, so the API must enforce record ownership on create, update, and delete paths. Premium-plan decisions must not rely only on mutable client-side storage because users can alter app state locally.

### Information Disclosure

Cached holdings and account-linked state on a shared device must not be shown to a different signed-in user before the app re-establishes identity and ownership. API responses and logs must avoid leaking secrets, raw tokens, or cross-user holdings data.

### Denial of Service

Market-data endpoints fan out to third-party services and must keep strict request timeouts and bounded work per request. Because the current deployment is private, unauthenticated internet-scale abuse is less relevant than protecting backend stability for legitimate app traffic.

### Elevation of Privilege

A regular user must not be able to modify another user’s holdings by supplying colliding identifiers or bypass paid feature gates by forging local entitlement state. Ownership and entitlement enforcement must be authoritative on the server or another trusted control plane, not only in the mobile client.
