import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';
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
// it fetches each account's own history (cheap: a handful of accounts, each
// already limited to its 20 most recent rows server-side) and merges them
// client-side. `limit` defaults to a short at-a-glance preview (8); the
// dedicated "View All" screen passes a much larger one instead.
export function useRecentCashUpdates(accounts: CashAccount[], limit: number = DEFAULT_LIMIT) {
  const { getToken } = useAuth();
  const [updates, setUpdates] = useState<RecentCashUpdate[]>([]);
  const idsKey = useMemo(() => accounts.map(a => a.id).join(','), [accounts]);
  // refresh() is called both automatically (idsKey change) and manually
  // (right after a save) — without this, an older call that happens to
  // resolve after a newer one silently clobbers fresh data with stale data,
  // which looks like the list flickering between correct and wrong.
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!idsKey) { setUpdates([]); return; }
    const targets = idsKey.split(',').map(id => accounts.find(a => a.id === id)!).filter(Boolean);
    try {
      const token = await getToken();
      if (!token) return;
      const lists = await Promise.all(targets.map(async a => {
        const res = await apiFetch(`/api/cash-accounts/${a.id}/balance-updates`, token);
        if (!res.ok) return [];
        const rows: Array<{ id: string; delta: number; resultingBalance: number; createdAt: string }> = await res.json();
        return rows.map(r => ({ ...r, accountId: a.id, accountName: a.accountName, currency: a.currency }));
      }));
      if (requestId !== requestIdRef.current) return;
      const merged = lists.flat().sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
      setUpdates(merged.slice(0, limit));
    } catch {
      // Best-effort — this is a nice-to-have feed, not core account data.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, getToken, limit]);

  useEffect(() => { refresh(); }, [refresh]);

  return { updates, refresh };
}
