import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@invstry_review_prompted';

/**
 * Apple's own StoreKit API silently caps how often its rating dialog can
 * actually appear (up to 3 times per 365 days per device, entirely outside
 * our control — a call here may do nothing and there is no way to detect
 * that). This is a second, stricter cap on top of that: ask at most once
 * per account, ever, and only at a genuinely positive moment — right after
 * a tier promotion — rather than repeatedly hoping the system dialog is
 * still available.
 *
 * isAvailableAsync() also resolves false for a TestFlight build, so this is
 * naturally a no-op during beta testing and only ever fires for real App
 * Store users.
 */
export async function maybeRequestReview(): Promise<void> {
  try {
    const alreadyPrompted = await AsyncStorage.getItem(KEY);
    if (alreadyPrompted) return;
    const available = await StoreReview.isAvailableAsync();
    if (!available) return;
    // Set before requesting, not after: requestReview() can resolve without
    // ever actually showing anything (Apple's own quota, or the user
    // dismissing instantly with no signal back to us either way) — there's
    // no "did it actually show" callback to gate on, so the honest contract
    // is "asked once," not "shown once."
    await AsyncStorage.setItem(KEY, 'true');
    await StoreReview.requestReview();
  } catch {
    // Never let a rating-prompt failure affect anything else in the app.
  }
}
