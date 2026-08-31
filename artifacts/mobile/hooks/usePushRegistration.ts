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
 * Also keeps the server's portfolioAlertsEnabled/priceAlertsEnabled/
 * dailySummaryEnabled/weeklySummaryEnabled/feedbackAlertsEnabled flags in
 * sync with the user's local Settings toggles — without this, the toggles would only affect a
 * since-removed local notification path and do nothing to the server-driven
 * one (see hooks/useNotifications.ts and lib/dailySummaryCron.ts).
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
export function usePushRegistration(
  portfolioAlertsEnabled: boolean,
  priceAlertsEnabled: boolean,
  dailySummaryEnabled: boolean,
  weeklySummaryEnabled: boolean,
  feedbackAlertsEnabled: boolean,
) {
  const { isSignedIn, userId } = useAuth();
  const getToken = useStableGetToken();
  const registeredForUserId = useRef<string | null>(null);
  const registeringInFlight = useRef(false);
  const lastSyncedPortfolioPref = useRef<boolean | null>(null);
  const lastSyncedPriceAlertsPref = useRef<boolean | null>(null);
  const lastSyncedDailySummaryPref = useRef<boolean | null>(null);
  const lastSyncedWeeklySummaryPref = useRef<boolean | null>(null);
  const lastSyncedFeedbackAlertsPref = useRef<boolean | null>(null);
  const syncingPrefsInFlight = useRef(false);

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
    // Every alert boolean is a dep, not just isSignedIn/userId/getToken: this
    // used to run exactly once per sign-in, so if the very first OS
    // permission prompt (often shown before the user has any reason to say
    // yes) was denied or dismissed, registeredForUserId.current never got
    // set and nothing ever retried for the rest of that session — a user
    // could flip every Settings toggle on, feedbackAlertsEnabled etc. would
    // genuinely reach the server as true, but pushToken stayed NULL in the
    // DB forever, so the server's broadcast query silently excluded them.
    // Turning a toggle on now re-attempts permission + registration; iOS
    // only re-shows its own prompt if the status is still 'undetermined',
    // so this is silent/harmless once already granted or denied.
  }, [isSignedIn, userId, getToken, portfolioAlertsEnabled, priceAlertsEnabled, dailySummaryEnabled, weeklySummaryEnabled, feedbackAlertsEnabled]);

  // One combined effect for all four preferences: on cold mount every
  // lastSynced* ref starts null, so without batching each of the four
  // preferences would fire its own independent PUT within the same instant
  // (a real, observed pattern in production request logs). Batching into a
  // single request cuts that to one call while keeping each preference's
  // own last-synced tracking, so a later change to just one toggle still
  // only sends that one field (plus any other field still pending sync).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isSignedIn || !userId) return;
    if (syncingPrefsInFlight.current) return;

    const body: Record<string, boolean> = {};
    if (lastSyncedPortfolioPref.current !== portfolioAlertsEnabled) body.portfolioAlertsEnabled = portfolioAlertsEnabled;
    if (lastSyncedPriceAlertsPref.current !== priceAlertsEnabled) body.priceAlertsEnabled = priceAlertsEnabled;
    if (lastSyncedDailySummaryPref.current !== dailySummaryEnabled) body.dailySummaryEnabled = dailySummaryEnabled;
    if (lastSyncedWeeklySummaryPref.current !== weeklySummaryEnabled) body.weeklySummaryEnabled = weeklySummaryEnabled;
    if (lastSyncedFeedbackAlertsPref.current !== feedbackAlertsEnabled) body.feedbackAlertsEnabled = feedbackAlertsEnabled;
    if (Object.keys(body).length === 0) return;

    syncingPrefsInFlight.current = true;
    (async () => {
      try {
        const authToken = await getToken();
        if (!authToken) return;
        const res = await apiFetch('/api/push/preferences', authToken, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        if (res.ok) {
          if ('portfolioAlertsEnabled' in body) lastSyncedPortfolioPref.current = portfolioAlertsEnabled;
          if ('priceAlertsEnabled' in body) lastSyncedPriceAlertsPref.current = priceAlertsEnabled;
          if ('dailySummaryEnabled' in body) lastSyncedDailySummaryPref.current = dailySummaryEnabled;
          if ('weeklySummaryEnabled' in body) lastSyncedWeeklySummaryPref.current = weeklySummaryEnabled;
          if ('feedbackAlertsEnabled' in body) lastSyncedFeedbackAlertsPref.current = feedbackAlertsEnabled;
        }
      } catch {
        // Silent — will retry next time any of these values change or the app restarts.
      } finally {
        syncingPrefsInFlight.current = false;
      }
    })();
  }, [isSignedIn, userId, getToken, portfolioAlertsEnabled, priceAlertsEnabled, dailySummaryEnabled, weeklySummaryEnabled, feedbackAlertsEnabled]);
}
