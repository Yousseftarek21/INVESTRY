import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlobalStockLive } from '@/hooks/useGlobalStocks';

// Same reasoning as egxIndicesCache.ts: without a persisted last-good
// fetch, every cold mount of the US Markets tab (and every full app
// restart, which wipes the in-memory query cache) showed nothing real
// until a fresh network round trip landed — read as "US stocks take
// forever to load" next to EGX, which already had this for its own index
// chips. The last real fetch, shown instantly while a fresh one lands in
// the background, is both immediate and true — unlike the fallbackPrice
// placeholder list this hook used to render first on every mount.
const CACHE_KEY = 'global-stocks-cache-v1';

export async function saveCachedGlobalStocks(stocks: GlobalStockLive[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(stocks));
  } catch {
    /* a failed cache write must never break a successful fetch */
  }
}

export async function loadCachedGlobalStocks(): Promise<GlobalStockLive[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GlobalStockLive[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}
