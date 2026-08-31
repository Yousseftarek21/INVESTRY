import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '@/utils/api';

// Compares the installed binary's own version against what the server says
// is current — deliberately Constants.nativeApplicationVersion, not
// Constants.expoConfig?.version: the former reads the actual installed
// Info.plist/AndroidManifest and can only change via a new App Store /
// Play Store build, while the latter comes from the OTA-updatable app.json
// and would make an old binary that just received a fresh OTA JS bundle
// falsely look "current" even though the native code itself is stale.
function isOlder(installed: string, latest: string): boolean {
  const a = installed.split('.').map(n => parseInt(n, 10) || 0);
  const b = latest.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

function dismissKey(version: string) {
  // Keyed by the version being dismissed, not a flat flag — dismissing the
  // "1.0.3 is out" banner must not silently suppress a real "1.0.4 is out"
  // banner once that actually ships.
  //
  // "_v2" is a deliberate one-time reset: LATEST_APP_VERSION (server-side)
  // was stuck hardcoded at "1.0.3" for a while — the exact bug this system
  // exists to prevent — so anyone who happened to see and dismiss a
  // "1.0.4 is out" nudge during that window (real or from testing) had it
  // suppressed on a false premise. Bumping the key namespace here means any
  // pre-existing dismissal is silently ignored going forward, without an
  // explicit migration step. Never bump this again casually — only for a
  // similar one-time "the previous dismissals shouldn't count" situation.
  return `@investry_update_dismissed_v2_${version}`;
}

function otaDismissKey(updateId: string) {
  return `@investry_ota_dismissed_${updateId}`;
}

interface UpdateInfo {
  latestVersion: string;
  storeUrl: string;
}

interface OtaInfo {
  updateId: string;
}

// Two independent kinds of staleness, deliberately not conflated:
//  - "native": the installed binary itself is an old build. Only a fresh
//    App Store / Play Store download fixes this — Constants.nativeApplicationVersion
//    reads the real installed Info.plist/AndroidManifest and can't be
//    changed by an OTA bundle.
//  - "ota": the binary is current, but a newer JS bundle has been published
//    since this session launched. expo-updates already fetches it silently
//    in the background on next cold start (app.json's checkAutomatically:
//    "ON_LOAD"), but a user who keeps the app running/foregrounded for days
//    without a full relaunch would sit on the stale bundle indefinitely
//    without ever seeing it. Fixed here with an explicit reloadAsync(),
//    which requires no store visit at all.
// Native takes priority when both are true: there's no point offering an
// in-app reload for a build old enough that the store update is what
// actually matters.
// Every step of the native check, captured regardless of the final
// yes/no outcome — surfaced in Settings (SmartFooter) so "why isn't the
// banner showing" has a real, on-device answer instead of another guess
// from reading the code. `step` records the LAST thing that happened, in
// order, so a screenshot alone says exactly where this stopped.
export interface UpdateDebugInfo {
  installed: string | null;
  fetchedLatestAppVersion: string | null;
  step:
    | 'no_installed_version' // Constants.nativeApplicationVersion was null — dev/simulator build, check never ran
    | 'fetch_failed'          // /api/config didn't return ok, or threw (network, DNS, etc.)
    | 'up_to_date'            // fetch succeeded, installed is not older than latest
    | 'was_dismissed'         // an update IS available but this device dismissed that exact version before
    | 'no_store_url'          // update available, but iosAppStoreId/androidPackage missing for this platform
    | 'update_available'      // everything checked out — info should be set, banner should show
    | 'checking';             // effect hasn't resolved yet
}

export function useAppUpdateCheck() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [ota, setOta] = useState<OtaInfo | null>(null);
  const [otaDismissed, setOtaDismissed] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [debug, setDebug] = useState<UpdateDebugInfo>({ installed: null, fetchedLatestAppVersion: null, step: 'checking' });

  useEffect(() => {
    const installed = Constants.nativeApplicationVersion;
    // Web/simulator dev builds report null here — nothing to compare against.
    if (!installed) { setDebug(d => ({ ...d, step: 'no_installed_version' })); return; }
    setDebug(d => ({ ...d, installed }));

    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/config`);
        if (!res.ok) { setDebug(d => ({ ...d, step: 'fetch_failed' })); return; }
        const data = await res.json() as {
          latestAppVersion?: string; iosAppStoreId?: string; androidPackage?: string;
        };
        setDebug(d => ({ ...d, fetchedLatestAppVersion: data.latestAppVersion ?? null }));
        if (!data.latestAppVersion || !isOlder(installed, data.latestAppVersion)) {
          setDebug(d => ({ ...d, step: 'up_to_date' }));
          return;
        }

        const alreadyDismissed = await AsyncStorage.getItem(dismissKey(data.latestAppVersion));
        if (alreadyDismissed) { setDismissed(true); setDebug(d => ({ ...d, step: 'was_dismissed' })); return; }

        const storeUrl = Platform.OS === 'ios' && data.iosAppStoreId
          ? `https://apps.apple.com/app/id${data.iosAppStoreId}`
          : data.androidPackage
            ? `https://play.google.com/store/apps/details?id=${data.androidPackage}`
            : null;
        if (!storeUrl) { setDebug(d => ({ ...d, step: 'no_store_url' })); return; }

        setInfo({ latestVersion: data.latestAppVersion, storeUrl });
        setDebug(d => ({ ...d, step: 'update_available' }));
      } catch {
        // Silent for the user-facing banner — an update nudge is a
        // nice-to-have, never worth surfacing a network error over. Still
        // recorded in debug so Settings can show it happened.
        setDebug(d => ({ ...d, step: 'fetch_failed' }));
      }
    })();
  }, []);

  useEffect(() => {
    // Dev/Expo Go builds don't run the updates runtime at all — calling
    // into it would throw.
    if (!Updates.isEnabled) return;

    const checkForOtaUpdate = async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;

        const updateId = result.manifest.id;
        const alreadyDismissed = await AsyncStorage.getItem(otaDismissKey(updateId));
        if (alreadyDismissed) { setOtaDismissed(true); return; }

        // Download it now so the eventual "Reload" tap is instant rather
        // than waiting on a fetch at the moment the user taps it.
        await Updates.fetchUpdateAsync();
        setOta({ updateId });
      } catch {
        // Silent, same reasoning as the native check above.
      }
    };

    checkForOtaUpdate();

    // A single check-on-mount only ever catches an update that already
    // existed the moment this screen first rendered — someone who keeps
    // the app open, or backgrounds and returns without a full relaunch,
    // across a publish would otherwise never learn about it until their
    // next cold start. Directly caused a real "why didn't I get notified"
    // report on a night with many rapid publishes. Re-checks periodically
    // while foregrounded, and immediately on every return-to-foreground,
    // so a long-lived session still converges on "latest" instead of only
    // ever reflecting what was true at launch.
    const OTA_RECHECK_MS = 5 * 60 * 1000;
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') checkForOtaUpdate();
    }, OTA_RECHECK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkForOtaUpdate();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  const dismiss = () => {
    if (info) AsyncStorage.setItem(dismissKey(info.latestVersion), '1').catch(() => null);
    setDismissed(true);
  };

  const dismissOta = () => {
    if (ota) AsyncStorage.setItem(otaDismissKey(ota.updateId), '1').catch(() => null);
    setOtaDismissed(true);
  };

  const reload = async () => {
    setReloading(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setReloading(false);
    }
  };

  const nativeUpdateAvailable = !!info && !dismissed;
  const otaUpdateAvailable = !!ota && !otaDismissed && !nativeUpdateAvailable;

  return {
    updateAvailable: nativeUpdateAvailable || otaUpdateAvailable,
    kind: nativeUpdateAvailable ? ('native' as const) : otaUpdateAvailable ? ('ota' as const) : null,
    storeUrl: info?.storeUrl ?? null,
    reload,
    reloading,
    dismiss: nativeUpdateAvailable ? dismiss : dismissOta,
    debug,
  };
}
