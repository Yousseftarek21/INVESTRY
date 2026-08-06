import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/utils/api';
import { REPropertyType } from '@/data/egypt-real-estate-prices';

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

async function fetchRealEstateCompoundPrices(): Promise<RealEstateCompoundLive[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/markets/real-estate/compounds`);
  if (!res.ok) throw new Error(`server ${res.status}`);
  return res.json();
}

// Same cadence reasoning as useRealEstatePrices.ts — the underlying data
// only refreshes server-side twice a day.
export function useRealEstateCompoundPrices() {
  return useQuery<RealEstateCompoundLive[]>({
    queryKey: ['real-estate-compound-prices'],
    queryFn: fetchRealEstateCompoundPrices,
    staleTime: 2 * 60 * 60 * 1000,
    refetchInterval: 2 * 60 * 60 * 1000,
    retry: 1,
  });
}
