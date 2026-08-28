import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

/**
 * Routes a tap on any server-sent push notification to the screen it's
 * actually about, instead of just opening the app to whatever it happened to
 * be showing. Every push sent from api-server carries a `type` field in its
 * data payload (see dailySummaryCron.ts, leaderboardRankCron.ts,
 * portfolioDriftCron.ts, portfolioAlertCron.ts, userPriceAlertCron.ts,
 * routes/activity.ts) — this is the one place that maps each type to a
 * destination, so a new push type needs one new entry here rather than
 * scattered routing logic per sender. Before this, no notification of any
 * kind deep-linked anywhere — tapping any push just foregrounded the app.
 */
const DESTINATION: Record<string, string> = {
  daily_summary: '/(tabs)',
  weekly_summary: '/(tabs)',
  portfolio_alert: '/(tabs)',
  leaderboard_rank: '/leaderboard',
  competition_announcement: '/leaderboard',
  drift_alert: '/target-allocation',
  price_alert: '/price-alerts',
  activity_log: '/notifications',
};

function routeFromResponse(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data as { type?: string } | undefined;
  const destination = data?.type ? DESTINATION[data.type] : undefined;
  if (destination) router.push(destination as any);
}

export function useNotificationTapRouting(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Cold start: if the app was launched BY tapping a notification, the
    // tap happened before this listener could ever exist to catch it —
    // expo-notifications hands the same response back through this call
    // instead. The root layout/navigator needs a beat to finish mounting
    // before router.push does anything, hence the short delay here only
    // (the live listener below fires while the app is already running, so
    // it needs none).
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      setTimeout(() => routeFromResponse(response), 300);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(routeFromResponse);
    return () => sub.remove();
  }, []);
}
