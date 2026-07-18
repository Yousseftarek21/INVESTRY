import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@investry_intraday_samples';
const MIN_INTERVAL_MS = 10 * 60 * 1000; // don't sample more than once per 10 minutes
const MAX_SAMPLES = 60;

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

interface StoredIntraday { date: string; samples: number[]; lastSampleAt: number; }

/**
 * Tracks real total-portfolio-value samples across today, so the 1D chart
 * can show a genuine curve (several real observed points) instead of a
 * single straight line between "start of day" and "now" — every value in
 * here is a real portfolio total actually seen today, never fabricated.
 * Same honesty principle as the multi-day snapshot history, just at
 * intraday granularity. Naturally starts flat early in the day and fills
 * in with real shape as you use the app throughout the day.
 */
export function useIntradaySamples(totalValue: number, startOfDayValue: number): number[] | null {
  const [samples, setSamples] = useState<number[] | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const stored: StoredIntraday | null = raw ? JSON.parse(raw) : null;
        setSamples(stored && stored.date === todayStr() ? stored.samples : null);
      } catch {
        setSamples(null);
      } finally {
        loadedRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!loadedRef.current || totalValue <= 0) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const stored: StoredIntraday | null = raw ? JSON.parse(raw) : null;
        const today = todayStr();

        if (!stored || stored.date !== today) {
          const fresh: StoredIntraday = {
            date: today,
            samples: startOfDayValue > 0 ? [startOfDayValue, totalValue] : [totalValue],
            lastSampleAt: Date.now(),
          };
          await AsyncStorage.setItem(KEY, JSON.stringify(fresh));
          setSamples(fresh.samples);
          return;
        }

        if (Date.now() - stored.lastSampleAt < MIN_INTERVAL_MS) return;

        const nextSamples = [...stored.samples, totalValue].slice(-MAX_SAMPLES);
        const next: StoredIntraday = { date: today, samples: nextSamples, lastSampleAt: Date.now() };
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
        setSamples(nextSamples);
      } catch { /* ignore */ }
    })();
  }, [totalValue, startOfDayValue]);

  return samples;
}
