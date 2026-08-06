import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/api';
import { REPropertyType } from '@/data/egypt-real-estate-prices';
import { loadCachedRealEstateCompounds, saveCachedRealEstateCompounds } from '@/utils/realEstateCompoundsCache';

export type RECompoundPriceSource = 'compound' | 'area_estimate' | 'none';

export interface RealEstateCompoundLive {
  id: string;
  name: string;
  developer: string;
  governorate: string;
  minPricePerM2: number | null;
  maxPricePerM2: number | null;
  avgPricePerM2: number | null;
  changePercent: number | null;
  sampleSize: number;
  type: REPropertyType;
  isLive: boolean; // true = scraped for this exact compound
  priceSource: RECompoundPriceSource;
  areaLabel: string | null; // set when priceSource === 'area_estimate'
  updatedAt: string | null;
}

const REAL_ESTATE_COMPOUNDS_KEY = ['real-estate-compound-prices'];

async function fetchRealEstateCompoundPrices(): Promise<RealEstateCompoundLive[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/markets/real-estate/compounds`);
  if (!res.ok) throw new Error(`server ${res.status}`);
  const data: RealEstateCompoundLive[] = await res.json();
  void saveCachedRealEstateCompounds(data);
  return data;
}

// Same startup pre-warming pattern as useRealEstatePrices.ts /
// usePrices.ts's hydratePricesFromCache — see app/_layout.tsx.
export async function hydrateRealEstateCompoundsFromCache(queryClient: QueryClient): Promise<void> {
  if (queryClient.getQueryState(REAL_ESTATE_COMPOUNDS_KEY)?.dataUpdatedAt) return;
  const cached = await loadCachedRealEstateCompounds();
  if (!cached) return;
  if (queryClient.getQueryState(REAL_ESTATE_COMPOUNDS_KEY)?.dataUpdatedAt) return; // a real fetch won the race
  queryClient.setQueryData(REAL_ESTATE_COMPOUNDS_KEY, cached);
}

export function prefetchRealEstateCompounds(queryClient: QueryClient): void {
  void queryClient.prefetchQuery({
    queryKey: REAL_ESTATE_COMPOUNDS_KEY,
    queryFn: fetchRealEstateCompoundPrices,
    staleTime: 2 * 60 * 60 * 1000,
  });
}

// Same cadence reasoning as useRealEstatePrices.ts — the underlying data
// only refreshes server-side twice a day.
export function useRealEstateCompoundPrices() {
  const queryClient = useQueryClient();
  useEffect(() => { void hydrateRealEstateCompoundsFromCache(queryClient); }, [queryClient]);

  return useQuery<RealEstateCompoundLive[]>({
    queryKey: REAL_ESTATE_COMPOUNDS_KEY,
    queryFn: fetchRealEstateCompoundPrices,
    staleTime: 2 * 60 * 60 * 1000,
    refetchInterval: 2 * 60 * 60 * 1000,
    retry: 1,
  });
}
