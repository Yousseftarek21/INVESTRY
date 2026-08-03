import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';

// Sum of today's manual balance-update deltas per cash account, keyed by
// cashAccountId — drives the "+/- today" badge on each account card. Fetched
// once on mount and re-fetched after a save, rather than derived locally,
// since the source of truth (cash_balance_updates) lives server-side.
export function useCashAccountsTodayChanges() {
  const { getToken } = useAuth();
  const [todayChanges, setTodayChanges] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch('/api/cash-accounts/today-changes', token);
      if (!res.ok) return;
      setTodayChanges(await res.json());
    } catch {
      // Best-effort — the badge just doesn't show rather than the screen failing.
    }
  }, [getToken]);

  useEffect(() => { refresh(); }, [refresh]);

  return { todayChanges, refresh };
}
