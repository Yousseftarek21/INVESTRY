import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useAppSettings } from '@/context/AppSettingsContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const existing = (await Notifications.getPermissionsAsync()) as unknown as { status: string };
    if (existing.status === 'granted') return true;
    const result = (await Notifications.requestPermissionsAsync()) as unknown as { status: string };
    return result.status === 'granted';
  } catch {
    return false;
  }
}

const DAILY_SUMMARY_ID = 'investry_daily_summary';
const WEEKLY_REPORT_ID = 'investry_weekly_report';

async function cancelNotification(identifier: string) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const match = scheduled.find(n => n.identifier === identifier);
    if (match) await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch { /* ignore */ }
}

async function scheduleDailySummary(enabled: boolean) {
  if (Platform.OS === 'web') return;
  await cancelNotification(DAILY_SUMMARY_ID);
  if (!enabled) return;
  const granted = await requestNotificationPermission();
  if (!granted) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_SUMMARY_ID,
      content: {
        title: 'INVESTRY · Portfolio Update',
        body: 'Good morning! Check your portfolio performance for today.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9,
        minute: 0,
      },
    });
  } catch { /* ignore scheduling errors on web/simulator */ }
}

async function scheduleWeeklyReport(enabled: boolean) {
  if (Platform.OS === 'web') return;
  await cancelNotification(WEEKLY_REPORT_ID);
  if (!enabled) return;
  const granted = await requestNotificationPermission();
  if (!granted) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_REPORT_ID,
      content: {
        title: 'INVESTRY · Weekly Report',
        body: 'Your weekly investment summary is ready. See how your portfolio performed this week.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1,
        hour: 9,
        minute: 0,
      },
    });
  } catch { /* ignore scheduling errors on web/simulator */ }
}

export function useNotifications() {
  const { notifications, isLoaded } = useAppSettings();
  const prevDailyRef = useRef<boolean | null>(null);
  const prevWeeklyRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const dailyChanged = prevDailyRef.current !== notifications.dailySummary;
    const weeklyChanged = prevWeeklyRef.current !== notifications.weeklySummary;

    if (dailyChanged) {
      prevDailyRef.current = notifications.dailySummary;
      scheduleDailySummary(notifications.dailySummary);
    }
    if (weeklyChanged) {
      prevWeeklyRef.current = notifications.weeklySummary;
      scheduleWeeklyReport(notifications.weeklySummary);
    }
  }, [isLoaded, notifications.dailySummary, notifications.weeklySummary]);
}

const PORTFOLIO_ALERT_KEY = '@investry_portfolio_alert_baseline';
const ALERT_COOLDOWN_KEY = '@investry_portfolio_alert_last_sent';
const ALERT_MIN_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const SETTLE_DEBOUNCE_MS = 3000;                  // 3s after prices stop changing

export function usePortfolioAlerts(currentTotal: number, enabled: boolean = true) {
  const alertedThisSession = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTotal = useRef(currentTotal);

  // Keep ref in sync so the debounce callback always sees the latest value
  useEffect(() => { latestTotal.current = currentTotal; }, [currentTotal]);

  // Save baseline when app goes to background (real last-known stable value)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let appState = 'active';
    const sub = { remove: () => {} };
    // Expo AppState subscription API
    const handler = (next: string) => {
      if (appState === 'active' && (next === 'background' || next === 'inactive')) {
        const stable = latestTotal.current;
        if (stable > 0) {
          AsyncStorage.setItem(PORTFOLIO_ALERT_KEY, String(stable)).catch(() => {});
        }
      }
      appState = next;
    };

    const listener = AppState.addEventListener('change', handler);
    sub.remove = listener.remove;
    appState = AppState.currentState;

    return () => sub.remove();
  }, []);

  // Debounced check — only fires after currentTotal hasn't changed for 3 seconds
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!enabled) return;
    if (currentTotal <= 0) return;
    if (alertedThisSession.current) return;

    // Clear previous debounce if total changed again (prices still loading)
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      // Now check guard *synchronously* inside the timeout callback
      if (alertedThisSession.current) return;
      alertedThisSession.current = true;

      (async () => {
        try {
          const [stored, lastSentStr] = await Promise.all([
            AsyncStorage.getItem(PORTFOLIO_ALERT_KEY),
            AsyncStorage.getItem(ALERT_COOLDOWN_KEY),
          ]);
          const baseline = stored ? parseFloat(stored) : null;

          // First time? Just store baseline silently, no alert.
          if (baseline === null || baseline <= 0) {
            await AsyncStorage.setItem(PORTFOLIO_ALERT_KEY, String(currentTotal));
            return;
          }

          // Respect cooldown — don't spam if user opens/closes app repeatedly
          if (lastSentStr) {
            const lastSent = parseInt(lastSentStr, 10);
            if (Date.now() - lastSent < ALERT_MIN_INTERVAL_MS) return;
          }

          const change = (currentTotal - baseline) / baseline;
          if (Math.abs(change) < 0.01) return; // still 1% threshold

          const granted = await requestNotificationPermission();
          if (!granted) return;

          const up = change > 0;
          const pct = (Math.abs(change) * 100).toFixed(1);

          await Notifications.scheduleNotificationAsync({
            content: {
              title: up ? `Portfolio up ${pct}% ↑` : `Portfolio down ${pct}% ↓`,
              body: up
                ? `Your portfolio gained ${pct}% since your last session. Tap to review.`
                : `Your portfolio dropped ${pct}% since your last session. Tap to review.`,
              sound: true,
            },
            trigger: null,
          });

          await AsyncStorage.setItem(PORTFOLIO_ALERT_KEY, String(currentTotal));
          await AsyncStorage.setItem(ALERT_COOLDOWN_KEY, String(Date.now()));
        } catch { /* ignore */ }
      })();
    }, SETTLE_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [currentTotal]);
}
