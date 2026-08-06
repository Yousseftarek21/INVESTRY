import AsyncStorage from '@react-native-async-storage/async-storage';
import { RealEstateCompoundLive } from '@/hooks/useRealEstateCompoundPrices';

const CACHE_KEY = 'real-estate-compounds-cache-v1';

export async function saveCachedRealEstateCompounds(compounds: RealEstateCompoundLive[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(compounds));
  } catch {
    /* a failed cache write must never break a successful fetch */
  }
}

export async function loadCachedRealEstateCompounds(): Promise<RealEstateCompoundLive[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RealEstateCompoundLive[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}
