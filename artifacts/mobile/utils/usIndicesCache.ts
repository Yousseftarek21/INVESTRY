import AsyncStorage from '@react-native-async-storage/async-storage';
import { USIndexLive } from '@/hooks/useUSIndices';

// Same reasoning as globalStocksCache.ts / egxIndicesCache.ts.
const CACHE_KEY = 'us-indices-cache-v1';

export async function saveCachedUSIndices(indices: USIndexLive[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(indices));
  } catch {
    /* a failed cache write must never break a successful fetch */
  }
}

export async function loadCachedUSIndices(): Promise<USIndexLive[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as USIndexLive[];
    if (!Array.isArray(parsed) || parsed.length < 3) return null;
    return parsed;
  } catch {
    return null;
  }
}
