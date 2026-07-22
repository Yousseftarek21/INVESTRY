import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';

const MAX_DAYS = 730;
const SETTLE_MS = 3000; // wait 3s after value stops changing before saving

export interface PortfolioSnapshot {
  date: string;
  value: number;
}

// Namespaced per-user, matching every other local data store (Cash,
// Holdings, Goals, RecurringIncome, price alerts) — without this, one
// account's portfolio value history would stay readable by whoever signs
// in next on the same device.
function snapshotKey(userId: string) {
  return `@investry_portfolio_snapshots_${userId}`;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Combines two sources: the server's daily cron-computed snapshot history
 * (durable — survives reinstalls and device changes, doesn't depend on ever
 * having opened the app on a particular day) and a local same-day value
 * saved as soon as it settles, so "today" shows up immediately without
 * waiting for the next cron cycle. Server rows win for any date both have.
 */
export function usePortfolioSnapshots(currentValue: number) {
  const { getToken, isSignedIn, userId } = useAuth();
  const [localStore, setLocalStore] = useState<Record<string, number>>({});
  const [serverStore, setServerStore] = useState<Record<string, number>>({});
  const latestValue = useRef(currentValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTodayRef = useRef(false);
  const loadedUserRef = useRef<string | null>(null);

  // Load local cache + fetch server history on auth state change; clear the
  // previous account's local cache on a genuine account switch.
  useEffect(() => {
    if (!isSignedIn || !userId) {
      const prevUserId = loadedUserRef.current;
      setLocalStore({});
      setServerStore({});
      loadedUserRef.current = null;
      savedTodayRef.current = false;
      if (prevUserId) AsyncStorage.removeItem(snapshotKey(prevUserId)).catch(() => null);
      return;
    }
    if (loadedUserRef.current === userId) return;

    const prevUserId = loadedUserRef.current;
    if (prevUserId && prevUserId !== userId) {
      AsyncStorage.removeItem(snapshotKey(prevUserId)).catch(() => null);
    }
    loadedUserRef.current = userId;
    savedTodayRef.current = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(snapshotKey(userId));
        setLocalStore(raw ? JSON.parse(raw) : {});
      } catch {
        setLocalStore({});
      }

      try {
        const t = await getToken();
        if (!t) return;
        const res = await apiFetch('/api/portfolio/snapshots', t);
        if (!res.ok) return;
        const rows: { date: string; totalValue: number }[] = await res.json();
        const store: Record<string, number> = {};
        rows.forEach(r => { store[r.date] = r.totalValue; });
        setServerStore(store);
      } catch { /* offline — local cache still applies */ }
    })();
  }, [isSignedIn, userId, getToken]);

  useEffect(() => { latestValue.current = currentValue; }, [currentValue]);

  // Debounced local save of today's settled value — only fires 3s after
  // currentValue stops changing, so we never save a mid-load partial total.
  useEffect(() => {
    if (!userId || currentValue <= 0 || savedTodayRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const settled = latestValue.current;
      if (settled <= 0 || savedTodayRef.current) return;
      savedTodayRef.current = true;

      try {
        const raw = await AsyncStorage.getItem(snapshotKey(userId));
        const store: Record<string, number> = raw ? JSON.parse(raw) : {};
        store[todayStr()] = settled;
        const keys = Object.keys(store).sort();
        if (keys.length > MAX_DAYS) keys.slice(0, keys.length - MAX_DAYS).forEach(k => delete store[k]);
        await AsyncStorage.setItem(snapshotKey(userId), JSON.stringify(store));
        setLocalStore(store);
      } catch { /* ignore */ }
    }, SETTLE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentValue, userId]);

  const snapshots: PortfolioSnapshot[] = Object.entries({ ...localStore, ...serverStore })
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { snapshots };
}
