import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

// EGX30 and EGX70 EWI, shown as chips above the EGX stock list. Sourced from
// the same TradingView Egypt scanner as individual stocks (see markets.ts).
// EGX 33 Shariah was investigated too — it's a real, licensed index that
// shows up in TradingView's own symbol search, but returns "not found" on
// every quote/scan endpoint available through the free public API, so it's
// left out rather than shown with a fabricated or stale number.
export function useEGXIndices() {
  const queryClient = useQueryClient();

  // Hydrates from the last real fetch this device made, via setQueryData
  // (real data, not placeholderData) — same pattern as usePrices.ts's
  // hydratePricesFromCache, scoped to this hook since indices are only
  // used here. Fixes the visible "nothing, then pop in a second later"
  // every time the EGX tab is opened cold: a fresh 30s-old fetch is both
  // instant and true, unlike a hardcoded number would be.
  useEffect(() => {
    if (queryClient.getQueryState(EGX_INDICES_KEY)?.dataUpdatedAt) return;
    loadCachedEGXIndices().then(cached => {
      if (!cached) return;
      if (queryClient.getQueryState(EGX_INDICES_KEY)?.dataUpdatedAt) return; // a real fetch won the race
      queryClient.setQueryData(EGX_INDICES_KEY, cached);
    });
  }, [queryClient]);

  return useQuery<EGXIndex[]>({
    queryKey: EGX_INDICES_KEY,
    queryFn: fetchEGXIndices,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
