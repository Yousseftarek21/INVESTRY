import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';
import { requestNotificationPermission } from './useNotifications';

/**
 * Registers this device's Expo push token with the backend once the user is
 * signed in, so server-triggered pushes (e.g. the gold/silver ±1% alert and
 * the daily portfolio-value ±1% alert) have somewhere to go. Runs once per
 * sign-in; harmless to re-run since the backend just upserts the latest
 * token for the user.
 *
 * Also keeps the server's portfolioAlertsEnabled flag in sync with the
 * user's local "Portfolio Alerts" toggle in Settings — without this, the
 * toggle would only affect a since-removed local notification path and do
 * nothing to the server-driven one.
 */
export function usePushRegistration(portfolioAlertsEnabled: boolean) {
  const { isSignedIn, userId, getToken } = useAuth();
  const registeredForUserId = useRef<string | null>(null);
  const lastSyncedPortfolioPref = useRef<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isSignedIn || !userId) return;
    if (registeredForUserId.current === userId) return;

    (async () => {
      try {
        const granted = await requestNotificationPermission();
        if (!granted) return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        const tokenResponse = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        const token = tokenResponse.data;
        if (!token) return;

        const authToken = await getToken();
        if (!authToken) return;

        const res = await apiFetch('/api/push/register', authToken, {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        if (res.ok) registeredForUserId.current = userId;
      } catch {
        // Silent — push registration is a nice-to-have, never block app usage on it.
      }
    })();
  }, [isSignedIn, userId, getToken]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isSignedIn || !userId) return;
    if (lastSyncedPortfolioPref.current === portfolioAlertsEnabled) return;

    (async () => {
      try {
        const authToken = await getToken();
        if (!authToken) return;
        const res = await apiFetch('/api/push/preferences', authToken, {
          method: 'PUT',
          body: JSON.stringify({ portfolioAlertsEnabled }),
        });
        if (res.ok) lastSyncedPortfolioPref.current = portfolioAlertsEnabled;
      } catch {
        // Silent — will retry next time this value changes or the app restarts.
      }
    })();
  }, [isSignedIn, userId, getToken, portfolioAlertsEnabled]);
}
