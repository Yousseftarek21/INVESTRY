import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Bumped manually whenever there's a new "What's New" entry worth showing —
// deliberately not tied to app.json's version (that's purely an OTA-runtime
// targeting mechanism, bumped back and forth on every single push) or to
// individual OTA update IDs (most pushes are small fixes, not release-note
// material). This is the one place that controls when the modal reappears.
export const WHATS_NEW_VERSION = '2026-09-04-pro-plans';

const SEEN_KEY = '@investry_whats_new_seen';

// Shows once per bumped WHATS_NEW_VERSION, and never on a brand-new
// install (nothing to say "what's new" relative to) — only once the user
// has already seen some version and a newer one has shipped since.
export function useWhatsNew() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(SEEN_KEY);
        if (seen === null) {
          // First-ever launch — nothing to compare against, just record the
          // current version so the NEXT bump is what triggers the modal.
          await AsyncStorage.setItem(SEEN_KEY, WHATS_NEW_VERSION);
          return;
        }
        if (seen !== WHATS_NEW_VERSION) setVisible(true);
      } catch {
        // Silent — a missed "what's new" isn't worth surfacing an error over.
      }
    })();
  }, []);

  const dismiss = () => {
    AsyncStorage.setItem(SEEN_KEY, WHATS_NEW_VERSION).catch(() => null);
    setVisible(false);
  };

  return { visible, dismiss };
}
