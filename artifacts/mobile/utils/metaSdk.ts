import { Platform } from 'react-native';

let initialized = false;

// Loaded lazily, never at module scope. A top-level import would execute the
// native-module bindings the moment anything imports this file — which
// crashes on launch for any binary built before these modules existed (an
// older native build receiving a newer OTA bundle, e.g. 1.0.1 clients after
// the SDK was added in 1.0.2). Requiring inside the try means such a client
// simply skips ads measurement instead of failing to start, so one JS bundle
// is safe to publish to every runtime.
function loadFbsdk() {
  return require('react-native-fbsdk-next') as typeof import('react-native-fbsdk-next');
}
function loadTracking() {
  return require('expo-tracking-transparency') as typeof import('expo-tracking-transparency');
}

// Requests the iOS 14+ App Tracking Transparency prompt, then initializes
// the Facebook SDK with the result — Apple requires consent before any
// tracking-capable SDK starts collecting data, so init must wait for the
// ATT response rather than running eagerly (app.json sets
// isAutoInitEnabled/autoLogAppEventsEnabled to false for this reason).
export async function initMetaSDK(): Promise<void> {
  if (initialized || Platform.OS === 'web') return;
  initialized = true;

  try {
    const { Settings, AppEventsLogger } = loadFbsdk();

    let trackingGranted = true;
    if (Platform.OS === 'ios') {
      const { status } = await loadTracking().requestTrackingPermissionsAsync();
      trackingGranted = status === 'granted';
    }
    Settings.setAdvertiserTrackingEnabled(trackingGranted);
    Settings.setAdvertiserIDCollectionEnabled(trackingGranted);
    Settings.setAutoLogAppEventsEnabled(true);
    await Settings.initializeSDK();
    AppEventsLogger.logEvent('fb_mobile_activate_app');
  } catch {
    // Best-effort: missing native modules (older binary) or a failed init
    // must never affect the app itself.
    initialized = false;
  }
}

export function logMetaEvent(name: string, params?: Record<string, string | number>): void {
  if (Platform.OS === 'web' || !initialized) return;
  try {
    const { AppEventsLogger } = loadFbsdk();
    if (params) {
      AppEventsLogger.logEvent(name, params);
    } else {
      AppEventsLogger.logEvent(name);
    }
  } catch {
    // best-effort, same as initMetaSDK
  }
}
