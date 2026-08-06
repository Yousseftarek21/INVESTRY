import AsyncStorage from '@react-native-async-storage/async-storage';
import { RealEstateAreaLive } from '@/hooks/useRealEstatePrices';

// Same reasoning as egxIndicesCache.ts / usePrices.ts's pricesCache: the
// Real Estate tab had zero caching at all, so every open fetched from
// scratch with no instant fallback — real estate data only changes twice a
// day server-side, so a cached copy from hours ago is still both true and
// far better than a visible loading gap.
const CACHE_KEY = 'real-estate-prices-cache-v1';

export async function saveCachedRealEstatePrices(areas: RealEstateAreaLive[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(areas));
  } catch {
    /* a failed cache write must never break a successful fetch */
  }
}

export async function loadCachedRealEstatePrices(): Promise<RealEstateAreaLive[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RealEstateAreaLive[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}
