---
name: Clerk auth setup
description: Clerk auth decisions, package versions, and route structure for INVSTRY (Expo SDK 54)
---

## Setup
- Clerk app ID: `app_3FvAZ7BGRrpXHF8Wtb0n4w6PiqT` (provisioned via `setupClerkWhitelabelAuth()`)
- Env vars set: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- Dev script exposes key as: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY`
- Build script injects: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CLERK_PROXY_URL`

## Packages installed (mobile)
- `@clerk/expo` — main SDK; uses Core v3 API (`useSignIn`, `useSignUp`, `useSSO`, `useClerk`)
- `expo-auth-session@~7.0.10` — for OAuth redirect URI via `AuthSession.makeRedirectUri()`
- `expo-secure-store@~15.0.8` — Clerk token cache storage
- `expo-crypto@~15.0.8` — required by Clerk internally
- `expo-web-browser@~15.0.10` — already installed; needed for `WebBrowser.maybeCompleteAuthSession()`

## Packages installed (api-server)
- `http-proxy-middleware`, `@clerk/express`, `@clerk/shared`

## Route structure
```
app/
  _layout.tsx        → ClerkProvider + ClerkLoaded wraps everything
  (auth)/
    _layout.tsx      → redirects signed-in users to /(tabs)
    welcome.tsx      → 3-slide onboarding + welcome (Get Started / Sign In)
    sign-in.tsx      → email+password + Google OAuth
    sign-up.tsx      → email+password + Google OAuth + email verification
  (tabs)/
    _layout.tsx      → useAuth guard → redirects unauthenticated to /(auth)/welcome
    settings.tsx     → Sign Out button using useClerk().signOut()
```

## Key patterns
- Custom auth UI required (Clerk native components incompatible with Expo Go)
- `useSignIn().signIn.password()` → sign in; `.finalize()` → set session
- `useSignUp().signUp.password()` → sign up; `.verifications.sendEmailCode()` + `.verifyEmailCode()` → verify; `.finalize()` → set session
- `useSSO().startSSOFlow({ strategy: 'oauth_google', redirectUrl: AuthSession.makeRedirectUri() })` for Google
- `WebBrowser.maybeCompleteAuthSession()` must be called at module level in OAuth screens
- Route type casts: new `(auth)` routes need `as any` until expo-router regenerates typed routes

**Why:** Expo Router generates typed routes from the filesystem; new route groups need `as any` casts until types regenerate at build time.

## API server proxy
- `CLERK_PROXY_PATH = /api/__clerk` (dev: no-op; production: proxies to Clerk FAPI)
- `clerkMiddleware` wired in `app.ts` before routes; uses `publishableKeyFromHost` + `getClerkProxyHost`

## Firebase migration note
- User confirmed Clerk first, Firebase later. The `tokenCache` from `@clerk/expo/token-cache` uses SecureStore — compatible with future migration.
