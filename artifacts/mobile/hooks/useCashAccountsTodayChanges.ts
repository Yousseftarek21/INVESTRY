import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';
import { loadCachedTodayChanges, saveCachedTodayChanges } from '@/utils/cashTodayChangesCache';
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

// Real fetch + cache-write, shared by the hook's own queryFn and by
// prefetchCashTodayChanges below — one place that talks to the network and
// the on-disk cache, so a launch-time prefetch and a normal in-screen fetch
// can never disagree on what "fetch this" means.
async function fetchAndCacheTodayChanges(userId: string | null | undefined, getToken: () => Promise<string | null>): Promise<Record<string, number>> {
  const token = await getToken();
  if (!token) return {};
  const res = await apiFetch('/api/cash-accounts/today-changes', token);
  if (!res.ok) return {};
  const data = await res.json();
  if (userId) void saveCachedTodayChanges(userId, data);
  return data;
}

// Seeds the query cache from the on-disk cache, same role
// hydratePricesFromCache plays for prices — lets a screen that mounts before
// the launch-time prefetch (below) has resolved still show last session's
// figure instead of the dimmed placeholder. Guarded so it never clobbers a
// real fetch that already landed first.
export async function hydrateCashTodayChangesFromCache(queryClient: QueryClient, userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  if (queryClient.getQueryState(QUERY_KEY)?.dataUpdatedAt) return; // a real fetch already won
  const cached = await loadCachedTodayChanges(userId);
  if (!cached) return;
  if (queryClient.getQueryState(QUERY_KEY)?.dataUpdatedAt) return; // ...or won while we read
  queryClient.setQueryData(QUERY_KEY, cached);
}

// Starts this fetch as early as possible — called once from CashContext's
// own auth-resolved effect, the same moment CashContext starts loading cash
// accounts, rather than waiting for the Overview screen to mount later.
// This can never start quite as early as prefetchMarketPrices (that one
// needs no auth and fires before Clerk even initializes) — this endpoint
// needs a real token first — but it still closes nearly the entire gap:
// Clerk is typically ready well before the Overview screen would otherwise
// have triggered this fetch on its own.
//
// Deliberately NOT wired into heroReady or the splash-hide logic — unlike
// prices, nothing should ever make the whole hero (or app launch) wait on
// this one badge; the existing dimmed "—" placeholder stays as the fallback
// for the rare case this hasn't resolved yet.
export function prefetchCashTodayChanges(queryClient: QueryClient, userId: string | null | undefined, getToken: () => Promise<string | null>): void {
  if (!userId) return;
  void queryClient.prefetchQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchAndCacheTodayChanges(userId, getToken),
    staleTime: 30_000,
  });
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
  const { userId } = useAuth();

  // Belt and braces: if a screen mounts before CashContext's own launch-time
  // hydrate/prefetch finished (deep link, fast resume), pull the on-disk
  // cache in here too. No-ops once real data exists — same role
  // useMarketPrices' own identical effect plays for prices.
  useEffect(() => { void hydrateCashTodayChangesFromCache(queryClient, userId); }, [queryClient, userId]);

  const query = useQuery<Record<string, number>>({
    queryKey: QUERY_KEY,
    queryFn: () => fetchAndCacheTodayChanges(userId, getToken),
    staleTime: 30_000,
  });

  const applyOptimisticDelta = useCallback(
    (accountId: string, delta: number) => applyOptimisticTodayChange(queryClient, accountId, delta),
    [queryClient],
  );

  return { todayChanges: query.data ?? {}, isLoading: query.isLoading, refresh: query.refetch, applyOptimisticDelta };
}
