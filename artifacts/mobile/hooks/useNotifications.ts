import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
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

export function usePortfolioAlerts(currentTotal: number) {
  const alertedThisSession = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (currentTotal <= 0) return;
    if (alertedThisSession.current) return;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(PORTFOLIO_ALERT_KEY);
        const baseline = stored ? parseFloat(stored) : null;

        if (baseline === null || baseline <= 0) {
          await AsyncStorage.setItem(PORTFOLIO_ALERT_KEY, String(currentTotal));
          return;
        }

        const change = (currentTotal - baseline) / baseline;
        if (Math.abs(change) < 0.01) return;

        alertedThisSession.current = true;

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
      } catch { /* ignore */ }
    })();
  }, [currentTotal]);
}
