import { Platform } from 'react-native';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';

let initialized = false;

// Requests the iOS 14+ App Tracking Transparency prompt, then initializes
// the Facebook SDK with the result — Apple requires consent before any
// tracking-capable SDK starts collecting data, so init must wait for the
// ATT response rather than running eagerly (app.json sets
// isAutoInitEnabled/autoLogAppEventsEnabled to false for this reason).
export async function initMetaSDK(): Promise<void> {
  if (initialized || Platform.OS === 'web') return;
  initialized = true;

  try {
    let trackingGranted = true;
    if (Platform.OS === 'ios') {
      const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
      trackingGranted = status === 'granted';
    }
    Settings.setAdvertiserTrackingEnabled(trackingGranted);
    Settings.setAdvertiserIDCollectionEnabled(trackingGranted);
    Settings.setAutoLogAppEventsEnabled(true);
    await Settings.initializeSDK();
    AppEventsLogger.logEvent('fb_mobile_activate_app');
  } catch {
    // Ads measurement is best-effort — never let SDK init failures affect the app.
  }
}

export function logMetaEvent(name: string, params?: Record<string, string | number>): void {
  if (Platform.OS === 'web' || !initialized) return;
  try {
    if (params) {
      AppEventsLogger.logEvent(name, params);
    } else {
      AppEventsLogger.logEvent(name);
    }
  } catch {
    // best-effort, same as initMetaSDK
  }
}
