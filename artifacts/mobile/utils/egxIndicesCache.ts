import AsyncStorage from '@react-native-async-storage/async-storage';
import { EGXIndex } from '@/hooks/useEGXIndices';

// Same reasoning as pricesCache.ts: the index chips can't render without
// data, and waiting on the network on every cold mount meant a visible
// ~1s "nothing, then pop in" every time the EGX tab opened, even though
// the underlying prices had barely moved since the last time this device
// checked. The last real fetch, shown instantly while a fresh one lands in
// the background, is both immediate and true — unlike a hardcoded
// placeholder, which was already established as the wrong pattern for
// EGX stocks earlier this session.
const CACHE_KEY = 'egx-indices-cache-v1';

export async function saveCachedEGXIndices(indices: EGXIndex[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(indices));
  } catch {
    /* a failed cache write must never break a successful fetch */
  }
}

export async function loadCachedEGXIndices(): Promise<EGXIndex[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EGXIndex[];
    if (!Array.isArray(parsed) || parsed.length < 2) return null;
    return parsed;
  } catch {
    return null;
  }
}
