---
name: Subscription system
description: Mock RevenueCat-compatible subscription context, paywall screen placement, and gating architecture.
---

## Rule
The paywall component lives in `components/SubscriptionScreen.tsx`, NOT in `app/`. Expo Router picks up all `.tsx` files in `app/` as routes and requires a default export — modal components that are rendered from the root layout must live in `components/`.

**Why:** Moving it to `app/subscription.tsx` caused "missing default export" route errors at runtime. The file `app/subscription.tsx` exists only as a redirect stub.

## How to apply
- Modal/overlay components rendered from `_layout.tsx` → put in `components/`
- The paywall is triggered via `_registerPaywallCallback` which is called in `AppWithPaywall` inside `_layout.tsx`
- `useSubscription().showPaywall(requiredPlan?)` is the public API to open the paywall from anywhere

## RevenueCat swap
When connecting RevenueCat later:
1. Replace `context/SubscriptionContext.tsx` with the real RevenueCat version (hook shape is identical)
2. Set `EXPO_PUBLIC_REVENUECAT_*` env vars
3. Remove `@invstry_subscription` from AsyncStorage
4. `react-native-purchases` is already installed in `artifacts/mobile`

## Pricing
- Pro: $4.99/mo | $39.99/yr (save 33%)
- Pro+: $9.99/mo | $79.99/yr (save 33%)

## Gating
- Financial Tools → always free
- Market Intelligence → Pro gate (`requiredPlan="pro"`)
- Portfolio Analytics → Pro gate (`requiredPlan="pro"`)
- Storage key: `@invstry_subscription`
