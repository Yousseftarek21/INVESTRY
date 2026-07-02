---
name: EGX Market Architecture
description: How the EGX market section is structured — static DB + Yahoo Finance batching + UI components
---

The EGX Market section is split into three files:

**Why:** Markets tab was getting too large; separating concerns makes the EGX section independently testable and the data easily extensible.

**How to apply:** To add new companies, add to `data/egx-companies.ts` EGX_COMPANIES array. No other files need changing — the hook and UI auto-pick them up.

## data/egx-companies.ts
- Static DB of ~50 EGX companies with: ticker, yahoo (.CA suffix), nameEn, nameAr, sector, industry, fallbackPrice
- `EGX_SECTORS` const array — drives sector pills
- Helper fns: `getSectorCounts()`, `searchCompanies(query)`, `getEGXMarketStatus()`
- EGX hours: Sunday–Thursday 10:00–15:30 Cairo time (Africa/Cairo tz)

## hooks/useEGXMarket.ts
- `useEGXMarket()` — React Query hook, 60s stale, placeholderData = fallback prices
- Fetches Yahoo Finance v7 quote API in parallel batches of 25 (CORS-blocked on web, works on native)
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
