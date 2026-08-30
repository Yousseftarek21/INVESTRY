import { useEffect } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { GLOBAL_COMPANIES, GlobalCompany } from '@/data/global-stocks';
import { getApiBaseUrl } from '@/utils/api';
import { loadCachedGlobalStocks, saveCachedGlobalStocks } from '@/utils/globalStocksCache';

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

const GLOBAL_STOCKS_KEY = ['global-stocks'];
const API_BASE = `${getApiBaseUrl()}/api`;

interface ApiStock {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

// Static, hardcoded reference prices — used only as a last-resort *render*
// fallback in GlobalStocksMarket.tsx when a query has never once succeeded
// and there's no cached last-good fetch either, never stored as this
// hook's actual query data. Same role EGX_STATIC_FALLBACK plays for EGX.
export const GLOBAL_STOCKS_STATIC_FALLBACK: GlobalStockLive[] = GLOBAL_COMPANIES.map(c => (
  { ...c, price: c.fallbackPrice, change: 0, changePercent: 0, isLive: false }
));

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

// Throws on failure instead of quietly "succeeding" with fallback prices —
// same reasoning as EGX's fetchAllEGX: a silent fallback looked like a
// successful fetch to react-query (never retried), and a background
// refetch could overwrite genuinely live data with fake static numbers on
// one transient blip. Throwing lets react-query retry and keep showing the
// last real data (from the persisted cache below) instead.
async function fetchAllGlobalStocks(): Promise<GlobalStockLive[]> {
  const data = await fetchGlobalStocksViaApi();
  void saveCachedGlobalStocks(data);
  return data;
}

// Seeds the query cache with the last real fetch this device made — called
// at app module load (see app/_layout.tsx), before any screen mounts, same
// pattern as useEGXIndices.ts's hydrateEGXIndicesFromCache. Without this,
// every cold mount of the US Markets tab (and every full app restart)
// showed nothing real until a fresh network round trip landed.
export async function hydrateGlobalStocksFromCache(queryClient: QueryClient): Promise<void> {
  if (queryClient.getQueryState(GLOBAL_STOCKS_KEY)?.dataUpdatedAt) return;
  const cached = await loadCachedGlobalStocks();
  if (!cached) return;
  if (queryClient.getQueryState(GLOBAL_STOCKS_KEY)?.dataUpdatedAt) return; // a real fetch won the race
  queryClient.setQueryData(GLOBAL_STOCKS_KEY, cached);
}

// Starts the real network request at startup instead of waiting for the US
// Markets tab to mount — covers a genuine first-ever launch (no cache yet)
// the same way hydrate covers every launch after the first.
export function prefetchGlobalStocks(queryClient: QueryClient): void {
  void queryClient.prefetchQuery({
    queryKey: GLOBAL_STOCKS_KEY,
    queryFn: fetchAllGlobalStocks,
    staleTime: 60_000,
  });
}

export function useGlobalStocks() {
  const queryClient = useQueryClient();

  // Belt and braces: if a screen mounts before startup hydration finished
  // (deep link, fast resume), pull the cache in here too. No-op once real
  // data exists.
  useEffect(() => { void hydrateGlobalStocksFromCache(queryClient); }, [queryClient]);

  return useQuery<GlobalStockLive[]>({
    queryKey: GLOBAL_STOCKS_KEY,
    queryFn: fetchAllGlobalStocks,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 2,
    // No placeholderData — a hardcoded fallback list (isLive:false, every
    // stock at a stale reference price) used to render immediately on every
    // mount, including right after a full app restart, making a normal
    // "still loading" moment look identical to real (but wrong) data. The
    // cache hydration above already covers "instant, but real" for every
    // launch after the first; GlobalStocksMarket.tsx's own loading skeleton
    // covers a genuine first-ever launch with nothing cached yet.
  });
}
