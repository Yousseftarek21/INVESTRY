import AsyncStorage from '@react-native-async-storage/async-storage';
import { MarketPrices } from '@/types';

/**
 * On-disk cache of the last market prices we actually fetched.
 *
 * The hero card can't compute a portfolio total without prices, and waiting
 * for the network meant a visible placeholder on every cold open. The old
 * alternative was worse: rendering instantly from hardcoded constants
 * (goldUsd 4018, usdToEgp 51.0) baked into the bundle, which produced a
 * confident, precise, and wrong total that silently re-animated once real
 * prices landed.
 *
 * Real prices from a minute ago are both instant AND true, which is what this
 * gives. Holdings and cash already hydrate from AsyncStorage the same way
 * (see HoldingsContext / CashContext), so prices were the only thing still
 * forcing the wait.
 *
 * Not keyed per user — market prices are global, unlike holdings.
 */
const CACHE_KEY = 'market-prices-cache-v1';

/** Anything older than this is shown as a timestamp rather than as "LIVE". */
export const PRICES_FRESH_MS = 2 * 60_000;

export async function saveCachedPrices(prices: MarketPrices): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(prices));
  } catch {
    /* a failed cache write must never break a successful fetch */
  }
}

export async function loadCachedPrices(): Promise<MarketPrices | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarketPrices;

    // lastUpdated survives JSON as a string; callers treat it as a Date.
    const revived: MarketPrices = {
      ...parsed,
      lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated) : new Date(0),
    };

    // A cache written by an older build could be missing fields added since.
    // Refusing to hydrate is always safe — the query just fetches as before.
    if (!(revived.goldUsd > 0) || !(revived.usdToEgp > 0)) return null;

    return revived;
  } catch {
    return null;
  }
}

/** True when these prices are recent enough to present as live. */
export function pricesAreFresh(lastUpdated: Date | null | undefined): boolean {
  if (!lastUpdated) return false;
  const age = Date.now() - lastUpdated.getTime();
  return age >= 0 && age < PRICES_FRESH_MS;
}
