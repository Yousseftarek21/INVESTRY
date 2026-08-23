import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@invstry_review_prompted';

/**
 * expo-store-review is a native module not yet compiled into the currently
 * shipped app binary (it was added after the last native build) — a static
 * top-level `import ... from 'expo-store-review'` throws at module-load
 * time on any device running that older binary, which crashes the entire
 * Home tab for every user the moment this file loads, not just for anyone
 * who reaches a tier promotion. A `require()` deferred until the function
 * actually runs, wrapped in try/catch, means this file is always safe to
 * ship — it silently no-ops on an old binary and works normally once a
 * build that includes the native module goes out.
 */
export async function maybeRequestReview(): Promise<void> {
  try {
    const alreadyPrompted = await AsyncStorage.getItem(KEY);
    if (alreadyPrompted) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const StoreReview = require('expo-store-review') as typeof import('expo-store-review');
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
    // Covers both a genuine review-flow failure and the native module not
    // existing yet on this binary — never let either affect anything else.
  }
}
