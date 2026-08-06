import { useEffect } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/utils/api';
import { loadCachedEGXIndices, saveCachedEGXIndices } from '@/utils/egxIndicesCache';

export interface EGXIndex {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume?: number;
}

const EGX_INDICES_KEY = ['egx-indices'];

async function fetchEGXIndices(): Promise<EGXIndex[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/markets/egx-indices`);
  if (!res.ok) throw new Error(`server ${res.status}`);
  const data: EGXIndex[] = await res.json();
  void saveCachedEGXIndices(data);
  return data;
}

// Seeds the query cache with the last indices this device actually fetched
// — called at app module load (see app/_layout.tsx), before any screen
// mounts, same pattern as usePrices.ts's hydratePricesFromCache. Without
// this, every cold mount of the EGX tab showed nothing for ~1s while the
// first fetch landed; pre-warming at startup means it's already there by
// the time the user gets to the tab.
export async function hydrateEGXIndicesFromCache(queryClient: QueryClient): Promise<void> {
  if (queryClient.getQueryState(EGX_INDICES_KEY)?.dataUpdatedAt) return;
  const cached = await loadCachedEGXIndices();
  if (!cached) return;
  if (queryClient.getQueryState(EGX_INDICES_KEY)?.dataUpdatedAt) return; // a real fetch won the race
  queryClient.setQueryData(EGX_INDICES_KEY, cached);
}

// Starts the real network request at startup instead of waiting for the EGX
// tab to mount — covers a genuine first-ever launch (no cache yet) the same
// way hydrate covers every launch after the first.
export function prefetchEGXIndices(queryClient: QueryClient): void {
  void queryClient.prefetchQuery({
    queryKey: EGX_INDICES_KEY,
    queryFn: fetchEGXIndices,
    staleTime: 30_000,
  });
}

// EGX30 and EGX70 EWI, shown as chips above the EGX stock list. Sourced from
// the same TradingView Egypt scanner as individual stocks (see markets.ts).
// EGX 33 Shariah was investigated too — it's a real, licensed index that
// shows up in TradingView's own symbol search, but returns "not found" on
// every quote/scan endpoint available through the free public API, so it's
// left out rather than shown with a fabricated or stale number.
export function useEGXIndices() {
  const queryClient = useQueryClient();

  // Belt and braces: if a screen mounts before startup hydration finished
  // (deep link, fast resume), pull the cache in here too. No-op once real
  // data exists.
  useEffect(() => { void hydrateEGXIndicesFromCache(queryClient); }, [queryClient]);

  return useQuery<EGXIndex[]>({
    queryKey: EGX_INDICES_KEY,
    queryFn: fetchEGXIndices,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
