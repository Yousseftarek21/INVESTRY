import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { MarketPrices } from '@/types';
import { getApiBaseUrl } from '@/utils/api';
import { loadCachedPrices, saveCachedPrices } from '@/utils/pricesCache';

export const TROY_OZ_TO_GRAMS = 31.1035;

const API_BASE = `${getApiBaseUrl()}/api`;

// ─── Fallback (shown while loading or if all sources fail) ────────────────────

const FALLBACK: MarketPrices = {
  goldUsd: 4018,
  silverUsd: 58.5,
  usdToEgp: 51.0,
  goldChange: 0,
  goldChangePercent: 0,
  goldChangePercentEgp: 0,
  silverChange: 0,
  silverChangePercent: 0,
  silverChangePercentEgp: 0,
  lastUpdated: new Date(),
  fxRates: {
    EUR: 55.5, GBP: 65.0, TRY: 1.55, CNY: 7.05,
    CHF: 57.5, QAR: 14.0, SAR: 13.6, AED: 13.9, KWD: 166.0,
  },
};

// ─── Direct client-side fallback (used if API server unreachable) ─────────────

// Throws (rather than quietly returning FALLBACK's hardcoded numbers) when
// it can't get a real gold price from anywhere — that specifically means
// this device has no usable connection at all (our own server AND this
// direct, CORS-open fallback both failed), not just "our server is down."
// Silently substituting a fake ~$4018 gold price used to make the whole
// portfolio total compute and display as if it were real live data, with
// nothing telling the user it wasn't — the same "confident-looking wrong
// number" problem fixed everywhere else, just reachable here via total
// network loss instead of a currency-mixing bug.
// USD/EGP here is Wise, and only Wise — same rule as the server
// (markets.ts). This runs directly from the user's own phone rather than
// Render's datacenter, so it isn't subject to whatever intermittently blocks
// Wise from Render; if anything it's the more reliable of the two paths.
async function fetchMarketPricesDirect(): Promise<MarketPrices> {
  // TradingView CFD scanner — free, no key, same source the server uses
  const [tvRes, wiseRes] = await Promise.allSettled([
    fetch('https://scanner.tradingview.com/global/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://www.tradingview.com' },
      body: JSON.stringify({
        symbols: { tickers: ['TVC:GOLD', 'TVC:SILVER'] },
        columns: ['close', 'change_abs', 'change'],
      }),
    }),
    fetch('https://wise.com/rates/live?source=USD&target=EGP'),
  ]);

  let goldUsd: number | null = null;
  let silverUsd: number | null = null;

  if (tvRes.status === 'fulfilled' && tvRes.value.ok) {
    const d = await tvRes.value.json() as { data?: Array<{ s: string; d: [number, number, number] }> };
    const byS: Record<string, [number, number, number]> = {};
    for (const item of d?.data ?? []) byS[item.s] = item.d;
    const gold = byS['TVC:GOLD'];
    const silver = byS['TVC:SILVER'];
    if (gold?.[0] > 0)   goldUsd   = gold[0];
    if (silver?.[0] > 0) silverUsd = silver[0];
  }

  if (goldUsd === null) {
    throw new Error('No network — could not reach TradingView or our own API server.');
  }

  let usdToEgp = FALLBACK.usdToEgp;
  if (wiseRes.status === 'fulfilled' && wiseRes.value.ok) {
    const d = await wiseRes.value.json() as { value?: number };
    if (d?.value && d.value > 0) usdToEgp = d.value;
  }

  return {
    goldUsd,
    silverUsd: silverUsd ?? FALLBACK.silverUsd,
    usdToEgp,
    // gold[2]/silver[2] would be TradingView's raw USD change% — deliberately
    // not used here. Gold/silver are held and valued in EGP, and this
    // fallback has no historical USD/EGP rate to convert that % onto an EGP
    // basis, so leaving it at 0 is honest about what we don't know, rather
    // than showing a number that looks plausible but can be wrong (the exact
    // bug fixed server-side in markets.ts).
    goldChange: 0, goldChangePercent: 0, goldChangePercentEgp: 0,
    silverChange: 0, silverChangePercent: 0, silverChangePercentEgp: 0,
    // Those zeros mean "we don't know", not "flat today" — without this the
    // Today tile renders a confident green +0.00% off this fallback.
    changesUnknown: true,
    lastUpdated: new Date(),
    fxRates: FALLBACK.fxRates,
  };
}

// ─── Primary fetchers (via our API server — no CORS, server-side aggregation) ─

/** Throws if our own API server can't be reached — the caller decides what
 * to do about it. Kept separate from the fallback so only genuine server
 * data is ever written to the on-disk cache. */
async function fetchMarketPricesFromServer(): Promise<MarketPrices> {
  {
    const res = await fetch(`${API_BASE}/markets/prices`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return {
      goldUsd:            data.goldUsd            ?? FALLBACK.goldUsd,
      silverUsd:          data.silverUsd          ?? FALLBACK.silverUsd,
      usdToEgp:           data.usdToEgp           ?? FALLBACK.usdToEgp,
      usdToEgpChangePercent: data.usdToEgpChangePercent ?? 0,
      goldChange:         data.goldChange          ?? 0,
      goldChangePercent:  data.goldChangePercent   ?? 0,
      goldChangePercentEgp: data.goldChangePercentEgp ?? 0,
      silverChange:       data.silverChange        ?? 0,
      silverChangePercent: data.silverChangePercent ?? 0,
      silverChangePercentEgp: data.silverChangePercentEgp ?? 0,
      // Only treat the deltas as unknown when the server sends no reading at
      // all. A 0 from the server is taken at face value — when the metals
      // market is closed the day genuinely has no move yet, and 0.00% is the
      // correct thing to show rather than a placeholder.
      changesUnknown: data.goldChangePercentEgp === undefined && data.goldChangePercent === undefined,
      lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
      fxRates: data.fxRates ?? FALLBACK.fxRates,
    };
  }
}

// ─── React Query hooks ────────────────────────────────────────────────────────

export const MARKET_PRICES_KEY = ['market-prices'] as const;

async function fetchAndCacheMarketPrices(): Promise<MarketPrices> {
  try {
    const prices = await fetchMarketPricesFromServer();
    // Cache ONLY real server responses.
    //
    // This used to cache whatever fetchMarketPrices returned, including the
    // direct TradingView fallback — whose fxRates are the hardcoded FALLBACK
    // constants (EUR 55.5, GBP 65.0, KWD 166.0). A single momentary blip
    // reaching our API server therefore persisted those fabricated rates to
    // disk, and every cold open afterwards showed them on the Currencies tab
    // until a fresh fetch landed. Against live Wise rates (EUR 57.48, GBP
    // 67.72, KWD 164.59) that is plainly wrong, and it looked like the app
    // had simply stopped updating.
    void saveCachedPrices(prices);
    return prices;
  } catch {
    // Server unreachable — serve the direct sources for this render, but
    // never write them to the cache.
    return fetchMarketPricesDirect();
  }
}

// Starts the price request at app launch instead of waiting for a tab to
// mount and call useMarketPrices().
//
// This is what makes the hero real on a FIRST launch, when there's no cache to
// hydrate from. /api/markets/prices takes no auth header, so it can run
// immediately — before Clerk initialises, before any screen exists — and the
// splash then covers the round trip. Observed server latency is ~570ms against
// a ~1600ms splash, so prices are normally already in the cache by the time the
// hero first renders. If the network is slower than the splash the skeleton
// still shows; it just degrades instead of showing an invented number.
let _pricesSettled: Promise<void> | null = null;

export function prefetchMarketPrices(queryClient: QueryClient): void {
  // prefetchQuery resolves on failure as well as success, so a dead network
  // settles this promise rather than leaving it pending forever.
  _pricesSettled = queryClient.prefetchQuery({
    queryKey: MARKET_PRICES_KEY,
    queryFn: fetchAndCacheMarketPrices,
    staleTime: 30_000,
  });
}

/**
 * Resolves once the launch price fetch has settled, or after `timeoutMs` —
 * whichever comes first.
 *
 * Used to hold the splash until the hero has live data, so nothing has to
 * fill in after the user is already looking at the card. The timeout is the
 * important half: a slow or offline device must never be stuck staring at a
 * splash screen, so this always resolves and the app reveals regardless.
 */
export function whenMarketPricesSettled(timeoutMs: number): Promise<void> {
  if (!_pricesSettled) return Promise.resolve();
  if (timeoutMs <= 0) return Promise.resolve();
  return Promise.race([
    _pricesSettled.catch(() => undefined),
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
  ]);
}

// Seeds the query cache with the last prices we actually fetched, so the hero
// can render a true total on the very first frame instead of waiting on the
// network. Called once during startup (while the splash is still up), so it
// has landed long before any tab mounts.
//
// setQueryData — not placeholderData — because this IS real data: it clears
// isPlaceholderData, which is what the hero gates on. FALLBACK stays as
// placeholderData purely so non-hero consumers never see undefined; on a true
// first launch there's no cache, isPlaceholderData stays true, and the hero
// correctly shows its skeleton rather than a fabricated number.
export async function hydratePricesFromCache(queryClient: QueryClient): Promise<void> {
  if (queryClient.getQueryState(MARKET_PRICES_KEY)?.dataUpdatedAt) return; // a real fetch already won
  const cached = await loadCachedPrices();
  if (!cached) return;
  if (queryClient.getQueryState(MARKET_PRICES_KEY)?.dataUpdatedAt) return; // ...or won while we read
  queryClient.setQueryData(MARKET_PRICES_KEY, cached);
}

export function useMarketPrices() {
  const queryClient = useQueryClient();

  // Belt and braces: if a screen mounts before startup hydration finished
  // (deep link, fast resume), pull the cache in here too. No-ops once real
  // data exists.
  useEffect(() => { void hydratePricesFromCache(queryClient); }, [queryClient]);

  return useQuery({
    queryKey: MARKET_PRICES_KEY,
    queryFn: fetchAndCacheMarketPrices,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 2,
    placeholderData: FALLBACK,
  });
}

export function useGoldHistory(range: string) {
  return useQuery<number[] | null>({
    queryKey: ['gold-history', range],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/markets/gold-history?range=${encodeURIComponent(range)}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const pts = data?.points;
        return Array.isArray(pts) && pts.length >= 2 ? (pts as number[]) : null;
      } catch { return null; }
    },
    staleTime: range === '1D' ? 5 * 60_000 : 60 * 60_000,
    refetchInterval: range === '1D' ? 5 * 60_000 : false,
    retry: 1,
    placeholderData: null,
  });
}

// ─── EGP price calculators ────────────────────────────────────────────────────

export function goldPricePerGram(prices: MarketPrices, karat: '24k' | '22k' | '21k' | '18k'): number {
  const perGramUsd = prices.goldUsd / TROY_OZ_TO_GRAMS;
  const purity = karat === '24k' ? 1 : karat === '22k' ? 22 / 24 : karat === '21k' ? 0.875 : 0.75;
  return perGramUsd * purity * prices.usdToEgp;
}

export function silverPricePerGram(prices: MarketPrices): number {
  return (prices.silverUsd / TROY_OZ_TO_GRAMS) * prices.usdToEgp;
}
