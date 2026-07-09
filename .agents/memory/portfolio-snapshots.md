---
name: Portfolio snapshot storage
description: Daily portfolio value snapshots for the time-series chart
---

## Storage
- AsyncStorage key: `@investry_portfolio_snapshots`
- Shape: `Record<string, number>` where key is YYYY-MM-DD and value is totalValue in EGP
- Capped at 730 days (2 years)

## Hook: usePortfolioSnapshots(currentValue: number)
- Lives in `hooks/usePortfolioSnapshots.ts`
- Loads on mount, records today's value once per session (guarded by a ref)
- Returns `{ snapshots: PortfolioSnapshot[] }` sorted by date ascending

## Chart integration
The `snapshotValues(snapshots, filter)` helper in index.tsx filters by time range and returns number[] or null.
- 1D filter → always returns null (no intraday data), falls back to gold history
- Other filters → returns snapshot values if ≥2 exist, else falls back to gold history
- InteractiveChart: `prices={snapshotValues(snapshots, timeFilter) ?? goldHistory ?? null}`

**Why:** Real portfolio history is much more meaningful than gold price as a proxy. Snapshots accumulate over time; new users gracefully fall back to gold history.
