import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';

const QUERY_KEY = ['cash-today-changes'];

// Sum of today's manual balance-update deltas per cash account, keyed by
// cashAccountId — drives the "+/- today" badge on each account card.
//
// react-query, not a bare useEffect+useState: this used to refetch from
// scratch on every mount of the Cash Accounts screen (no cache at all),
// which is exactly why reopening it always showed a ~1s delay before the
// badges appeared. staleTime here means reopening within 30s reuses the
// already-fetched data instantly — same pattern as useMarketPrices/
// usePortfolioTargets elsewhere in this codebase — and also replaces the
// hand-rolled requestId staleness guard this hook used to need: react-query
// already dedupes/orders concurrent fetches for the same key correctly.
export function useCashAccountsTodayChanges() {
  const getToken = useStableGetToken();

  const query = useQuery<Record<string, number>>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return {};
      const res = await apiFetch('/api/cash-accounts/today-changes', token);
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 30_000,
  });

  return { todayChanges: query.data ?? {}, refresh: query.refetch };
}
