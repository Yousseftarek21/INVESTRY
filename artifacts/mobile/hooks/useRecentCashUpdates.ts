import { useCallback, useEffect, useMemo, useState } from 'react';
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

const LIMIT = 8;

// Powers the "Recent updates" feed on the Cash Accounts screen — a single
// recency-sorted list across every account, each row labeled with which
// account it belongs to. There's no combined backend endpoint for this, so
// it fetches each account's own history (cheap: a handful of accounts,
// each already limited to its 5 most recent rows server-side) and merges
// them client-side.
export function useRecentCashUpdates(accounts: CashAccount[]) {
  const { getToken } = useAuth();
  const [updates, setUpdates] = useState<RecentCashUpdate[]>([]);
  const idsKey = useMemo(() => accounts.map(a => a.id).join(','), [accounts]);

  const refresh = useCallback(async () => {
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
      const merged = lists.flat().sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
      setUpdates(merged.slice(0, LIMIT));
    } catch {
      // Best-effort — this is a nice-to-have feed, not core account data.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, getToken]);

  useEffect(() => { refresh(); }, [refresh]);

  return { updates, refresh };
}
