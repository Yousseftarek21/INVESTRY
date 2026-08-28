---
name: EGX Market Architecture
description: How the EGX market section is structured — static DB + TradingView scanner + UI components
---

The EGX Market section is split into three files:

**Why:** Markets tab was getting too large; separating concerns makes the EGX section independently testable and the data easily extensible.

**How to apply:** To add new companies, add to `data/egx-companies.ts` EGX_COMPANIES array. No other files need changing — the hook and UI auto-pick them up.

## data/egx-companies.ts
- Static DB of 282 EGX companies with: ticker, nameEn, nameAr, sector, industry, fallbackPrice — tickers/names sourced from TradingView's Egypt scanner, no per-ticker provider suffix needed
- `EGX_SECTORS` const array — drives sector pills
- Helper fns: `getSectorCounts()`, `searchCompanies(query)`, `getEGXMarketStatus()`
- EGX hours: Sunday–Thursday 10:00–15:30 Cairo time (Africa/Cairo tz)

## hooks/useEGXMarket.ts
- `useEGXMarket()` — React Query hook, 60s stale, placeholderData = fallback prices
- Fetches via the server's `GET /api/markets/stocks`, which scans TradingView's Egypt scanner (`scanner.tradingview.com/egypt/scan`) for all 282 tickers in one batched POST — TradingView is the sole source (no other provider silently stands in if it fails; see [[us-markets-arch]] for the same policy applied to US stocks)
- Returns `EGXStockLive[]` — extends EGXCompany with price, change, changePercent, volume, marketCap, high52w, low52w, pe, dividendYield, isLive
- On any fetch failure → graceful fallback to static prices with isLive=false

## components/EGXMarket.tsx
- `<EGXMarket />` — self-contained, imported by markets.tsx EGXTab
- MarketStatusBanner, SearchBar, SectorPills (with counts), StockCard (expandable), SectorGroup, LoadingSkeleton
- Search: real-time filter by ticker/nameEn/nameAr/sector — resets sector when typing; clearing resets search
- StockCard expands to show 52W range bar, P/E, dividend yield, industry
- "est." badge on non-live prices; LIVE badge when at least one price is real-time

## markets.tsx change
- Removed `useEGXStocks` import entirely (replaced by useEGXMarket inside EGXMarket component)
- EGXTab now simply renders `<EGXMarket />`
