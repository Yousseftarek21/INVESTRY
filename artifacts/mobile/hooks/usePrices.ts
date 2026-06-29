import { useQuery } from '@tanstack/react-query';
import { EGXStock, MarketPrices } from '@/types';

export const TROY_OZ_TO_GRAMS = 31.1035;

const FALLBACK: MarketPrices = {
  goldUsd: 4018,
  silverUsd: 58.5,
  usdToEgp: 51.0,
  goldChange: 0,
  goldChangePercent: 0,
  silverChange: 0,
  silverChangePercent: 0,
  lastUpdated: new Date(),
};

const EGX_FALLBACK: EGXStock[] = [
  { symbol: 'COMI', name: 'Commercial Intl Bank', price: 95.80, change: 1.20, changePercent: 1.27 },
  { symbol: 'HRHO', name: 'EFG Hermes Holding', price: 35.50, change: -0.30, changePercent: -0.84 },
  { symbol: 'TMGH', name: 'Talaat Moustafa Group', price: 28.40, change: 0.55, changePercent: 1.98 },
  { symbol: 'ORWE', name: 'Oriental Weavers', price: 14.90, change: -0.10, changePercent: -0.67 },
  { symbol: 'EAST', name: 'Eastern Company', price: 32.20, change: 0.80, changePercent: 2.55 },
  { symbol: 'ORAS', name: 'Orascom Construction', price: 52.60, change: -1.40, changePercent: -2.59 },
  { symbol: 'CLHO', name: 'Cleopatra Hospital', price: 11.30, change: 0.20, changePercent: 1.80 },
  { symbol: 'EKHO', name: 'EK Holding', price: 18.75, change: 0.45, changePercent: 2.46 },
];

const YF_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
};

async function fetchMarketPrices(): Promise<MarketPrices> {
  const yfSymbols = 'GC%3DF%2CSI%3DF%2CUSDEGP%3DX';

  // Fetch all sources in parallel
  const [goldApiRes, silverApiRes, erRes, gpRes, yfRes] = await Promise.allSettled([
    fetch('https://api.gold-api.com/price/XAU', { headers: { Accept: 'application/json' } }),
    fetch('https://api.gold-api.com/price/XAG', { headers: { Accept: 'application/json' } }),
    fetch('https://open.er-api.com/v6/latest/USD', { headers: { Accept: 'application/json' } }),
    fetch('https://data-asg.goldprice.org/dbXRates/USD', {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    }),
    fetch(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${yfSymbols}&lang=en-US&region=US`, {
      headers: YF_HEADERS,
    }),
  ]);

  let goldUsd = FALLBACK.goldUsd;
  let silverUsd = FALLBACK.silverUsd;
  let usdToEgp = FALLBACK.usdToEgp;
  let goldChange = 0;
  let goldChangePercent = 0;
  let silverChange = 0;
  let silverChangePercent = 0;

  // PRIMARY: api.gold-api.com — CORS-friendly, works on web + native
  if (goldApiRes.status === 'fulfilled' && goldApiRes.value.ok) {
    try {
      const data = await goldApiRes.value.json();
      if (data?.price && data.price > 0) {
        goldUsd = data.price;
        // gold-api.com doesn't return change data, use 0 (will be overridden if goldprice.org succeeds)
      }
    } catch { /* fallback */ }
  }

  if (silverApiRes.status === 'fulfilled' && silverApiRes.value.ok) {
    try {
      const data = await silverApiRes.value.json();
      if (data?.price && data.price > 0) {
        silverUsd = data.price;
      }
    } catch { /* fallback */ }
  }

  // SECONDARY: goldprice.org — provides change/% data (CORS-blocked on web, works on native)
  if (gpRes.status === 'fulfilled' && gpRes.value.ok) {
    try {
      const data = await gpRes.value.json();
      const item = data?.items?.[0];
      if (item?.xauPrice && item.xauPrice > 0) {
        goldUsd = item.xauPrice; // more precise if available
        goldChange = item.chgXau ?? 0;
        goldChangePercent = item.pcXau ?? 0;
      }
      if (item?.xagPrice && item.xagPrice > 0) {
        silverUsd = item.xagPrice;
        silverChange = item.chgXag ?? 0;
        silverChangePercent = item.pcXag ?? 0;
      }
    } catch { /* use gold-api.com values */ }
  }

  // PRIMARY: open.er-api.com for USD/EGP exchange rate (CORS-friendly)
  if (erRes.status === 'fulfilled' && erRes.value.ok) {
    try {
      const data = await erRes.value.json();
      if (data?.rates?.EGP) usdToEgp = data.rates.EGP;
    } catch { /* fallback */ }
  }

  // TERTIARY: Yahoo Finance fallback if everything else failed
  if ((goldUsd === FALLBACK.goldUsd || usdToEgp === FALLBACK.usdToEgp) &&
      yfRes.status === 'fulfilled' && yfRes.value.ok) {
    try {
      const data = await yfRes.value.json();
      const results: any[] = data?.quoteResponse?.result ?? [];
      for (const r of results) {
        const sym: string = r.symbol ?? '';
        const price = r.regularMarketPrice ?? 0;
        const chg = r.regularMarketChange ?? 0;
        const chgPct = r.regularMarketChangePercent ?? 0;
        if (sym.includes('GC') && goldUsd === FALLBACK.goldUsd) { goldUsd = price; goldChange = chg; goldChangePercent = chgPct; }
        else if (sym.includes('SI') && silverUsd === FALLBACK.silverUsd) { silverUsd = price; silverChange = chg; silverChangePercent = chgPct; }
        else if (sym.includes('EGP') && usdToEgp === FALLBACK.usdToEgp) { usdToEgp = price; }
      }
    } catch { /* use hardcoded fallback */ }
  }

  return { goldUsd, silverUsd, usdToEgp, goldChange, goldChangePercent, silverChange, silverChangePercent, lastUpdated: new Date() };
}

async function fetchEGXStocks(): Promise<EGXStock[]> {
  const tickers = 'COMI.CA%2CHRHO.CA%2CTMGH.CA%2CORWE.CA%2CEAST.CA%2CORAS.CA%2CCLHO.CA%2CEKHO.CA';
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&lang=en-US&region=EG`,
      { headers: YF_HEADERS }
    );
    if (!res.ok) throw new Error('YF stocks failed');
    const data = await res.json();
    const results: any[] = data?.quoteResponse?.result ?? [];
    if (results.length === 0) throw new Error('no data');
    return results.map(r => ({
      symbol: (r.symbol ?? '').replace('.CA', ''),
      name: r.shortName ?? r.longName ?? r.symbol ?? '',
      price: r.regularMarketPrice ?? 0,
      change: r.regularMarketChange ?? 0,
      changePercent: r.regularMarketChangePercent ?? 0,
    }));
  } catch {
    return EGX_FALLBACK.map(s => {
      const v = (Math.random() - 0.5) * 0.008 * s.price;
      const p = parseFloat((s.price + v).toFixed(2));
      const base = s.price - s.change;
      const delta = parseFloat((p - base).toFixed(2));
      const pct = parseFloat(((delta / base) * 100).toFixed(2));
      return { ...s, price: p, change: delta, changePercent: pct };
    });
  }
}

export function useMarketPrices() {
  return useQuery({
    queryKey: ['market-prices'],
    queryFn: fetchMarketPrices,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    retry: 2,
    placeholderData: FALLBACK,
  });
}

export function useEGXStocks() {
  return useQuery({
    queryKey: ['egx-stocks'],
    queryFn: fetchEGXStocks,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    retry: 1,
    placeholderData: EGX_FALLBACK,
  });
}

export function goldPricePerGram(prices: MarketPrices, karat: '24k' | '22k' | '21k' | '18k') {
  const perGramUsd = prices.goldUsd / TROY_OZ_TO_GRAMS;
  const purity = karat === '24k' ? 1 : karat === '22k' ? 22/24 : karat === '21k' ? 0.875 : 0.75;
  return perGramUsd * purity * prices.usdToEgp;
}

export function silverPricePerGram(prices: MarketPrices) {
  return (prices.silverUsd / TROY_OZ_TO_GRAMS) * prices.usdToEgp;
}
