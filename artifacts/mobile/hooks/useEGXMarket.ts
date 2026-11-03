import { useQuery } from '@tanstack/react-query';
import { EGX_COMPANIES, EGXCompany } from '@/data/egx-companies';
import { getApiBaseUrl } from '@/utils/api';

export interface EGXStockLive extends EGXCompany {
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
  pe?: number;
  dividendYield?: number;
  epsTtm?: number;
  revenueGrowthYoy?: number;
  netMargin?: number;
  roe?: number;
  debtToEquity?: number;
  priceToBook?: number;
  /** Total interest-bearing debt — the Shariah debt screen's numerator. */
  totalDebt?: number;
  currentRatio?: number;
  quickRatio?: number;
  returnOnAssets?: number;
  freeCashFlowTtm?: number;
  cashAndEquivalents?: number;
  employees?: number;
  /** Company logo (SVG URL), when the exchange data has one. */
  logoUrl?: string;
  isLive: boolean;
}

interface ServerEGXStock {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  sessionLive?: boolean;
  totalDebt?: number;
  volume?: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
  pe?: number;
  dividendYield?: number;
  epsTtm?: number;
  revenueGrowthYoy?: number;
  netMargin?: number;
  roe?: number;
  debtToEquity?: number;
  priceToBook?: number;
  currentRatio?: number;
  quickRatio?: number;
  returnOnAssets?: number;
  freeCashFlowTtm?: number;
  cashAndEquivalents?: number;
  employees?: number;
  sector?: string;
  logoUrl?: string;
}

// The exchange's sector names, mapped onto the app's sector filters — only
// used for listings that aren't in EGX_COMPANIES yet (new IPOs).
const SECTOR_MAP: Record<string, EGXCompany['sector']> = {
  'Finance': 'Financial Services',
  'Communications': 'Telecommunications',
  'Technology Services': 'Technology',
  'Electronic Technology': 'Technology',
  'Health Technology': 'Healthcare',
  'Health Services': 'Healthcare',
  'Consumer Non-Durables': 'Food & Beverage',
  'Process Industries': 'Chemicals & Fertilizers',
  'Non-Energy Minerals': 'Construction Materials',
  'Energy Minerals': 'Energy',
  'Utilities': 'Energy',
  'Transportation': 'Transportation',
  'Consumer Services': 'Hotels & Tourism',
};

// AbortSignal.timeout() isn't reliably available in React Native's JS
// engine (Hermes) — calling it can throw synchronously instead of just
// timing out the request, which would make every single fetch attempt
// fail immediately regardless of the network, every time, with no way to
// self-correct. Manual AbortController + setTimeout is the well-supported,
// guaranteed-correct equivalent.
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// Server-side fetch — same origin as every other market data call, with its
// own Twelve Data → TradingView → Stooq fallback chain (see markets.ts).
async function fetchFromServer(): Promise<EGXStockLive[]> {
  const base = getApiBaseUrl();
  // 281 companies is a much bigger payload than metals/indices — on a weak
  // connection it can hang well past what a user will wait for, and a plain
  // fetch() with no timeout just sits there instead of failing fast enough
  // to let the fallback/retry logic below actually help.
  const res = await fetch(`${base}/api/markets/stocks`, { signal: timeoutSignal(8000) });
  if (!res.ok) throw new Error(`server ${res.status}`);
  const data: ServerEGXStock[] = await res.json();
  if (!data.length || data.every(s => s.price === 0)) throw new Error('no prices');

  // The server's list is the source of truth — it includes new listings and
  // leaves out stocks that aren't trading. EGX_COMPANIES only adds the
  // curated Arabic name, sector and industry where we have them.
  const known = new Map(EGX_COMPANIES.map(c => [c.ticker, c]));
  return data
    .filter(s => s.price > 0)
    .map(s => {
      const company: EGXCompany = known.get(s.symbol) ?? {
        ticker: s.symbol,
        nameEn: s.name,
        nameAr: s.name,
        // The exchange files banks under "Finance" with everyone else.
        sector: /\b(bank|banque)\b/i.test(s.name) ? 'Banking' : (s.sector && SECTOR_MAP[s.sector]) || 'Industrial',
        industry: s.sector ?? '',
        fallbackPrice: 0,
      };
      return {
        ...company,
        price:         s.price,
        change:        s.change,
        changePercent: s.changePercent,
        volume:        s.volume,
        marketCap:     s.marketCap,
        high52w:       s.high52w,
        low52w:        s.low52w,
        pe:            s.pe,
        dividendYield: s.dividendYield,
        epsTtm:            s.epsTtm,
        revenueGrowthYoy:  s.revenueGrowthYoy,
        netMargin:         s.netMargin,
        roe:               s.roe,
        debtToEquity:      s.debtToEquity,
        priceToBook:       s.priceToBook,
        totalDebt:         s.totalDebt,
        currentRatio:      s.currentRatio,
        quickRatio:        s.quickRatio,
        returnOnAssets:    s.returnOnAssets,
        freeCashFlowTtm:   s.freeCashFlowTtm,
        cashAndEquivalents: s.cashAndEquivalents,
        employees:         s.employees,
        logoUrl:           s.logoUrl,
        // Only "live" when the exchange actually traded today. A price always
        // comes back — the last session's bar is served while EGX is shut —
        // so asserting true here made the pulsing LIVE dot claim a closed
        // market was trading. Older servers omit the field; treated as live
        // so a stale deploy can't wrongly grey the dot out.
        isLive:        s.sessionLive !== false,
      };
    });
}

// Throws on failure instead of quietly "succeeding" with static fallback
// data. A silent fallback here used to look like a successful fetch to
// react-query, so it never retried, AND on a background refetch it would
// overwrite genuinely live data with fake static numbers just because one
// request hit a transient blip. Throwing lets react-query's own retry run
// and, critically, keep showing the last real data it has instead of
// replacing it with something fake.
async function fetchAllEGX(): Promise<EGXStockLive[]> {
  return fetchFromServer();
}

export function useEGXMarket() {
  return useQuery<EGXStockLive[]>({
    queryKey: ['egx-market-full'],
    queryFn: fetchAllEGX,
    // 10s, faster than metals' 30s (usePrices.ts) — not because the server
    // is slower to cache EGX, but because scanning 281 companies genuinely
    // takes longer to complete than metals' 2-value fetch, and every stock
    // has its own visible piastre-level tick where lag is much more
    // noticeable than on a large round gold/silver price. Matches
    // markets.ts's stocksCache TTL (also 10s) — metals/pricesCache is
    // untouched, still 30s.
    staleTime: 10_000,
    refetchInterval: 10_000,
    // 2 retries (react-query's default backoff) instead of 1 — fetchAllEGX
    // now actually throws on failure (see above) instead of swallowing it,
    // so this can meaningfully help ride out one bad request instead of
    // giving up almost immediately.
    retry: 2,
    // No placeholderData: a hardcoded fake price list (isLive: false, every
    // stock at a suspicious +0.00%) used to render immediately on every cold
    // mount — including every time iOS fully restarts the app after
    // backgrounding it, which wipes the in-memory query cache — making a
    // normal "still loading" moment look identical to a real data failure.
    // Without it, isLoading genuinely reflects "no data yet" so
    // EGXMarket.tsx shows its real skeleton instead of fabricated numbers;
    // fetchAllEGX's own internal static fallback still applies if the fetch
    // genuinely fails, same as before.
  });
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function fmtMarketCap(cap?: number, currency: string = 'EGP'): string {
  if (!cap) return '—';
  if (cap >= 1_000_000_000_000) return `${(cap / 1_000_000_000_000).toFixed(1)}T ${currency}`;
  if (cap >= 1_000_000_000)     return `${(cap / 1_000_000_000).toFixed(1)}B ${currency}`;
  if (cap >= 1_000_000)         return `${(cap / 1_000_000).toFixed(0)}M ${currency}`;
  return `${cap.toLocaleString('en-EG')} ${currency}`;
}

export function fmtVolume(vol?: number): string {
  if (!vol) return '—';
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000)     return `${(vol / 1_000).toFixed(0)}K`;
  return vol.toLocaleString('en-EG');
}
