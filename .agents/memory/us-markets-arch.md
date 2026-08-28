---
name: US Markets Architecture
description: How the merged US Stocks+Indices Markets tab is structured — mirrors EGX's architecture, TradingView-only
---

The Markets tab's "US Markets" section (`markets.tsx` tab key `us_stocks`) was originally two thin tabs — "US Stocks" (8 tickers) and an empty "Indices" placeholder. Both were merged into one tab (2026-08-29), rebuilt on EGXMarket's own FlatList pattern instead of the old ScrollView+.map approach.

**Why:** 8 tickers was too sparse to justify its own tab, and a second near-empty "Indices" tab next to it was worse. One complete tab, structured like EGX (index chips above a full categorized stock list), reads as finished instead of two half-features.

**How to apply:** To add new US companies, add to both `mobile/data/global-stocks.ts`'s `GLOBAL_COMPANIES` and the server's `GLOBAL_TICKERS`/`GLOBAL_EXCHANGE` in `api-server/src/routes/markets.ts` (kept as two mirrored lists, not shared — mobile needs category/fallbackPrice, server needs exchange). Keep both lists in sync; nothing enforces it automatically.

## data/global-stocks.ts (mobile)
- 100 real large-cap US tickers across 11 GICS-style categories (Technology, Communication, Consumer Discretionary/Staples, Financials, Healthcare, Industrials, Energy, Real Estate, Utilities, Materials) — no "Indices" category; SPY/QQQ/DIA ETF proxies were dropped once real index values existed
- `getUSMarketStatus()` — NYSE/NASDAQ session status (pre/open/post/closed) in ET

## hooks/useGlobalStocks.ts
- Fetches `GET /api/markets/global-stocks` — server-side TradingView America-scanner batch, one call for all 100 tickers
- `placeholderData` = fallbackPrice per ticker with `isLive:false`, so a ticker missing from the server response never appears as $0 — it just falls back to its own static price

## hooks/useUSIndices.ts
- Separate feed: S&P 500 / Dow Jones / Nasdaq Composite via `GET /api/markets/us-indices`, real TradingView index values (`TVC:SPX`/`TVC:DJI`/`TVC:IXIC`), not ETF proxies
- `US_INDICES` const carries symbol/name/short/fallbackPrice; per-index description text is localized in i18n (`usIndexSpxDesc`/`usIndexDjiDesc`/`usIndexIxicDesc`), looked up by symbol in the component, not stored on this array

## components/GlobalStocksMarket.tsx
- `<GlobalStocksMarket style refreshing onRefresh topHeader topInset />` — same prop contract as `<EGXMarket />`, both special-cased in `markets.tsx` to own their own top-level FlatList (header baked in as `ListHeaderComponent`) rather than sitting inside the generic tab ScrollView, which virtualization requires
- Header (top to bottom): USMarketStatusBanner, USIndexChips (3-way divided card, EGXIndexChips' 2-way pattern generalized to 3 columns), SearchBar, CategoryPills, result-count + live/estimated pill
- StockCard is close to a 1:1 port of EGX's StockCard (avatar, expandable 52W range/P/E/dividend) — no "see all financials" deep link, since that route is EGX-specific

## Server (api-server/src/routes/markets.ts)
- `fetchGlobalStocks()` / `fetchUSIndices()` — TradingView only, same explicit "one trusted provider, no silent fallback" policy as EGX and FX; Twelve Data and Stooq tiers were removed entirely (2026-08-29) once the ticker list outgrew Twelve Data's free-tier quota
- `GET /markets/global-stocks` (60s cache) and `GET /markets/us-indices` (30s cache)

## markets.tsx change
- `TABS_CONFIG` has one `us_stocks` entry (`activity` icon, label "US Markets"/`t.tabUsStocks`) — no separate `indices` key
- `USStocksTab` wrapper mirrors `EGXTab` exactly; both are special-cased before the generic ScrollView branch in the screen's main render
