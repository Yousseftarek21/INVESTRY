import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/api';
import { REPropertyType } from '@/data/egypt-real-estate-prices';
import { loadCachedRealEstatePrices, saveCachedRealEstatePrices } from '@/utils/realEstatePricesCache';

export interface RealEstateAreaLive {
  id: string;
  governorate: string;
  area: string;
  minPricePerM2: number;
  maxPricePerM2: number;
  avgPricePerM2: number;
  changePercent: number | null;
  sampleSize: number;
  type: REPropertyType;
  isLive: boolean; // true = scraped from Property Finder, false = static estimate fallback
  updatedAt: string | null;
}

const REAL_ESTATE_PRICES_KEY = ['real-estate-prices'];

async function fetchRealEstatePrices(): Promise<RealEstateAreaLive[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/markets/real-estate`);
  if (!res.ok) throw new Error(`server ${res.status}`);
  const data: RealEstateAreaLive[] = await res.json();
  void saveCachedRealEstatePrices(data);
  return data;
}

// Called at app module load (see app/_layout.tsx) — same pattern as
// usePrices.ts's hydratePricesFromCache and useEGXIndices.ts's
// hydrateEGXIndicesFromCache. Without this the Real Estate tab had zero
// caching at all: every open fetched from scratch with a visible delay,
// even though the underlying data only changes twice a day server-side.
export async function hydrateRealEstatePricesFromCache(queryClient: QueryClient): Promise<void> {
  if (queryClient.getQueryState(REAL_ESTATE_PRICES_KEY)?.dataUpdatedAt) return;
  const cached = await loadCachedRealEstatePrices();
  if (!cached) return;
  if (queryClient.getQueryState(REAL_ESTATE_PRICES_KEY)?.dataUpdatedAt) return; // a real fetch won the race
  queryClient.setQueryData(REAL_ESTATE_PRICES_KEY, cached);
}

export function prefetchRealEstatePrices(queryClient: QueryClient): void {
  void queryClient.prefetchQuery({
    queryKey: REAL_ESTATE_PRICES_KEY,
    queryFn: fetchRealEstatePrices,
    staleTime: 2 * 60 * 60 * 1000,
  });
}

// Real estate prices only refresh server-side twice a day (see
// realEstatePriceCron.ts) — no reason to poll more than a fraction of that
// as often. staleTime/refetchInterval here only control how often *this
// client* re-checks, not how often the underlying data actually changes.
export function useRealEstatePrices() {
  const queryClient = useQueryClient();
  useEffect(() => { void hydrateRealEstatePricesFromCache(queryClient); }, [queryClient]);

  return useQuery<RealEstateAreaLive[]>({
    queryKey: REAL_ESTATE_PRICES_KEY,
    queryFn: fetchRealEstatePrices,
    staleTime: 2 * 60 * 60 * 1000,
    refetchInterval: 2 * 60 * 60 * 1000,
    retry: 1,
  });
}
