import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';

export interface SoldHolding {
  id: string;
  originalHoldingId: string;
  type: string;
  label: string;
  quantity: number | null;
  purchaseDate: string | null;
  costBasis: number;
  saleProceeds: number;
  saleDate: string;
  realizedGainLoss: number;
  notes: string | null;
}

const QUERY_KEY = ['sold-holdings'];

// Report-style data (past sales, never edited in place), so a plain
// react-query read is enough — no offline-optimistic complexity like
// useHoldings needs for core, always-on-screen portfolio state.
export function useSoldHoldings() {
  const getToken = useStableGetToken();
  const queryClient = useQueryClient();

  const query = useQuery<SoldHolding[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const res = await apiFetch('/api/sold-holdings', token);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  return {
    soldHoldings: query.data ?? [],
    isLoading: query.isLoading,
    refresh: query.refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  };
}
