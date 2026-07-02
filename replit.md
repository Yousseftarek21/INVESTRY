# INVSTRY — Egypt Investment Tracker

Egypt's first investment tracking mobile app (Expo / React Native). Tracks gold & silver prices in EGP, EGX stocks, and real estate holdings. Shows a live portfolio overview with total value, allocation breakdown, and gain/loss vs. purchase cost.

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
- `artifacts/mobile/app/add-investment.tsx` — modal for adding new holdings
- `artifacts/mobile/constants/colors.ts` — light + dark color themes
- `artifacts/mobile/context/HoldingsContext.tsx` — AsyncStorage CRUD for user's holdings
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

## Product

- **Portfolio tab**: Total portfolio value in EGP, gain/loss %, asset allocation bar, top 5 holdings
- **Markets tab**: Live USD/EGP rate, gold (18k/21k/24k per gram + per oz), silver (per gram + per oz), 8 EGX stocks with live prices and change %
- **Holdings tab**: All investments grouped by type (Gold, Silver, Stocks, Real Estate), delete with haptic feedback, FAB to add
- **Add Investment modal**: Gold (karat, form, grams, price), Silver (form, grams, price), EGX Stock (symbol picker + custom, shares, price), Real Estate (type, location, buy/current value)
- **Settings tab**: Light/Dark/System theme selector, English/Arabic language toggle, about info

## User preferences

- Dark navy (#060D1A) + gold (#D4AC0D) as primary theme
- No emojis in UI — use Feather/SF icons
- Arabic app name "استثمارك" everywhere, UI can be English or Arabic

## Gotchas

- CORS blocks Yahoo Finance and goldprice.org on web preview — this is normal. All APIs work on native (Expo Go).
- EGX stock tickers on Yahoo Finance use `.CA` suffix (e.g. `COMI.CA` for Cairo Exchange).
- `useColors()` depends on `AppSettingsContext` — must be used inside `AppSettingsProvider`.
- UUID: use `Date.now().toString() + Math.random().toString(36).substr(2, 9)` — never `uuid` package.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for Expo-specific guidelines and pitfalls
