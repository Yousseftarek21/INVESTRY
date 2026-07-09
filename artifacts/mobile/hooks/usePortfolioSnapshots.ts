import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SNAPSHOT_KEY = '@investry_portfolio_snapshots';
const MAX_DAYS = 730;

export interface PortfolioSnapshot {
  date: string;
  value: number;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function usePortfolioSnapshots(currentValue: number) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const recorded = useRef(false);

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

  useEffect(() => {
    if (currentValue <= 0 || recorded.current) return;
    recorded.current = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
        const store: Record<string, number> = raw ? JSON.parse(raw) : {};
        store[todayStr()] = currentValue;
        const keys = Object.keys(store).sort();
        if (keys.length > MAX_DAYS) keys.slice(0, keys.length - MAX_DAYS).forEach(k => delete store[k]);
        await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(store));
        setSnapshots(toSorted(store));
      } catch { /* ignore */ }
    })();
  }, [currentValue]);

  return { snapshots };
}
