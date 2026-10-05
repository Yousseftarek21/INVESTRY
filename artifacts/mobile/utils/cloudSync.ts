import AsyncStorage from '@react-native-async-storage/async-storage';

// Per-device, per-user, per-collection marker that this device has completed
// a successful sync with the server at least once. Before it's set, an empty
// server list next to a non-empty local cache means pre-cloud local data that
// still needs its one-time upload. After it's set, the server is the source
// of truth: an empty list means the items were deleted (e.g. on another
// device), and re-uploading the stale local copy would resurrect them.
// Safe because every add/update/remove in the contexts throws and rolls back
// when its request fails or can't be sent at all (no auth token), so a
// synced device never holds local-only items.
function key(collection: string, userId: string) {
  return `@investry_cloud_synced_${collection}_${userId}`;
}

export async function hasCloudSynced(collection: string, userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(collection, userId))) === '1';
  } catch {
    return false;
  }
}

export async function markCloudSynced(collection: string, userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(collection, userId), '1');
  } catch { /* best-effort — worst case the one-time upload check runs again */ }
}
