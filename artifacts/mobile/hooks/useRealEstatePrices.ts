import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/utils/api';
import { REPropertyType } from '@/data/egypt-real-estate-prices';

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

async function fetchRealEstatePrices(): Promise<RealEstateAreaLive[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/markets/real-estate`);
  if (!res.ok) throw new Error(`server ${res.status}`);
  return res.json();
}

// Real estate prices only refresh server-side twice a day (see
// realEstatePriceCron.ts) — no reason to poll more than a fraction of that
// as often. staleTime/refetchInterval here only control how often *this
// client* re-checks, not how often the underlying data actually changes.
export function useRealEstatePrices() {
  return useQuery<RealEstateAreaLive[]>({
    queryKey: ['real-estate-prices'],
    queryFn: fetchRealEstatePrices,
    staleTime: 2 * 60 * 60 * 1000,
    refetchInterval: 2 * 60 * 60 * 1000,
    retry: 1,
  });
}
