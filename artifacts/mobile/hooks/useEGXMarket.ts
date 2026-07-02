import { useQuery } from '@tanstack/react-query';
import { EGX_COMPANIES, EGXCompany } from '@/data/egx-companies';

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

const YF_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};

// Fetch a batch of tickers from Yahoo Finance v7
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
    if (!r) {
      return { ...company, price: company.fallbackPrice, change: 0, changePercent: 0, isLive: false };
    }
    return {
      ...company,
      price:          parseFloat((r.regularMarketPrice   ?? company.fallbackPrice).toFixed(2)),
      change:         parseFloat((r.regularMarketChange  ?? 0).toFixed(2)),
      changePercent:  parseFloat((r.regularMarketChangePercent ?? 0).toFixed(2)),
      volume:         r.regularMarketVolume  ?? undefined,
      marketCap:      r.marketCap            ?? undefined,
      high52w:        r.fiftyTwoWeekHigh     ?? undefined,
      low52w:         r.fiftyTwoWeekLow      ?? undefined,
      pe:             r.trailingPE           ?? undefined,
      dividendYield:  r.trailingAnnualDividendYield != null
                        ? parseFloat((r.trailingAnnualDividendYield * 100).toFixed(2))
                        : undefined,
      isLive: true,
    };
  });
}

// Split array into chunks of N
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchAllEGX(): Promise<EGXStockLive[]> {
  // Yahoo Finance works on native; CORS-blocked on web (expected).
  // Fetch in parallel batches of 25 to stay within URL limits.
  const batches = chunk(EGX_COMPANIES, 25);
  try {
    const results = await Promise.all(batches.map(fetchBatch));
    return results.flat();
  } catch {
    // Fallback: return all companies with static prices
    return EGX_COMPANIES.map(c => ({
      ...c,
      price: c.fallbackPrice,
      change: 0,
      changePercent: 0,
      isLive: false,
    }));
  }
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
