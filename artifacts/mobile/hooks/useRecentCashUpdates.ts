import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';
import { CashAccount } from '@/types';

export interface RecentCashUpdate {
  id: string;
  accountId: string;
  accountName: string;
  currency: string;
  delta: number;
  resultingBalance: number;
  createdAt: string;
}

const DEFAULT_LIMIT = 8;

// Powers the "Recent updates" feed on the Cash Accounts screen — a single
// recency-sorted list across every account, each row labeled with which
// account it belongs to. There's no combined backend endpoint for this, so
// it fetches each account's own history and merges them client-side. `limit`
// defaults to a short at-a-glance preview (8); the dedicated "View All"
// screen passes a much larger one instead — and that limit is now actually
// forwarded to each per-account request (?limit=), not just applied to the
// final client-side slice. Previously every per-account fetch silently
// stopped at the server's old hardcoded 20 regardless of what this hook
// asked for, so any account with more than 20 balance changes ever had its
// older history permanently unreachable from "View All" no matter what
// limit was passed in here.
//
// react-query, not a bare useEffect+useState: this used to refetch from
// scratch on every mount (no cache), which is why reopening the Cash
// Accounts screen always showed a ~1s delay before this list appeared.
// staleTime means reopening within 30s reuses the already-fetched data
// instantly, and also replaces the hand-rolled requestId staleness guard
// this hook used to need — react-query already dedupes/orders concurrent
// fetches for the same key correctly.
export function useRecentCashUpdates(accounts: CashAccount[], limit: number = DEFAULT_LIMIT) {
  const getToken = useStableGetToken();
  const idsKey = useMemo(() => accounts.map(a => a.id).join(','), [accounts]);

  const query = useQuery<RecentCashUpdate[]>({
    queryKey: ['recent-cash-updates', idsKey, limit],
    enabled: !!idsKey,
    queryFn: async () => {
      const targets = idsKey.split(',').map(id => accounts.find(a => a.id === id)!).filter(Boolean);
      const token = await getToken();
      if (!token) return [];
      const lists = await Promise.all(targets.map(async a => {
        const res = await apiFetch(`/api/cash-accounts/${a.id}/balance-updates?limit=${limit}`, token);
        if (!res.ok) return [];
        const rows: Array<{ id: string; delta: number; resultingBalance: number; createdAt: string }> = await res.json();
        return rows.map(r => ({ ...r, accountId: a.id, accountName: a.accountName, currency: a.currency }));
      }));
      const merged = lists.flat().sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
      return merged.slice(0, limit);
    },
    staleTime: 30_000,
  });

  return { updates: query.data ?? [], isLoading: query.isLoading, refresh: query.refetch };
}
