import { useQuery } from '@tanstack/react-query';
import { EGXStock, MarketPrices } from '@/types';

export const TROY_OZ_TO_GRAMS = 31.1035;

// Routes through Replit shared proxy → our Express API server at /api
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : '/api';

// ─── Fallback (shown while loading or if all sources fail) ────────────────────

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
  { symbol: 'COMI', name: 'Commercial Intl Bank',      price: 95.80, change: 1.20,  changePercent: 1.27  },
  { symbol: 'HRHO', name: 'EFG Hermes Holding',        price: 35.50, change: -0.30, changePercent: -0.84 },
  { symbol: 'TMGH', name: 'Talaat Moustafa Group',     price: 28.40, change: 0.55,  changePercent: 1.98  },
  { symbol: 'ORWE', name: 'Oriental Weavers',          price: 14.90, change: -0.10, changePercent: -0.67 },
  { symbol: 'EAST', name: 'Eastern Company',           price: 32.20, change: 0.80,  changePercent: 2.55  },
  { symbol: 'ORAS', name: 'Orascom Construction',      price: 52.60, change: -1.40, changePercent: -2.59 },
  { symbol: 'CLHO', name: 'Cleopatra Hospital',        price: 11.30, change: 0.20,  changePercent: 1.80  },
  { symbol: 'EKHO', name: 'EK Holding',                price: 18.75, change: 0.45,  changePercent: 2.46  },
  { symbol: 'SWDY', name: 'El Sewedy Electric',        price: 42.10, change: 0.60,  changePercent: 1.45  },
  { symbol: 'FWRY', name: 'Fawry Banking & Payment',  price: 29.80, change: -0.50, changePercent: -1.65 },
  { symbol: 'PHDC', name: 'Palm Hills Developments',  price: 8.75,  change: 0.15,  changePercent: 1.74  },
  { symbol: 'MNHD', name: 'Madinet Nasr Housing',     price: 19.40, change: 0.30,  changePercent: 1.57  },
  { symbol: 'JUFO', name: 'Juhayna Food Industries',  price: 12.60, change: -0.20, changePercent: -1.56 },
  { symbol: 'ESRS', name: 'Ezz Steel',                price: 66.50, change: 1.10,  changePercent: 1.68  },
  { symbol: 'GAMA', name: 'Ghabbour Auto',            price: 5.40,  change: 0.10,  changePercent: 1.89  },
  { symbol: 'HDBK', name: 'Housing & Development Bank', price: 18.90, change: -0.40, changePercent: -2.07 },
  { symbol: 'ABUK', name: 'Abu Kir Fertilizers',      price: 180.5, change: 2.50,  changePercent: 1.40  },
  { symbol: 'SPMD', name: 'Speed Medical',            price: 15.20, change: 0.35,  changePercent: 2.36  },
  { symbol: 'CIRA', name: 'CIRA Education',           price: 23.10, change: 0.55,  changePercent: 2.44  },
  { symbol: 'OCDI', name: 'Orascom Development Egypt', price: 11.80, change: -0.20, changePercent: -1.67 },
];

// ─── Direct client-side fallback (used if API server unreachable) ─────────────

async function fetchMarketPricesDirect(): Promise<MarketPrices> {
  const [goldRes, silverRes, erRes] = await Promise.allSettled([
    fetch('https://api.gold-api.com/price/XAU', { headers: { Accept: 'application/json' } }),
    fetch('https://api.gold-api.com/price/XAG', { headers: { Accept: 'application/json' } }),
    fetch('https://open.er-api.com/v6/latest/USD'),
  ]);

  let goldUsd = FALLBACK.goldUsd;
  let silverUsd = FALLBACK.silverUsd;
  let usdToEgp = FALLBACK.usdToEgp;

  try {
    if (goldRes.status === 'fulfilled' && goldRes.value.ok) {
      const d = await goldRes.value.json();
      if (d?.price > 0) goldUsd = d.price;
    }
  } catch { /* use fallback */ }

  try {
    if (silverRes.status === 'fulfilled' && silverRes.value.ok) {
      const d = await silverRes.value.json();
      if (d?.price > 0) silverUsd = d.price;
    }
  } catch { /* use fallback */ }

  try {
    if (erRes.status === 'fulfilled' && erRes.value.ok) {
      const d = await erRes.value.json();
      if (d?.rates?.EGP > 0) usdToEgp = d.rates.EGP;
    }
  } catch { /* use fallback */ }

  return {
    goldUsd, silverUsd, usdToEgp,
    goldChange: 0, goldChangePercent: 0,
    silverChange: 0, silverChangePercent: 0,
    lastUpdated: new Date(),
  };
}

// ─── Primary fetchers (via our API server — no CORS, server-side aggregation) ─

async function fetchMarketPrices(): Promise<MarketPrices> {
  try {
    const res = await fetch(`${API_BASE}/markets/prices`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return {
      goldUsd:            data.goldUsd            ?? FALLBACK.goldUsd,
      silverUsd:          data.silverUsd          ?? FALLBACK.silverUsd,
      usdToEgp:           data.usdToEgp           ?? FALLBACK.usdToEgp,
      goldChange:         data.goldChange          ?? 0,
      goldChangePercent:  data.goldChangePercent   ?? 0,
      silverChange:       data.silverChange        ?? 0,
      silverChangePercent: data.silverChangePercent ?? 0,
      lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
    };
  } catch {
    // API server unreachable — fall through to direct CORS-open sources
    return fetchMarketPricesDirect();
  }
}

async function fetchEGXStocks(): Promise<EGXStock[]> {
  try {
    const res = await fetch(`${API_BASE}/markets/stocks`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data: EGXStock[] = await res.json();
    // If server returned all-zeros (Yahoo Finance failed), fall back
    if (data.every(s => s.price === 0)) return EGX_FALLBACK;
    return data;
  } catch {
    return EGX_FALLBACK;
  }
}

// ─── React Query hooks ────────────────────────────────────────────────────────

export function useMarketPrices() {
  return useQuery({
    queryKey: ['market-prices'],
    queryFn: fetchMarketPrices,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 2,
    placeholderData: FALLBACK,
  });
}

export function useEGXStocks() {
  return useQuery({
    queryKey: ['egx-stocks'],
    queryFn: fetchEGXStocks,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
    placeholderData: EGX_FALLBACK,
  });
}

// ─── EGP price calculators ────────────────────────────────────────────────────

export function goldPricePerGram(prices: MarketPrices, karat: '24k' | '22k' | '21k' | '18k'): number {
  const perGramUsd = prices.goldUsd / TROY_OZ_TO_GRAMS;
  const purity = karat === '24k' ? 1 : karat === '22k' ? 22 / 24 : karat === '21k' ? 0.875 : 0.75;
  return perGramUsd * purity * prices.usdToEgp;
}

export function silverPricePerGram(prices: MarketPrices): number {
  return (prices.silverUsd / TROY_OZ_TO_GRAMS) * prices.usdToEgp;
}
