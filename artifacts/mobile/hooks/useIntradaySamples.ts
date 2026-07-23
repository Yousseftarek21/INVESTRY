import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';

// Namespaced per-user, matching every other local data store — without
// this, one account's intraday samples would stay readable by (and get
// overwritten by) whoever signs in next on the same device.
function storageKey(userId: string) {
  return `@investry_intraday_samples_${userId}`;
}
// Pre-namespacing key — one-time migration only, see loadOrMigrate below.
const LEGACY_KEY = '@investry_intraday_samples';
const MIN_INTERVAL_MS = 10 * 60 * 1000; // don't sample more than once per 10 minutes
const MAX_SAMPLES = 60;

// Africa/Cairo, not UTC — must match the server's cairoDateString() in
// portfolioAlertCron.ts exactly. Egypt is UTC+3, so a raw UTC date string
// disagreed with the server for ~3 hours after every Cairo midnight (the
// server had already rolled to the new day; the client hadn't), which
// could keep yesterday's intraday samples around into a "new" 1D chart.
function todayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
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
  const { userId } = useAuth();
  const [samples, setSamples] = useState<number[] | null>(null);
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) { setSamples(null); loadedRef.current = null; return; }
    loadedRef.current = null;
    (async () => {
      try {
        let raw = await AsyncStorage.getItem(storageKey(userId));
        // One-time migration: today's real samples accumulated earlier
        // under the pre-namespacing global key would otherwise be silently
        // orphaned the moment this device adopts a per-user key, resetting
        // an already-real intraday curve back to a bare 2-point line.
        if (!raw) {
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          if (legacy) {
            const legacyStored: StoredIntraday | null = JSON.parse(legacy);
            if (legacyStored && legacyStored.date === todayStr()) {
              await AsyncStorage.setItem(storageKey(userId), legacy);
              raw = legacy;
            }
            await AsyncStorage.removeItem(LEGACY_KEY);
          }
        }
        const stored: StoredIntraday | null = raw ? JSON.parse(raw) : null;
        setSamples(stored && stored.date === todayStr() ? stored.samples : null);
      } catch {
        setSamples(null);
      } finally {
        loadedRef.current = userId;
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId || loadedRef.current !== userId || totalValue <= 0) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        const stored: StoredIntraday | null = raw ? JSON.parse(raw) : null;
        const today = todayStr();

        if (!stored || stored.date !== today) {
          const fresh: StoredIntraday = {
            date: today,
            samples: startOfDayValue > 0 ? [startOfDayValue, totalValue] : [totalValue],
            lastSampleAt: Date.now(),
          };
          await AsyncStorage.setItem(storageKey(userId), JSON.stringify(fresh));
          setSamples(fresh.samples);
          return;
        }

        if (Date.now() - stored.lastSampleAt < MIN_INTERVAL_MS) return;

        const nextSamples = [...stored.samples, totalValue].slice(-MAX_SAMPLES);
        const next: StoredIntraday = { date: today, samples: nextSamples, lastSampleAt: Date.now() };
        await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
        setSamples(nextSamples);
      } catch { /* ignore */ }
    })();
  }, [totalValue, startOfDayValue, userId]);

  return samples;
}
