---
name: EGX live prices in holdings
description: How live EGX stock prices are merged into MarketPrices and used for P&L
---

EGXCompany (data/egx-companies.ts) uses `ticker` as the field name, NOT `symbol`. This is the key to avoid type errors.

## Pattern
In each screen that computes stock value (index.tsx, analytics.tsx, holdings.tsx), shadow the raw prices with a merged version:

```typescript
const { data: rawPrices } = useMarketPrices();
const { data: egxStocks } = useEGXMarket();
const prices = useMemo(() => {
  if (!rawPrices) return rawPrices;
  const egxPrices: Record<string, number> = {};
  egxStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
  return { ...rawPrices, egxPrices };
}, [rawPrices, egxStocks]);
```

The stock holding's `symbol` field (e.g. "COMI") matches the EGXCompany `ticker` field. MarketPrices now has `egxPrices?: Record<string, number>`.

## computeValue for stock
```typescript
if (h.type === 'stock') return h.shares * (prices.egxPrices?.[h.symbol] ?? h.purchasePricePerShare);
```

The fallback to `purchasePricePerShare` means cost = value when no live price is available (no unrealized P/L shown, which is correct).

**Why:** Live prices come from a separate hook (useEGXMarket) not from usePrices/MarketPrices. Merging via shadow useMemo avoids changing all the callsites.
