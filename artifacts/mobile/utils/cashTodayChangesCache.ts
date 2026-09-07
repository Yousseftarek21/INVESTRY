import AsyncStorage from '@react-native-async-storage/async-storage';
import { tradingDayKey } from '@/utils/cairoDate';

/**
 * On-disk cache of the last "today's cash changes" map we actually fetched —
 * mirrors pricesCache.ts's own reasoning almost exactly. Without this, the
 * Overview hero's Cash "Today" badge always starts from nothing: unlike the
 * Cash total itself (CashContext) and prices (this cache's own sibling), this
 * endpoint had no cache at all, so it showed a dimmed "—" on every cold
 * launch even though the previous session's figure was almost always still
 * correct a moment later.
 *
 * Unlike prices — where only the *Change fields go stale and the rest of the
 * payload (goldUsd, usdToEgp, ...) is still perfectly usable — this whole
 * payload IS a "since today's trading day opened" delta map. There's nothing
 * left to salvage once the trading day rolls over, so a cache from a
 * different day is discarded outright rather than partially reused.
 */
const CACHE_KEY_PREFIX = 'cash-today-changes-cache-v1';

interface CachedTodayChanges {
  tradingDay: string;
  data: Record<string, number>;
}

// Scoped per-user, same reasoning as CashContext's own AsyncStorage key —
// one account's today-deltas must never flash onto a different account's
// screen on a shared device.
function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}_${userId}`;
}

export async function saveCachedTodayChanges(userId: string, data: Record<string, number>): Promise<void> {
  try {
    const payload: CachedTodayChanges = { tradingDay: tradingDayKey(), data };
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(payload));
  } catch {
    /* a failed cache write must never break a successful fetch */
  }
}

/** Null when there's no cache, it's unreadable, or it's from a prior trading day. */
export async function loadCachedTodayChanges(userId: string): Promise<Record<string, number> | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTodayChanges;
    if (parsed.tradingDay !== tradingDayKey()) return null; // a new trading day — nothing here is still true
    if (!parsed.data || typeof parsed.data !== 'object') return null;
    return parsed.data;
  } catch {
    return null;
  }
}
