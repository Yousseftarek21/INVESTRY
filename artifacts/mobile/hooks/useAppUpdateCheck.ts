import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
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
  return `@investry_update_dismissed_${version}`;
}

interface UpdateInfo {
  latestVersion: string;
  storeUrl: string;
}

export function useAppUpdateCheck() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const installed = Constants.nativeApplicationVersion;
    // Web/simulator dev builds report null here — nothing to compare against.
    if (!installed) return;

    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/config`);
        if (!res.ok) return;
        const data = await res.json() as {
          latestAppVersion?: string; iosAppStoreId?: string; androidPackage?: string;
        };
        if (!data.latestAppVersion || !isOlder(installed, data.latestAppVersion)) return;

        const alreadyDismissed = await AsyncStorage.getItem(dismissKey(data.latestAppVersion));
        if (alreadyDismissed) { setDismissed(true); return; }

        const storeUrl = Platform.OS === 'ios' && data.iosAppStoreId
          ? `https://apps.apple.com/app/id${data.iosAppStoreId}`
          : data.androidPackage
            ? `https://play.google.com/store/apps/details?id=${data.androidPackage}`
            : null;
        if (!storeUrl) return;

        setInfo({ latestVersion: data.latestAppVersion, storeUrl });
      } catch {
        // Silent — an update nudge is a nice-to-have, never worth surfacing
        // a network error over.
      }
    })();
  }, []);

  const dismiss = () => {
    if (info) AsyncStorage.setItem(dismissKey(info.latestVersion), '1').catch(() => null);
    setDismissed(true);
  };

  return { updateAvailable: !!info && !dismissed, storeUrl: info?.storeUrl ?? null, dismiss };
}
