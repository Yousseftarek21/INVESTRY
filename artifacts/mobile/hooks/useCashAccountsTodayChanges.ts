import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';

// Sum of today's manual balance-update deltas per cash account, keyed by
// cashAccountId — drives the "+/- today" badge on each account card. Fetched
// once on mount and re-fetched after a save, rather than derived locally,
// since the source of truth (cash_balance_updates) lives server-side.
export function useCashAccountsTodayChanges() {
  const { getToken } = useAuth();
  const [todayChanges, setTodayChanges] = useState<Record<string, number>>({});
  // Guards against an older refresh() resolving after a newer one and
  // clobbering fresh data with stale data — see the identical comment in
  // useRecentCashUpdates, which this hook is called alongside.
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch('/api/cash-accounts/today-changes', token);
      if (!res.ok) return;
      const data = await res.json();
      if (requestId !== requestIdRef.current) return;
      setTodayChanges(data);
    } catch {
      // Best-effort — the badge just doesn't show rather than the screen failing.
    }
  }, [getToken]);

  useEffect(() => { refresh(); }, [refresh]);

  return { todayChanges, refresh };
}
