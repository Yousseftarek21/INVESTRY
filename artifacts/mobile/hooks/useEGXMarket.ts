import { useQuery } from '@tanstack/react-query';
import { EGX_COMPANIES, EGXCompany } from '@/data/egx-companies';
import { getApiBaseUrl } from '@/utils/api';

export interface EGXStockLive extends EGXCompany {
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
  pe?: number;
  dividendYield?: number;
  isLive: boolean;
}

interface ServerEGXStock {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
  pe?: number;
  dividendYield?: number;
}

const YF_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};

// ─── Source 1: API server (uses YF v8 chart, works everywhere) ────────────────
async function fetchFromServer(): Promise<EGXStockLive[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/markets/stocks`);
  if (!res.ok) throw new Error(`server ${res.status}`);
  const data: ServerEGXStock[] = await res.json();
  if (!data.length || data.every(s => s.price === 0)) throw new Error('no prices');

  const bySymbol = new Map(data.map(s => [s.symbol, s]));
  return EGX_COMPANIES.map(company => {
    const s = bySymbol.get(company.ticker);
    if (!s || s.price === 0) return { ...company, price: company.fallbackPrice, change: 0, changePercent: 0, isLive: false };
    return {
      ...company,
      price:         s.price,
      change:        s.change,
      changePercent: s.changePercent,
      volume:        s.volume,
      marketCap:     s.marketCap,
      high52w:       s.high52w,
      low52w:        s.low52w,
      pe:            s.pe,
      dividendYield: s.dividendYield,
      isLive:        true,
    };
  });
}

// ─── Source 2: Yahoo Finance v7 direct (native only — CORS-blocked on web) ───
async function fetchBatch(companies: EGXCompany[]): Promise<EGXStockLive[]> {
  const symbols = companies.map(c => encodeURIComponent(c.yahoo)).join('%2C');
  const res = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&lang=en-US&region=EG`,
    { headers: YF_HEADERS }
  );
  if (!res.ok) throw new Error(`YF ${res.status}`);
  const data = await res.json();
  const results: any[] = data?.quoteResponse?.result ?? [];
  if (results.length === 0) throw new Error('empty');

  const byTicker = new Map<string, any>(results.map((r: any) => [r.symbol as string, r]));
  return companies.map(company => {
    const r = byTicker.get(company.yahoo);
    if (!r) return { ...company, price: company.fallbackPrice, change: 0, changePercent: 0, isLive: false };
    return {
      ...company,
      price:         parseFloat((r.regularMarketPrice   ?? company.fallbackPrice).toFixed(2)),
      change:        parseFloat((r.regularMarketChange  ?? 0).toFixed(2)),
      changePercent: parseFloat((r.regularMarketChangePercent ?? 0).toFixed(2)),
      volume:        r.regularMarketVolume ?? undefined,
      marketCap:     r.marketCap          ?? undefined,
      high52w:       r.fiftyTwoWeekHigh   ?? undefined,
      low52w:        r.fiftyTwoWeekLow    ?? undefined,
      pe:            r.trailingPE         ?? undefined,
      dividendYield: r.trailingAnnualDividendYield != null
                       ? parseFloat((r.trailingAnnualDividendYield * 100).toFixed(2))
                       : undefined,
      isLive: true,
    };
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchViaYF(): Promise<EGXStockLive[]> {
  const batches = chunk(EGX_COMPANIES, 25);
  const results = await Promise.all(batches.map(fetchBatch));
  return results.flat();
}

async function fetchAllEGX(): Promise<EGXStockLive[]> {
  // 1. API server — works on web and native (server-side YF v8 chart)
  try {
    return await fetchFromServer();
  } catch { /* fall through */ }

  // 2. Yahoo Finance direct — native only (richer data: PE, dividendYield, etc.)
  try {
    return await fetchViaYF();
  } catch { /* fall through */ }

  // 3. Static fallback
  return EGX_COMPANIES.map(c => ({ ...c, price: c.fallbackPrice, change: 0, changePercent: 0, isLive: false }));
}

export function useEGXMarket() {
  return useQuery<EGXStockLive[]>({
    queryKey: ['egx-market-full'],
    queryFn: fetchAllEGX,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
    placeholderData: EGX_COMPANIES.map(c => ({
      ...c,
      price: c.fallbackPrice,
      change: 0,
      changePercent: 0,
      isLive: false,
    })),
  });
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function fmtMarketCap(cap?: number): string {
  if (!cap) return '—';
  if (cap >= 1_000_000_000_000) return `${(cap / 1_000_000_000_000).toFixed(1)}T EGP`;
  if (cap >= 1_000_000_000)     return `${(cap / 1_000_000_000).toFixed(1)}B EGP`;
  if (cap >= 1_000_000)         return `${(cap / 1_000_000).toFixed(0)}M EGP`;
  return `${cap.toLocaleString()} EGP`;
}

export function fmtVolume(vol?: number): string {
  if (!vol) return '—';
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000)     return `${(vol / 1_000).toFixed(0)}K`;
  return vol.toLocaleString();
}
