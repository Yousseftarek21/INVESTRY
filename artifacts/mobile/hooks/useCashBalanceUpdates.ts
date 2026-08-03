import { useCallback, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';

export interface CashBalanceUpdate {
  id: string;
  delta: number;
  resultingBalance: number;
  createdAt: string;
}

// Manual balance-change history for one cash account — not a transaction
// ledger (no categories, no notes), just "changed by this much, at this
// time." Fetched on demand (when the edit form for that account opens)
// rather than kept live, since it's only ever shown there.
export function useCashBalanceUpdates(accountId: string | null) {
  const { getToken } = useAuth();
  const [updates, setUpdates] = useState<CashBalanceUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!accountId) { setUpdates([]); return; }
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch(`/api/cash-accounts/${accountId}/balance-updates`, token);
      if (!res.ok) return;
      setUpdates(await res.json());
    } catch {
      // Best-effort — history is a nice-to-have, not core account data.
    } finally {
      setIsLoading(false);
    }
  }, [accountId, getToken]);

  // Records a manual balance change. Best-effort: if this fails, the
  // account's own balance (already saved separately) is unaffected — only
  // the history entry is lost, not the actual updated balance.
  const logUpdate = useCallback(async (targetAccountId: string, delta: number, resultingBalance: number) => {
    if (delta === 0) return;
    try {
      const token = await getToken();
      if (!token) return;
      await apiFetch(`/api/cash-accounts/${targetAccountId}/balance-updates`, token, {
        method: 'POST',
        body: JSON.stringify({ delta, resultingBalance }),
      });
    } catch {
      // Best-effort, see above.
    }
  }, [getToken]);

  return { updates, isLoading, refresh, logUpdate };
}
