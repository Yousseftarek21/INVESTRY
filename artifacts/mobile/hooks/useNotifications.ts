import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

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

// The daily/weekly summary notifications used to be scheduled locally on the
// device here, with the content hardcoded at schedule time — e.g. "Good
// morning! Check your portfolio performance for today.", the same string
// every single day regardless of what actually happened, because a local
// notification's content is fixed when it's scheduled and a device has no
// way to compute a fresh percentage each morning. That's now a real
// server-sent push instead (see api-server/src/lib/dailySummaryCron.ts),
// gated on dailySummaryEnabled/weeklySummaryEnabled and synced from the
// Settings toggles by usePushRegistration.ts — matching how
// portfolioAlerts/priceAlerts already work. Nothing left to schedule here.
