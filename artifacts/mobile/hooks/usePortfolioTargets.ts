import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';

export type AllocationClass = 'gold' | 'silver' | 'stock' | 'realEstate' | 'personalAsset' | 'fixedIncome';
export type TargetAllocation = Partial<Record<AllocationClass, number>>;

interface TargetsResponse {
  configured: boolean;
  targets?: TargetAllocation;
  driftAlertsEnabled?: boolean;
}

const QUERY_KEY = ['portfolio-targets'];

// This user's target allocation percentages, used by the Rebalancing card
// on Analytics and by the target-allocation settings screen. Saving is a
// plain PUT (not a react-query mutation, matching how the rest of the app —
// e.g. PriceAlertsContext — does writes) followed by an optimistic local
// cache update so the Analytics card reflects the new targets immediately.
export function usePortfolioTargets() {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<TargetsResponse>({
    queryKey: QUERY_KEY,
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return { configured: false };
      const res = await apiFetch('/api/portfolio/targets', token);
      if (!res.ok) throw new Error(`API ${res.status}`);
      return res.json();
    },
  });

  const save = useCallback(async (targets: TargetAllocation, driftAlertsEnabled: boolean): Promise<boolean> => {
    const token = await getToken();
    if (!token) return false;
    const res = await apiFetch('/api/portfolio/targets', token, {
      method: 'PUT',
      body: JSON.stringify({ targets, driftAlertsEnabled }),
    });
    if (!res.ok) return false;
    queryClient.setQueryData<TargetsResponse>(QUERY_KEY, { configured: true, targets, driftAlertsEnabled });
    return true;
  }, [getToken, queryClient]);

  return {
    configured: query.data?.configured ?? false,
    targets: query.data?.targets ?? {},
    driftAlertsEnabled: query.data?.driftAlertsEnabled ?? true,
    isLoading: query.isLoading,
    save,
  };
}
