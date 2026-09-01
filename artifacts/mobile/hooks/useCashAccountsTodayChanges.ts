import { useCallback } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';

const QUERY_KEY = ['cash-today-changes'];

// Folds a just-applied balance delta straight into the cached today-changes
// total for one account, so the "+/- today" badge updates the instant a
// balance change is saved — not after a full round trip to log the update
// server-side and then re-fetch this endpoint, which is what every caller
// used to wait on (logBalanceUpdate(...).then(() => refreshTodayChanges())).
// That was a real, visible lag on a screen this app's UX otherwise treats as
// instant everywhere else.
//
// Exported standalone (not just returned from the hook below) so a caller
// that doesn't otherwise use this hook — RecurringIncomeContext.tsx's
// markIncomeCollected and its monthly credit processor, both of which also
// change a cash account's balance — can apply the same optimistic update
// via its own useQueryClient(), without needing to also subscribe to the
// query itself.
//
// This is optimistic, not authoritative: every caller still kicks off the
// real refetch afterward (unchanged), which reconciles this with the
// server's real number — this is only what shows in the gap between "saved"
// and "refetch landed," which is exactly the gap that was visible before.
export function applyOptimisticTodayChange(queryClient: QueryClient, accountId: string, delta: number): void {
  queryClient.setQueryData<Record<string, number>>(QUERY_KEY, prev => ({
    ...(prev ?? {}),
    [accountId]: (prev?.[accountId] ?? 0) + delta,
  }));
}

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
  const queryClient = useQueryClient();

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

  const applyOptimisticDelta = useCallback(
    (accountId: string, delta: number) => applyOptimisticTodayChange(queryClient, accountId, delta),
    [queryClient],
  );

  return { todayChanges: query.data ?? {}, isLoading: query.isLoading, refresh: query.refetch, applyOptimisticDelta };
}
