import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';

export interface PortfolioSnapshot {
  date: string;
  value: number;
}

/**
 * The server's daily cron-computed snapshot history — durable, survives
 * reinstalls and device changes, doesn't depend on ever having opened the
 * app on a particular day, and is the single source of truth for every
 * date (no per-device local override that could drift from it).
 *
 * "Today" in the returned list can lag a few minutes behind the live total
 * (this hook only fetches once per session) — callers needing today's value
 * to track live should pass PerfChart's own `liveValue` prop, which
 * overlays the current live number onto today's entry regardless of what
 * this hook returned for it (see chartUtils.ts's snapshotsToValues).
 *
 * Deliberately no reconstruction of history before real tracking began —
 * every value here is a real observed portfolio total, TradingView-sourced
 * the same way the live 1D chart is (via the daily snapshot cron), not a
 * third-party historical-price estimate. History simply grows longer the
 * more the app is used.
 */
export function usePortfolioSnapshots() {
  const { getToken, isSignedIn, userId } = useAuth();
  const [serverStore, setServerStore] = useState<Record<string, number>>({});
  const loadedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      setServerStore({});
      loadedUserRef.current = null;
      return;
    }
    if (loadedUserRef.current === userId) return;
    loadedUserRef.current = userId;

    (async () => {
      try {
        const t = await getToken();
        if (!t) return;
        const res = await apiFetch('/api/portfolio/snapshots', t);
        if (!res.ok) return;
        const rows: { date: string; totalValue: number }[] = await res.json();
        const store: Record<string, number> = {};
        rows.forEach(r => { store[r.date] = r.totalValue; });
        setServerStore(store);
      } catch { /* offline or request failed — snapshots stay empty until next load */ }
    })();
    // Deliberately NOT depending on `getToken` — see PriceAlertsContext.tsx
    // for why an unstable Clerk callback reference in this deps array is
    // dangerous (refires every render, pegging the JS thread).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, userId]);

  const snapshots: PortfolioSnapshot[] = Object.entries(serverStore)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { snapshots };
}
