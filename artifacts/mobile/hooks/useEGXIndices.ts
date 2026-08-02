import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/utils/api';

export interface EGXIndex {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume?: number;
}

async function fetchEGXIndices(): Promise<EGXIndex[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/markets/egx-indices`);
  if (!res.ok) throw new Error(`server ${res.status}`);
  return res.json();
}

// EGX30 and EGX70 EWI, shown as chips above the EGX stock list. Sourced from
// the same TradingView Egypt scanner as individual stocks (see markets.ts).
// EGX 33 Shariah was investigated too — it's a real, licensed index that
// shows up in TradingView's own symbol search, but returns "not found" on
// every quote/scan endpoint available through the free public API, so it's
// left out rather than shown with a fabricated or stale number.
export function useEGXIndices() {
  return useQuery<EGXIndex[]>({
    queryKey: ['egx-indices'],
    queryFn: fetchEGXIndices,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
