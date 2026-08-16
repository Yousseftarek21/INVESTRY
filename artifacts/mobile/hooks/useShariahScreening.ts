import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/utils/api';
import {
  EGX33_SHARIAH_FALLBACK,
  SECTOR_TAG_UNRELIABLE_FALLBACK,
  DEBT_TO_MARKET_CAP_MAX_FALLBACK,
} from '@/data/egx-shariah-compliance';

export interface ShariahReference {
  egx33Shariah: string[];
  sectorTagUnreliable: string[];
  debtToMarketCapMax: number;
  listVerifiedOn: string;
  screensApplied: { activity: boolean; debt: boolean; liquidity: boolean; income: boolean };
}

// The EGX33 list is rebalanced twice a year by the exchange's own Shariah
// board. Fetching it means a rebalance is a server redeploy rather than an app
// release, so the screen stops shipping a list known to go stale.
//
// The bundled copy stays as the offline fallback — a screener that shows
// nothing without a network is worse than one showing a list that is correct
// until the next rebalance. staleTime is long because this changes twice a
// year, not twice a minute.
export function useShariahScreening() {
  const query = useQuery<ShariahReference>({
    queryKey: ['shariah-reference'],
    queryFn: async () => {
      const res = await fetch(`${getApiBaseUrl()}/api/markets/shariah`);
      if (!res.ok) throw new Error(`shariah ${res.status}`);
      return res.json();
    },
    staleTime: 12 * 60 * 60 * 1000,
    retry: 1,
  });

  const reference: ShariahReference = query.data ?? {
    egx33Shariah: EGX33_SHARIAH_FALLBACK,
    sectorTagUnreliable: SECTOR_TAG_UNRELIABLE_FALLBACK,
    debtToMarketCapMax: DEBT_TO_MARKET_CAP_MAX_FALLBACK,
    listVerifiedOn: '',
    screensApplied: { activity: true, debt: true, liquidity: false, income: false },
  };

  return { reference, isFallback: !query.data };
}
