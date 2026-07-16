import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SNAPSHOT_KEY = '@investry_portfolio_snapshots';
const MAX_DAYS = 730;
const SETTLE_MS = 3000; // wait 3s after value stops changing before saving

export interface PortfolioSnapshot {
  date: string;
  value: number;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function usePortfolioSnapshots(currentValue: number) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const latestValue = useRef(currentValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTodayRef = useRef(false);

  const toSorted = (store: Record<string, number>): PortfolioSnapshot[] =>
    Object.entries(store)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
      if (raw) setSnapshots(toSorted(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, []);

  // Keep ref in sync so the debounce callback always reads the settled value
  useEffect(() => { latestValue.current = currentValue; }, [currentValue]);

  // Debounced snapshot save — only fires 3s after currentValue stops changing.
  // This ensures we never save a mid-load (partially-priced) portfolio total.
  useEffect(() => {
    if (currentValue <= 0) return;
    if (savedTodayRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const settled = latestValue.current;
      if (settled <= 0) return;
      if (savedTodayRef.current) return;
      savedTodayRef.current = true;

      try {
        const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
        const store: Record<string, number> = raw ? JSON.parse(raw) : {};
        store[todayStr()] = settled;
        const keys = Object.keys(store).sort();
        if (keys.length > MAX_DAYS) keys.slice(0, keys.length - MAX_DAYS).forEach(k => delete store[k]);
        await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(store));
        setSnapshots(toSorted(store));
      } catch { /* ignore */ }
    }, SETTLE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentValue]);

  return { snapshots };
}
