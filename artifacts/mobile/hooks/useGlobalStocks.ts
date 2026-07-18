import { useQuery } from '@tanstack/react-query';
import { GLOBAL_COMPANIES, GlobalCompany } from '@/data/global-stocks';
import { getApiBaseUrl } from '@/utils/api';

export interface GlobalStockLive extends GlobalCompany {
  price: number;
  change: number;
  changePercent: number;
  isLive: boolean;
  volume?: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
  pe?: number;
  dividendYield?: number;
}

const API_BASE = `${getApiBaseUrl()}/api`;

interface ApiStock {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

function placeholderStocks(): GlobalStockLive[] {
  return GLOBAL_COMPANIES.map(c => ({
    ...c,
    price: c.fallbackPrice,
    change: 0,
    changePercent: 0,
    isLive: false,
  }));
}

async function fetchGlobalStocksViaApi(): Promise<GlobalStockLive[]> {
  const res = await fetch(`${API_BASE}/markets/global-stocks`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data: ApiStock[] = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('empty');

  const byTicker = new Map(data.map(s => [s.symbol, s]));

  return GLOBAL_COMPANIES.map(company => {
    const s = byTicker.get(company.ticker);
    if (!s || !s.price) return { ...company, price: company.fallbackPrice, change: 0, changePercent: 0, isLive: false };
    return {
      ...company,
      price: s.price,
      change: s.change,
      changePercent: s.changePercent,
      isLive: true,
    };
  });
}

// Direct client-side fallback — Yahoo Finance is free, no key needed.
// Works on native; CORS-blocked on web preview (expected, same as EGX).
const YF_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};

async function fetchGlobalStocksDirect(): Promise<GlobalStockLive[]> {
  const symbols = GLOBAL_COMPANIES.map(c => encodeURIComponent(c.yahoo)).join('%2C');
  const res = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&lang=en-US&region=US`,
    { headers: YF_HEADERS }
  );
  if (!res.ok) throw new Error(`YF ${res.status}`);
  const data = await res.json();
  const results: any[] = data?.quoteResponse?.result ?? [];
  if (results.length === 0) throw new Error('empty');

  const byTicker = new Map<string, any>(results.map((r: any) => [r.symbol as string, r]));

  return GLOBAL_COMPANIES.map(company => {
    const r = byTicker.get(company.yahoo);
    if (!r) return { ...company, price: company.fallbackPrice, change: 0, changePercent: 0, isLive: false };
    return {
      ...company,
      price: parseFloat((r.regularMarketPrice ?? company.fallbackPrice).toFixed(2)),
      change: parseFloat((r.regularMarketChange ?? 0).toFixed(2)),
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

async function fetchAllGlobalStocks(): Promise<GlobalStockLive[]> {
  try {
    return await fetchGlobalStocksViaApi();
  } catch {
    // API server unreachable — fall through to direct CORS-open fetch
    try {
      return await fetchGlobalStocksDirect();
    } catch {
      return placeholderStocks();
    }
  }
}

export function useGlobalStocks() {
  return useQuery<GlobalStockLive[]>({
    queryKey: ['global-stocks'],
    queryFn: fetchAllGlobalStocks,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
    placeholderData: placeholderStocks(),
  });
}
