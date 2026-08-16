import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { tradingDayKey } from '@/utils/cairoDate';

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

// The app's trading day (22:00 UTC boundary) — must match the server's
// tradingDayKey() so client and server agree on which day a value belongs to.
function todayStr(): string {
  return tradingDayKey();
}

interface StoredIntraday { date: string; samples: number[]; lastSampleAt: number; startOfDay?: number; }

// startOfDayValue (totalValue - todayGain) is meant to hold still all day:
// as prices move, totalValue and todayGain move together and cancel out. So
// if it *does* shift materially, the samples already stored were measured
// against a baseline that no longer exists, and replaying them draws a shape
// that never happened. Two ways that occurs in practice:
//   - holdings are added/edited/removed, so the total jumps for a reason
//     that isn't a price move at all;
//   - the server's definition of "today" changes under the app (exactly what
//     happened when today's FX baseline moved from the trading session to
//     Cairo midnight — todayGain dropped to 0 mid-day, both chart endpoints
//     collapsed onto the same number, and the pre-existing middle samples
//     were left drawing a hump between them while the badge read 0.00%).
// Either way the right move is to drop the day's samples and start over.
// 0.5% relative, so ordinary float drift never triggers a reset.
const BASELINE_DRIFT_TOLERANCE = 0.005;

function baselineChanged(stored: StoredIntraday, startOfDayValue: number): boolean {
  // Written before this field existed — no baseline on record to trust.
  if (stored.startOfDay == null) return true;
  if (startOfDayValue <= 0) return false; // nothing meaningful to compare against yet
  return Math.abs(stored.startOfDay - startOfDayValue) / startOfDayValue > BASELINE_DRIFT_TOLERANCE;
}

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
        // Baseline checked here too, not just on write: otherwise a stale
        // series renders for the moment between mount and the write effect
        // resetting it — long enough to see the wrong curve.
        const usable = stored && stored.date === todayStr() && !baselineChanged(stored, startOfDayValue);
        setSamples(usable ? stored.samples : null);
      } catch {
        setSamples(null);
      } finally {
        loadedRef.current = userId;
      }
    })();
    // startOfDayValue is read above but deliberately not a dependency: this
    // effect hits AsyncStorage, and re-running it on every price tick would
    // mean a storage read per tick. It only needs the baseline as it stands
    // at mount; the write effect below re-checks it on every change and is
    // the authority for resetting the series.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId || loadedRef.current !== userId || totalValue <= 0) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        const stored: StoredIntraday | null = raw ? JSON.parse(raw) : null;
        const today = todayStr();

        // A new day, or the same day measured from a baseline that has since
        // moved — see baselineChanged. Both mean the stored samples describe
        // a portfolio/day that no longer exists, so start the series over
        // rather than draw a curve out of them.
        if (!stored || stored.date !== today || baselineChanged(stored, startOfDayValue)) {
          const fresh: StoredIntraday = {
            date: today,
            samples: startOfDayValue > 0 ? [startOfDayValue, totalValue] : [totalValue],
            lastSampleAt: Date.now(),
            startOfDay: startOfDayValue,
          };
          await AsyncStorage.setItem(storageKey(userId), JSON.stringify(fresh));
          setSamples(fresh.samples);
          return;
        }

        if (Date.now() - stored.lastSampleAt < MIN_INTERVAL_MS) return;

        const nextSamples = [...stored.samples, totalValue].slice(-MAX_SAMPLES);
        const next: StoredIntraday = {
          date: today,
          samples: nextSamples,
          lastSampleAt: Date.now(),
          startOfDay: stored.startOfDay,
        };
        await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
        setSamples(nextSamples);
      } catch { /* ignore */ }
    })();
  }, [totalValue, startOfDayValue, userId]);

  return samples;
}
