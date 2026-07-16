import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_ID_KEY = '@investry_daily_notif_id';
const THROTTLE_MS = 30 * 60 * 1000; // 30 min between change alerts
const THRESHOLD = 0.01; // 1.0 %

function fmtEGP(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M EGP`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K EGP`;
  return `${Math.round(n)} EGP`;
}

/**
 * Fires a local notification when the portfolio value changes by ≥ 1.0%.
 * Also schedules a repeating daily 9 AM summary.
 * Both are gated by the `enabled` flag (Settings → Notifications → Portfolio Alerts).
 */
export function usePortfolioNotifications(totalValue: number, enabled: boolean) {
  const prevRef       = useRef<number | null>(null);
  const lastFiredRef  = useRef<number>(0);

  // ── Change alert ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || totalValue <= 0) return;

    const prev = prevRef.current;
    prevRef.current = totalValue;

    if (prev === null || prev <= 0) return;

    const pct    = (totalValue - prev) / prev;
    const absPct = Math.abs(pct);
    if (absPct < THRESHOLD) return;

    const now = Date.now();
    if (now - lastFiredRef.current < THROTTLE_MS) return;
    lastFiredRef.current = now;

    const isUp   = pct > 0;
    const sign   = isUp ? '+' : '−';
    const pctStr = `${sign}${(absPct * 100).toFixed(1)}%`;
    const delta  = fmtEGP(Math.abs(totalValue - prev));

    Notifications.scheduleNotificationAsync({
      content: {
        title: `Portfolio ${isUp ? '↑' : '↓'} ${pctStr}`,
        body:  `${isUp ? 'Gained' : 'Lost'} ${delta} · Tap to view`,
        sound: true,
      },
      trigger: null,
    }).catch(() => null);
  }, [totalValue, enabled]);

  // ── Daily 9 AM summary ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      AsyncStorage.getItem(DAILY_ID_KEY).then(id => {
        if (id) Notifications.cancelScheduledNotificationAsync(id).catch(() => null);
      });
      return;
    }

    (async () => {
      const existingId = await AsyncStorage.getItem(DAILY_ID_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => null);
      }

      const now     = new Date();
      const trigger = new Date();
      trigger.setHours(9, 0, 0, 0);
      if (trigger <= now) trigger.setDate(trigger.getDate() + 1);

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'INVESTRY — Daily Summary',
          body:  'Your portfolio snapshot is ready. Tap to check in.',
          sound: true,
        },
        trigger: { date: trigger, repeats: false } as any,
      }).catch(() => null);

      if (id) await AsyncStorage.setItem(DAILY_ID_KEY, id);
    })();
  }, [enabled]);
}
