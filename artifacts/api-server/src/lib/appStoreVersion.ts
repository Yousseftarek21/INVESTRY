import { logger } from "./logger";

// Auto-detects the App Store's currently LIVE version instead of relying on
// a hand-edited constant — the exact bug this replaces: config.ts's
// LATEST_APP_VERSION was hardcoded and simply never got bumped when 1.0.4
// shipped, so the in-app update banner (UpdateAvailableBanner.tsx) silently
// never fired for 1.0.3 users despite 1.0.4 being live for days.
//
// Uses Apple's public, unauthenticated App Store lookup API — no API key,
// no App Store Connect credentials needed. Deliberately reads the LIVE
// version (what's actually downloadable right now), not "approved" —
// there can be a real gap between Apple approving a build and it actually
// going live if the developer chose manual release, and prompting someone
// to update to a version they can't yet download would be worse than the
// original bug.
//
//   https://itunes.apple.com/lookup?id=<appStoreId> -> results[0].version
const CACHE_TTL_MS = 60 * 60_000; // 1h — new App Store releases don't happen more than a few times a month, no need to poll more often than this

interface CacheEntry { version: string; ts: number }
let cache: CacheEntry | null = null;

export async function getLatestIosVersion(appStoreId: string, fallback: string): Promise<string> {
  if (cache && Date.now() - cache.ts <= CACHE_TTL_MS) return cache.version;

  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${appStoreId}`);
    if (!res.ok) throw new Error(`itunes lookup failed: ${res.status}`);
    const data = (await res.json()) as { results?: { version?: string }[] };
    const version = data.results?.[0]?.version;
    if (!version) throw new Error("itunes lookup returned no version");

    cache = { version, ts: Date.now() };
    return version;
  } catch (err) {
    // Never breaks the update-check feature over a flaky Apple API call —
    // falls back to the last known-good cached value if there is one
    // (even if slightly stale), otherwise the hardcoded fallback the
    // caller supplies.
    logger.warn({ err }, "getLatestIosVersion: itunes lookup failed, using fallback");
    return cache?.version ?? fallback;
  }
}
