import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';
import { requestNotificationPermission } from './useNotifications';
import { useStableGetToken } from './useStableGetToken';

/**
 * Registers this device's Expo push token with the backend once the user is
 * signed in, so server-triggered pushes (e.g. the gold/silver ±1% alert and
 * the daily portfolio-value ±1% alert) have somewhere to go. Runs once per
 * sign-in; harmless to re-run since the backend just upserts the latest
 * token for the user.
 *
 * Also keeps the server's portfolioAlertsEnabled/priceAlertsEnabled flags in
 * sync with the user's local "Portfolio Alerts"/"Price Alerts" toggles in
 * Settings — without this, the toggles would only affect a since-removed
 * local notification path and do nothing to the server-driven one.
 *
 * Called from the root layout, which re-renders often. Two layers of
 * protection against duplicate requests, confirmed necessary in production
 * (a burst of duplicate POST /push/register + PUT /push/preferences calls
 * within the same second, several hitting 429, ate enough of the shared
 * per-IP rate limit to 429 unrelated requests too — prices, subscription,
 * cash accounts — the actual cause of a much broader "app stopped loading
 * data" complaint): useStableGetToken fixes the root cause (Clerk's own
 * getToken has a new identity every render, which made every effect below
 * re-fire every render too), and the in-flight refs are a second line of
 * defense in case anything else ever re-triggers these effects rapidly.
 */
export function usePushRegistration(portfolioAlertsEnabled: boolean, priceAlertsEnabled: boolean) {
  const { isSignedIn, userId } = useAuth();
  const getToken = useStableGetToken();
  const registeredForUserId = useRef<string | null>(null);
  const registeringInFlight = useRef(false);
  const lastSyncedPortfolioPref = useRef<boolean | null>(null);
  const syncingPortfolioInFlight = useRef(false);
  const lastSyncedPriceAlertsPref = useRef<boolean | null>(null);
  const syncingPriceAlertsInFlight = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isSignedIn || !userId) return;
    if (registeredForUserId.current === userId) return;
    if (registeringInFlight.current) return;

    registeringInFlight.current = true;
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
      } finally {
        registeringInFlight.current = false;
      }
    })();
  }, [isSignedIn, userId, getToken]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isSignedIn || !userId) return;
    if (lastSyncedPortfolioPref.current === portfolioAlertsEnabled) return;
    if (syncingPortfolioInFlight.current) return;

    syncingPortfolioInFlight.current = true;
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
      } finally {
        syncingPortfolioInFlight.current = false;
      }
    })();
  }, [isSignedIn, userId, getToken, portfolioAlertsEnabled]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isSignedIn || !userId) return;
    if (lastSyncedPriceAlertsPref.current === priceAlertsEnabled) return;
    if (syncingPriceAlertsInFlight.current) return;

    syncingPriceAlertsInFlight.current = true;
    (async () => {
      try {
        const authToken = await getToken();
        if (!authToken) return;
        const res = await apiFetch('/api/push/preferences', authToken, {
          method: 'PUT',
          body: JSON.stringify({ priceAlertsEnabled }),
        });
        if (res.ok) lastSyncedPriceAlertsPref.current = priceAlertsEnabled;
      } catch {
        // Silent — will retry next time this value changes or the app restarts.
      } finally {
        syncingPriceAlertsInFlight.current = false;
      }
    })();
  }, [isSignedIn, userId, getToken, priceAlertsEnabled]);
}
