# INVESTRY — Egypt Investment Tracker

Egypt's first investment tracking mobile app (Expo / React Native). Slogan: "Know Your Wealth". Tracks gold & silver prices in EGP, EGX stocks, and real estate holdings. Shows a live portfolio overview with total value, allocation breakdown, and gain/loss vs. purchase cost.

## Run & Operate

- Mobile workflow: `artifacts/mobile: expo` — starts the Expo dev server
- API Server workflow: `artifacts/api-server: API Server` — Express backend (not used by mobile)
- `pnpm --filter @workspace/mobile run typecheck` — typecheck the Expo app
- Scan the QR code from the URL bar menu to test on a real device via Expo Go

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Expo SDK 54, React Native 0.81, Expo Router 6
- State: AsyncStorage (holdings), React Query (prices)
- Icons: @expo/vector-icons (Feather + SF Symbols on iOS)
- Fonts: Inter (400/500/600/700) via @expo-google-fonts/inter
- Haptics: expo-haptics

## Where things live

- `artifacts/mobile/` — the Expo app
- `artifacts/mobile/app/(tabs)/` — tab screens (index, markets, holdings, settings)
- `artifacts/mobile/app/add-investment.tsx` — modal for adding new holdings; also hosts the Investment/Cash chooser (`screenMode: 'choose' | 'investment' | 'cash'`) and the Cash form
- `artifacts/mobile/app/cash-accounts.tsx` — modal to view, add, edit, and delete cash accounts (bank, cash at home, foreign currency)
- `artifacts/mobile/constants/colors.ts` — light + dark color themes
- `artifacts/mobile/context/HoldingsContext.tsx` — AsyncStorage CRUD for user's holdings
- `artifacts/mobile/context/CashContext.tsx` — mirrors `HoldingsContext.tsx` for cash accounts (per-user AsyncStorage cache + `/api/cash-accounts` sync); exposes `cashAccounts`, `addCashAccount`, `updateCashAccount`, `removeCashAccount`, `totalCash`
- `artifacts/mobile/context/AppSettingsContext.tsx` — theme (light/dark/system) + language (en/ar)
- `artifacts/mobile/hooks/usePrices.ts` — live market data fetching
- `artifacts/mobile/hooks/useColors.ts` — resolves active theme from AppSettings
- `artifacts/mobile/hooks/useTranslation.ts` — returns the correct language strings
- `artifacts/mobile/i18n/index.ts` — English + Arabic translations
- `artifacts/mobile/types/index.ts` — shared TypeScript types

## Architecture decisions

- **Frontend-only**: No database or server used. Holdings stored in AsyncStorage on device.
- **Triple API fallback for prices**: Yahoo Finance (primary, native-only) → goldprice.org → open.er-api.com → hardcoded fallback. On web preview, Yahoo Finance and goldprice.org are CORS-blocked — this is expected; the app works fully on native.
- **Theme & language in context**: `AppSettingsContext` persists user preferences in AsyncStorage. `useColors()` reads the resolved theme. `useT()` returns the active language's translation object.
- **Single translation object**: `i18n/index.ts` exports `translations.en` and `translations.ar`. Adding a new string requires updating both. TypeScript ensures parity via `typeof en`.
- **No RTL layout flip**: Arabic mode changes text strings only. Full RTL layout (via `I18nManager.forceRTL`) would need an app restart and is not implemented yet.
- **Single "Pro" plan**: There is only one paid tier, called "Pro" (49.99 EGP/mo, 399.99 EGP/yr). The old two-tier Pro/Pro+ split was merged into this single plan, which uses the purple accent (`#A47FCA`) and rosette (iOS)/award (Android) icon that used to be exclusive to Pro+.
- **Real Estate holding model**: `RealEstateHolding` (`types/index.ts`) is a rich, structured model, not a free-text entry. It has 12 `PropertyType`s (Apartment, Villa, Duplex, Penthouse, Townhouse, Chalet, Land, Office, Retail Shop, Commercial, Medical Clinic, Warehouse) shown as horizontally scrollable chips in `add-investment.tsx`. Location is structured Governorate → City → District via searchable dropdown modals (`SearchPickerModal`, reused 3x) backed by `data/egypt-locations.ts`, with a manual "Other" free-text fallback at each level. Area (m²) is required; Current Value is always computed as `Area × Current Market Price/m²` (plus Last Valuation Date + Valuation Source) rather than manually entered. Purchase info was expanded with Property Name, Developer, Compound/Project, and Unit Number. Installment and Rental details are optional, collapsed-by-default sections. The Add screen shows a live Property Summary card (purchase price, purchase/current price per m², current value, unrealized P/L, appreciation %, ROI) that appears once area, purchase price, and current market price/m² are all filled. `HoldingCard.tsx` and `analytics.tsx` display `propertyName` (not a generic "Real Estate" label) as the holding title.
- **Launch Access mode (Stripe payments disabled)**: The app currently runs in a "launch" mode where free Pro access is granted without real payment — Stripe checkout and Apple IAP are all fully wired but dormant behind server-side flags. This is not backed by Firebase (this stack has no Firebase); it reuses the existing Postgres/Express backend and env vars instead.
  - Server, in `artifacts/api-server/src/routes/stripe.ts`, `GET /api/subscription` grants free `plan: "pro"` (`launchAccess: true`) via two independent, combinable rules, checked before any Stripe lookup:
    - `LAUNCH_ACCESS_UNTIL` (ISO date/time env var) — while `now` is before this date, **every** signed-in user gets free Pro. Currently set to `2026-12-31T23:59:59Z` (free for all through end of 2026). No code change needed to expire it — once the date passes, real Stripe subscriptions take back over automatically.
    - `PERMANENT_FREE_EMAILS` (comma-separated env var) — these emails (currently the two developer accounts) get free Pro forever, regardless of the launch window/date. Checked via a live Clerk lookup (`clerkClient.users.getUser`) since Clerk sessions don't reliably carry email in claims.
    - `FREE_ACCESS_PLAN=pro` is a separate manual kill-switch/override (currently `off`) that, if set, forces free Pro for everyone unconditionally — useful for reinstating launch access early without touching the other two vars.
  - Client: `SubscriptionContext` exposes a single `launchAccess: boolean` used everywhere premium status is checked (`isPro`/`plan` already flow from the same source, so `PremiumGate` and holdings-limit checks need no changes). `purchase()`/`manageSubscription()` no-op when `launchAccess` is true as a defensive guard.
  - UI: `components/LaunchAccess.tsx` exports `LaunchBadge` (non-clickable "Included During Launch" pill) and `LaunchBanner` (pricing-screen launch banner). Pricing plan cards and copy are untouched; only the CTA button/manage-subscription controls are swapped for the badge when `launchAccess` is true.
  - **To re-enable real payments for everyone sooner**: set `LAUNCH_ACCESS_UNTIL` to a past date (or unset it) and ensure `FREE_ACCESS_PLAN` is unset/`off`. No client code changes are needed — the app will automatically fall back to the real Stripe/IAP purchase flow since that code path was never removed, only bypassed.
- **Cash accounts follow the Holdings pattern**: `cash_accounts` is a separate Drizzle table (`lib/db/src/schema/cashAccounts.ts`) with the same shape as `holdings` (jsonb `data` column, per-row `userId`). `artifacts/api-server/src/routes/cash.ts` mirrors `holdings.ts` — Clerk-authenticated, ownership enforced server-side on every query. `CashContext` mirrors `HoldingsContext` exactly (per-user AsyncStorage key, optimistic CRUD, first-sign-in migration from local cache to the API).

## Product

- **Portfolio tab**: Total portfolio value in EGP, gain/loss %, asset allocation bar, top 5 holdings, and a Cash card below the hero card (only shown once the user has at least one cash account) showing total cash and linking to the cash accounts screen
- **Markets tab**: Live USD/EGP rate, gold (18k/21k/24k per gram + per oz), silver (per gram + per oz), 8 EGX stocks with live prices and change %
- **Holdings tab**: All investments grouped by type (Gold, Silver, Stocks, Real Estate), delete with haptic feedback, FAB to add
- **Add screen**: Opens with an Investment/Cash chooser. "Investment" leads to the unchanged investment flow — Gold (karat, form, grams, price), Silver (form, grams, price), EGX Stock (symbol picker + custom, shares, price), Real Estate (type, location, buy/current value). "Cash" leads to a form for Bank Account, Cash at Home, or Foreign Currency — each with Account Name, Balance, and Currency
- **Cash accounts screen**: Lists all cash accounts with a total, tap to edit, delete with confirmation, "+" to add another
- **Settings tab**: Light/Dark/System theme selector, English/Arabic language toggle, about info
- **Personalized greeting**: Home screen header shows a left-aligned, time-of-day greeting ("Good morning/afternoon/evening") above the INVESTRY logo, optionally combined with the user's Display Name (e.g. "Good afternoon, Nadia"). The old "Know Your Wealth" slogan was removed from the home header to make room for it. Display Name is set via Settings → tap the profile hero → Edit Profile modal (avatar, editable Display Name field with hint text, read-only email below), stored in Clerk's `user.unsafeMetadata.displayName` — updates the greeting immediately everywhere via `useUser()` reactivity, no restart needed. Shared logic lives in `utils/greeting.ts` (`getTimeOfDayGreeting` / `getPersonalizedGreeting`), with i18n keys `greetingMorning/Afternoon/Evening`, `displayName`, `displayNamePlaceholder`, `displayNameHint` added to both `en`/`ar`.

## User preferences

- Dark navy (#060D1A) + gold (#D4AC0D) as primary theme
- No emojis in UI — use Feather/SF icons
- Arabic app name "استثمارك" everywhere, UI can be English or Arabic

## Gotchas

- CORS blocks Yahoo Finance and goldprice.org on web preview — this is normal. All APIs work on native (Expo Go).
- EGX stock tickers on Yahoo Finance use `.CA` suffix (e.g. `COMI.CA` for Egyptian Exchange).
- `useColors()` depends on `AppSettingsContext` — must be used inside `AppSettingsProvider`.
- UUID: use `Date.now().toString() + Math.random().toString(36).substr(2, 9)` — never `uuid` package.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for Expo-specific guidelines and pitfalls
