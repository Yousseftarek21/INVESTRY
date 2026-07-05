import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useAppSettings } from '../context/AppSettingsContext';

/**
 * Returns haptic trigger functions that respect the user's "Haptic Feedback"
 * setting. Use these instead of calling `expo-haptics` directly so the
 * Settings toggle actually controls vibration everywhere in the app.
 */
export function useHaptic() {
  const { hapticsEnabled } = useAppSettings();

  const impact = useCallback((style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  }, [hapticsEnabled]);

  const notify = useCallback((type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
    if (hapticsEnabled) Haptics.notificationAsync(type);
  }, [hapticsEnabled]);

  return { impact, notify };
}
