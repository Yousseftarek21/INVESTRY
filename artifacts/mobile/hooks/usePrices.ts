import { useQuery } from '@tanstack/react-query';
import { EGXStock, MarketPrices } from '@/types';
import { getApiBaseUrl } from '@/utils/api';

export const TROY_OZ_TO_GRAMS = 31.1035;

const API_BASE = `${getApiBaseUrl()}/api`;

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
  fxRates: {
    EUR: 55.5, GBP: 65.0, TRY: 1.55, CNY: 7.05,
    CHF: 57.5, QAR: 14.0, SAR: 13.6, AED: 13.9, KWD: 166.0,
  },
};

const EGX_FALLBACK: EGXStock[] = [
  { symbol: 'COMI', name: 'Commercial Intl Bank',      price: 95.80, change: 1.20,  changePercent: 1.27  },
  { symbol: 'HRHO', name: 'EFG Hermes Holding',        price: 35.50, change: -0.30, changePercent: -0.84 },
  { symbol: 'TMGH', name: 'Talaat Moustafa Group',     price: 28.40, change: 0.55,  changePercent: 1.98  },
  { symbol: 'ORWE', name: 'Oriental Weavers',          price: 14.90, change: -0.10, changePercent: -0.67 },
  { symbol: 'EAST', name: 'Eastern Company',           price: 32.20, change: 0.80,  changePercent: 2.55  },
  { symbol: 'ORAS', name: 'Orascom Construction',      price: 52.60, change: -1.40, changePercent: -2.59 },
  { symbol: 'CLHO', name: 'Cleopatra Hospital',        price: 11.30, change: 0.20,  changePercent: 1.80  },
  { symbol: 'SWDY', name: 'El Sewedy Electric',        price: 42.10, change: 0.60,  changePercent: 1.45  },
  { symbol: 'FWRY', name: 'Fawry Banking & Payment',  price: 29.80, change: -0.50, changePercent: -1.65 },
  { symbol: 'PHDC', name: 'Palm Hills Developments',  price: 8.75,  change: 0.15,  changePercent: 1.74  },
  { symbol: 'MNHD', name: 'Madinet Nasr Housing',     price: 19.40, change: 0.30,  changePercent: 1.57  },
  { symbol: 'JUFO', name: 'Juhayna Food Industries',  price: 12.60, change: -0.20, changePercent: -1.56 },
  { symbol: 'GAMA', name: 'Ghabbour Auto',            price: 5.40,  change: 0.10,  changePercent: 1.89  },
  { symbol: 'HDBK', name: 'Housing & Development Bank', price: 18.90, change: -0.40, changePercent: -2.07 },
  { symbol: 'ABUK', name: 'Abu Kir Fertilizers',      price: 180.5, change: 2.50,  changePercent: 1.40  },
  { symbol: 'SPMD', name: 'Speed Medical',            price: 15.20, change: 0.35,  changePercent: 2.36  },
  { symbol: 'CIRA', name: 'CIRA Education',           price: 23.10, change: 0.55,  changePercent: 2.44  },
  { symbol: 'OCDI', name: 'Orascom Development Egypt', price: 11.80, change: -0.20, changePercent: -1.67 },
];

// ─── Direct client-side fallback (used if API server unreachable) ─────────────

async function fetchMarketPricesDirect(): Promise<MarketPrices> {
  // TradingView CFD scanner — free, no key, same source the server uses
  const [tvRes, erRes] = await Promise.allSettled([
    fetch('https://scanner.tradingview.com/global/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://www.tradingview.com' },
      body: JSON.stringify({
        symbols: { tickers: ['TVC:GOLD', 'TVC:SILVER'] },
        columns: ['close', 'change_abs', 'change'],
      }),
    }),
    fetch('https://open.er-api.com/v6/latest/USD'),
  ]);

  let goldUsd = FALLBACK.goldUsd;
  let silverUsd = FALLBACK.silverUsd;
  let goldChangePercent = 0;
  let silverChangePercent = 0;
  let usdToEgp = FALLBACK.usdToEgp;

  try {
    if (tvRes.status === 'fulfilled' && tvRes.value.ok) {
      const d = await tvRes.value.json() as { data?: Array<{ s: string; d: [number, number, number] }> };
      const byS: Record<string, [number, number, number]> = {};
      for (const item of d?.data ?? []) byS[item.s] = item.d;
      const gold = byS['TVC:GOLD'];
      const silver = byS['TVC:SILVER'];
      if (gold?.[0] > 0)   { goldUsd = gold[0];     goldChangePercent = gold[2];   }
      if (silver?.[0] > 0) { silverUsd = silver[0]; silverChangePercent = silver[2]; }
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
    goldChange: 0, goldChangePercent,
    silverChange: 0, silverChangePercent,
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
      fxRates: data.fxRates ?? FALLBACK.fxRates,
    };
  } catch {
    // API server unreachable — fall through to direct CORS-open sources
    return fetchMarketPricesDirect();
  }
}

// Yahoo Finance headers — works on native devices; CORS-blocked on web (expected)
const YF_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};

const EGX_YAHOO = [
  { yahoo: 'COMI.CA',  symbol: 'COMI',  name: 'Commercial Intl Bank'      },
  { yahoo: 'HRHO.CA',  symbol: 'HRHO',  name: 'EFG Hermes Holding'         },
  { yahoo: 'TMGH.CA',  symbol: 'TMGH',  name: 'Talaat Moustafa Group'      },
  { yahoo: 'ORWE.CA',  symbol: 'ORWE',  name: 'Oriental Weavers'           },
  { yahoo: 'EAST.CA',  symbol: 'EAST',  name: 'Eastern Company'            },
  { yahoo: 'ORAS.CA',  symbol: 'ORAS',  name: 'Orascom Construction'       },
  { yahoo: 'CLHO.CA',  symbol: 'CLHO',  name: 'Cleopatra Hospital'         },
  { yahoo: 'SWDY.CA',  symbol: 'SWDY',  name: 'El Sewedy Electric'         },
  { yahoo: 'FWRY.CA',  symbol: 'FWRY',  name: 'Fawry Banking & Payment'    },
  { yahoo: 'PHDC.CA',  symbol: 'PHDC',  name: 'Palm Hills Developments'    },
  { yahoo: 'MNHD.CA',  symbol: 'MNHD',  name: 'Madinet Nasr Housing'       },
  { yahoo: 'JUFO.CA',  symbol: 'JUFO',  name: 'Juhayna Food Industries'    },
  { yahoo: 'GAMA.CA',  symbol: 'GAMA',  name: 'Ghabbour Auto'              },
  { yahoo: 'HDBK.CA',  symbol: 'HDBK',  name: 'Housing & Development Bank'  },
  { yahoo: 'ABUK.CA',  symbol: 'ABUK',  name: 'Abu Kir Fertilizers'        },
  { yahoo: 'SPMD.CA',  symbol: 'SPMD',  name: 'Speed Medical'              },
  { yahoo: 'CIRA.CA',  symbol: 'CIRA',  name: 'CIRA Education'             },
  { yahoo: 'OCDI.CA',  symbol: 'OCDI',  name: 'Orascom Development Egypt'  },
];

async function fetchEGXStocks(): Promise<EGXStock[]> {
  // Fetch directly from Yahoo Finance — works on native (Expo Go / production),
  // CORS-blocked on web preview (expected). Falls back to static data on web.
  const tickers = EGX_YAHOO.map(t => encodeURIComponent(t.yahoo)).join('%2C');
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&lang=en-US&region=EG`,
      { headers: YF_HEADERS }
    );
    if (!res.ok) throw new Error(`YF ${res.status}`);
    const data = await res.json();
    const results: any[] = data?.quoteResponse?.result ?? [];
    if (results.length === 0) throw new Error('empty');

    const byTicker = new Map(results.map((r: any) => [r.symbol as string, r]));
    return EGX_YAHOO.map(t => {
      const r = byTicker.get(t.yahoo);
      if (!r) return { symbol: t.symbol, name: t.name, price: 0, change: 0, changePercent: 0 };
      return {
        symbol: t.symbol,
        name: t.name,
        price: parseFloat((r.regularMarketPrice ?? 0).toFixed(2)),
        change: parseFloat((r.regularMarketChange ?? 0).toFixed(2)),
        changePercent: parseFloat((r.regularMarketChangePercent ?? 0).toFixed(2)),
      };
    });
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

export function useGoldHistory(range: string) {
  return useQuery<number[] | null>({
    queryKey: ['gold-history', range],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/markets/gold-history?range=${encodeURIComponent(range)}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const pts = data?.points;
        return Array.isArray(pts) && pts.length >= 2 ? (pts as number[]) : null;
      } catch { return null; }
    },
    staleTime: range === '1D' ? 5 * 60_000 : 60 * 60_000,
    refetchInterval: range === '1D' ? 5 * 60_000 : false,
    retry: 1,
    placeholderData: null,
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
