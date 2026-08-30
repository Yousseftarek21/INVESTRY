import { useEffect } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/utils/api';
import { loadCachedUSIndices, saveCachedUSIndices } from '@/utils/usIndicesCache';

export interface USIndexMeta {
  symbol: string;
  name: string;
  short: string;
  fallbackPrice: number;
}

// Real index metadata — same 3 indices and names TradingView's own "Indices"
// panel shows. Descriptions are localized (see i18n's usIndexSpxDesc/
// usIndexDjiDesc/usIndexNdxDesc), looked up by symbol in GlobalStocksMarket's
// index card rather than hardcoded here.
export const US_INDICES: USIndexMeta[] = [
  { symbol: 'SPX', name: 'S&P 500', short: 'S&P 500', fallbackPrice: 7715 },
  { symbol: 'DJI', name: 'Dow 30', short: 'Dow 30', fallbackPrice: 53550 },
  { symbol: 'NDX', name: 'Nasdaq 100', short: 'Nasdaq 100', fallbackPrice: 29450 },
];

export interface USIndexLive extends USIndexMeta {
  price: number;
  change: number;
  changePercent: number;
  isLive: boolean;
}

const API_BASE = `${getApiBaseUrl()}/api`;

interface ApiIndex {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

// Static, hardcoded reference prices — last-resort *render* fallback only
// (GlobalStocksMarket.tsx), never stored as this hook's actual query data.
export function usIndicesStaticFallback(): USIndexLive[] {
  return US_INDICES.map(idx => ({
    ...idx,
    price: idx.fallbackPrice,
    change: 0,
    changePercent: 0,
    isLive: false,
  }));
}

async function fetchUSIndicesViaApi(): Promise<USIndexLive[]> {
  const res = await fetch(`${API_BASE}/markets/us-indices`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data: ApiIndex[] = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('empty');

  const bySymbol = new Map(data.map(i => [i.symbol, i]));

  return US_INDICES.map(meta => {
    const d = bySymbol.get(meta.symbol);
    if (!d || !d.price) return { ...meta, price: meta.fallbackPrice, change: 0, changePercent: 0, isLive: false };
    return {
      ...meta,
      price: d.price,
      change: d.change,
      changePercent: d.changePercent,
      isLive: true,
    };
  });
}

const US_INDICES_KEY = ['us-indices'];

// Throws on failure instead of quietly falling back to fallbackPrice — see
// useGlobalStocks.ts's fetchAllGlobalStocks for the same reasoning: a
// silent fallback looks like a successful fetch to react-query (never
// retries) and can overwrite real live data with static numbers on one
// transient blip.
async function fetchAllUSIndices(): Promise<USIndexLive[]> {
  const data = await fetchUSIndicesViaApi();
  void saveCachedUSIndices(data);
  return data;
}

// Same startup pre-warming pattern as useGlobalStocks.ts/useEGXIndices.ts —
// see those for the full reasoning.
export async function hydrateUSIndicesFromCache(queryClient: QueryClient): Promise<void> {
  if (queryClient.getQueryState(US_INDICES_KEY)?.dataUpdatedAt) return;
  const cached = await loadCachedUSIndices();
  if (!cached) return;
  if (queryClient.getQueryState(US_INDICES_KEY)?.dataUpdatedAt) return;
  queryClient.setQueryData(US_INDICES_KEY, cached);
}

export function prefetchUSIndices(queryClient: QueryClient): void {
  void queryClient.prefetchQuery({
    queryKey: US_INDICES_KEY,
    queryFn: fetchAllUSIndices,
    staleTime: 30_000,
  });
}

export function useUSIndices() {
  const queryClient = useQueryClient();
  useEffect(() => { void hydrateUSIndicesFromCache(queryClient); }, [queryClient]);

  return useQuery<USIndexLive[]>({
    queryKey: US_INDICES_KEY,
    queryFn: fetchAllUSIndices,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 2,
    // No placeholderData — see useGlobalStocks.ts's own reasoning.
  });
}
