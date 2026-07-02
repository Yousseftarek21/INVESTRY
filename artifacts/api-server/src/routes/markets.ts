import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; ts: number; }

function makeCache<T>(ttlMs: number) {
  let entry: CacheEntry<T> | null = null;
  return {
    get(): T | null {
      if (!entry || Date.now() - entry.ts > ttlMs) return null;
      return entry.data;
    },
    set(data: T) { entry = { data, ts: Date.now() }; },
  };
}

const pricesCache    = makeCache<MarketPricesResponse>(30_000);   // 30 s
const historicalCache = makeCache<HistoricalRates>(86_400_000);   // 24 h
const stocksCache    = makeCache<EGXStockResponse[]>(30_000);     // 30 s

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketPricesResponse {
  goldUsd: number;
  silverUsd: number;
  usdToEgp: number;
  goldChange: number;
  goldChangePercent: number;
  silverChange: number;
  silverChangePercent: number;
  goldEgpPerGram: Record<string, number>;
  silverEgpPerGram: number;
  lastUpdated: string;
  sources: string[];
}

interface EGXStockResponse {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

interface HistoricalRates {
  xauClose: number;
  xagClose: number;
  date: string;
}

// ─── EGX ticker list ──────────────────────────────────────────────────────────

const EGX_TICKERS = [
  { yahoo: "COMI.CA",  symbol: "COMI",  name: "Commercial Intl Bank"      },
  { yahoo: "HRHO.CA",  symbol: "HRHO",  name: "EFG Hermes Holding"         },
  { yahoo: "TMGH.CA",  symbol: "TMGH",  name: "Talaat Moustafa Group"      },
  { yahoo: "ORWE.CA",  symbol: "ORWE",  name: "Oriental Weavers"           },
  { yahoo: "EAST.CA",  symbol: "EAST",  name: "Eastern Company"            },
  { yahoo: "ORAS.CA",  symbol: "ORAS",  name: "Orascom Construction"       },
  { yahoo: "CLHO.CA",  symbol: "CLHO",  name: "Cleopatra Hospital"         },
  { yahoo: "EKHO.CA",  symbol: "EKHO",  name: "EK Holding"                 },
  { yahoo: "SWDY.CA",  symbol: "SWDY",  name: "El Sewedy Electric"         },
  { yahoo: "FWRY.CA",  symbol: "FWRY",  name: "Fawry Banking & Payment"    },
  { yahoo: "PHDC.CA",  symbol: "PHDC",  name: "Palm Hills Developments"    },
  { yahoo: "MNHD.CA",  symbol: "MNHD",  name: "Madinet Nasr Housing"       },
  { yahoo: "JUFO.CA",  symbol: "JUFO",  name: "Juhayna Food Industries"    },
  { yahoo: "ESRS.CA",  symbol: "ESRS",  name: "Ezz Steel"                  },
  { yahoo: "GAMA.CA",  symbol: "GAMA",  name: "Ghabbour Auto"              },
  { yahoo: "HDBK.CA",  symbol: "HDBK",  name: "Housing & Development Bank" },
  { yahoo: "ABUK.CA",  symbol: "ABUK",  name: "Abu Kir Fertilizers"        },
  { yahoo: "SPMD.CA",  symbol: "SPMD",  name: "Speed Medical"              },
  { yahoo: "CIRA.CA",  symbol: "CIRA",  name: "CIRA Education"             },
  { yahoo: "OCDI.CA",  symbol: "OCDI",  name: "Orascom Development Egypt"  },
];

const TROY_OZ = 31.1034768;  // exact grams per troy ounce
const PURITY: Record<string, number> = {
  "24k": 1,
  "22k": 22 / 24,   // 91.6667%
  "21k": 21 / 24,   // 87.5000%
  "18k": 18 / 24,   // 75.0000%
};

const FALLBACK_GOLD   = 4018;
const FALLBACK_SILVER = 58.5;
const FALLBACK_EGP    = 51.0;

const COMMODITY_API_BASE = "https://api.commoditypriceapi.com/v2";

// Yahoo Finance spark endpoint
const YF_SPARK_BASE = "https://query1.finance.yahoo.com/v7/finance/spark";

const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeFetch(url: string, opts?: RequestInit): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch { return null; }
}

async function safeJson<T>(res: Response | null): Promise<T | null> {
  if (!res?.ok) return null;
  try { return await res.json() as T; } catch { return null; }
}

function round2(n: number) { return Math.round(n * 100) / 100; }

function yesterdayDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── CommodityPriceAPI — latest metals ────────────────────────────────────────

interface CommodityLatestResponse {
  success: boolean;
  timestamp: number;
  rates: { XAU?: number; XAG?: number };
}

async function fetchCommodityLatest(): Promise<{ xau: number; xag: number } | null> {
  const key = process.env.COMMODITY_API_KEY;
  if (!key) { logger.warn("COMMODITY_API_KEY not set"); return null; }

  const url = `${COMMODITY_API_BASE}/rates/latest?apiKey=${key}&symbols=XAU,XAG`;
  const data = await safeJson<CommodityLatestResponse>(await safeFetch(url));

  if (!data?.success || !data.rates) {
    logger.warn({ data }, "CommodityPriceAPI latest: unexpected response");
    return null;
  }

  const xau = data.rates.XAU;
  const xag = data.rates.XAG;
  if (!xau || !xag || xau <= 0 || xag <= 0) return null;

  return { xau, xag };
}

// ─── CommodityPriceAPI — historical (yesterday close) for 24 h change ─────────

interface CommodityHistoricalResponse {
  success: boolean;
  date: string;
  rates: {
    XAU?: { open: number; high: number; low: number; close: number };
    XAG?: { open: number; high: number; low: number; close: number };
  };
}

async function fetchCommodityHistorical(): Promise<HistoricalRates | null> {
  const cached = historicalCache.get();
  if (cached) return cached;

  const key = process.env.COMMODITY_API_KEY;
  if (!key) return null;

  const date = yesterdayDate();
  const url = `${COMMODITY_API_BASE}/rates/historical?apiKey=${key}&symbols=XAU,XAG&date=${date}`;
  const data = await safeJson<CommodityHistoricalResponse>(await safeFetch(url));

  if (!data?.success || !data.rates?.XAU || !data.rates?.XAG) {
    logger.warn({ data }, "CommodityPriceAPI historical: unexpected response");
    return null;
  }

  const result: HistoricalRates = {
    xauClose: data.rates.XAU.close,
    xagClose: data.rates.XAG.close,
    date: data.date,
  };

  historicalCache.set(result);
  return result;
}

// ─── USD → EGP exchange rate ───────────────────────────────────────────────────
// CommodityPriceAPI has no FX pairs, so we fetch the mid-market rate from:
//   1. Wise   — real-time mid-market (same as XE / Google Finance)
//   2. fawazahmed0 (jsdelivr CDN)  — daily, no key
//   3. fawazahmed0 (CF pages CDN)  — daily, no key (alternate CDN)
//   4. open.er-api.com             — daily, no key (last resort)
//   5. hardcoded fallback

interface WiseRateResponse { source: string; target: string; value: number; time: number }
interface Fawaz0Response { date: string; usd: { egp: number } }
interface ErApiResponse  { rates: { EGP: number } }

async function fetchUsdToEgp(): Promise<number> {
  // 1. Wise real-time mid-market rate (updates every few seconds)
  const wise = await safeJson<WiseRateResponse>(
    await safeFetch("https://wise.com/rates/live?source=USD&target=EGP")
  );
  if (wise?.value && wise.value > 0) {
    logger.info({ rate: wise.value, ts: wise.time }, "USD/EGP from Wise");
    return wise.value;
  }

  // 2. fawazahmed0 via jsDelivr CDN (daily, highly accurate)
  const fawaz1 = await safeJson<Fawaz0Response>(
    await safeFetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json")
  );
  if (fawaz1?.usd?.egp && fawaz1.usd.egp > 0) return fawaz1.usd.egp;

  // 3. fawazahmed0 via Cloudflare Pages CDN (alternate)
  const fawaz2 = await safeJson<Fawaz0Response>(
    await safeFetch("https://latest.currency-api.pages.dev/v1/currencies/usd.json")
  );
  if (fawaz2?.usd?.egp && fawaz2.usd.egp > 0) return fawaz2.usd.egp;

  // 4. open.er-api.com (daily)
  const er = await safeJson<ErApiResponse>(
    await safeFetch("https://open.er-api.com/v6/latest/USD")
  );
  if (er?.rates?.EGP && er.rates.EGP > 0) return er.rates.EGP;

  return FALLBACK_EGP;
}

// ─── Assemble prices ──────────────────────────────────────────────────────────

async function fetchPrices(): Promise<MarketPricesResponse> {
  const [latest, historical, usdToEgp] = await Promise.all([
    fetchCommodityLatest(),
    fetchCommodityHistorical(),
    fetchUsdToEgp(),
  ]);

  const goldUsd   = latest?.xau   ?? FALLBACK_GOLD;
  const silverUsd = latest?.xag   ?? FALLBACK_SILVER;

  const goldChange    = historical ? round2(goldUsd   - historical.xauClose) : 0;
  const goldChangePct = historical && historical.xauClose > 0
    ? round2((goldChange / historical.xauClose) * 100) : 0;

  const silverChange    = historical ? round2(silverUsd - historical.xagClose) : 0;
  const silverChangePct = historical && historical.xagClose > 0
    ? round2((silverChange / historical.xagClose) * 100) : 0;

  // Exact formula per user spec:
  //   Step 1 — 24K (EGP/g) = (GoldOzUSD × USD_EGP) / 31.1034768
  //   Step 2 — 22K = 24K × 22/24 | 21K = 24K × 21/24 | 18K = 24K × 18/24
  const price24k = round2((goldUsd * usdToEgp) / TROY_OZ);
  const goldEgpPerGram: Record<string, number> = {
    "24k": price24k,
    "22k": round2(price24k * (22 / 24)),
    "21k": round2(price24k * (21 / 24)),
    "18k": round2(price24k * (18 / 24)),
  };
  const silverEgpPerGram = round2((silverUsd * usdToEgp) / TROY_OZ);

  // Round usdToEgp to 4dp so the displayed rate is precise enough
  // that consumers can verify the gram-price calculation themselves.
  const usdToEgpDisplay = Math.round(usdToEgp * 10000) / 10000;

  const sources: string[] = latest ? ["commoditypriceapi.com"] : ["fallback"];

  return {
    goldUsd:             round2(goldUsd),
    silverUsd:           round2(silverUsd),
    usdToEgp:            usdToEgpDisplay,
    goldChange,
    goldChangePercent:   goldChangePct,
    silverChange,
    silverChangePercent: silverChangePct,
    goldEgpPerGram,
    silverEgpPerGram,
    lastUpdated: new Date().toISOString(),
    sources,
  };
}

// ─── EGX Stocks via Yahoo Finance Spark endpoint ──────────────────────────────

interface SparkMeta {
  currency: string;
  symbol: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
}

interface SparkResponse {
  spark: {
    result: Array<{
      symbol: string;
      response: Array<{
        meta: SparkMeta;
        indicators: {
          quote: Array<{ close: (number | null)[] }>;
        };
      }>;
    }> | null;
  };
}

async function fetchStocks(): Promise<EGXStockResponse[]> {
  const batch1 = EGX_TICKERS.slice(0, 10).map(t => t.yahoo).join(",");
  const batch2 = EGX_TICKERS.slice(10).map(t => t.yahoo).join(",");

  const [res1, res2] = await Promise.all([
    safeJson<SparkResponse>(
      await safeFetch(`${YF_SPARK_BASE}?symbols=${encodeURIComponent(batch1)}&range=5d&interval=1d`, {
        headers: BASE_HEADERS,
      })
    ),
    safeJson<SparkResponse>(
      await safeFetch(`${YF_SPARK_BASE}?symbols=${encodeURIComponent(batch2)}&range=5d&interval=1d`, {
        headers: BASE_HEADERS,
      })
    ),
  ]);

  const allResults = [
    ...(res1?.spark?.result ?? []),
    ...(res2?.spark?.result ?? []),
  ];

  if (allResults.length === 0) {
    logger.warn("EGX stocks: Yahoo Finance spark returned no data");
    return [];
  }

  const byTicker = new Map(allResults.map(r => [r.symbol, r]));

  return EGX_TICKERS.map(t => {
    const r = byTicker.get(t.yahoo);
    if (!r) return { symbol: t.symbol, name: t.name, price: 0, previousClose: 0, change: 0, changePercent: 0 };

    const resp = r.response?.[0];
    if (!resp) return { symbol: t.symbol, name: t.name, price: 0, previousClose: 0, change: 0, changePercent: 0 };

    const meta = resp.meta;
    const closes = (resp.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c !== null && c > 0);

    const price = round2(meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0);
    const prevClose = round2(
      meta.previousClose ?? meta.chartPreviousClose ?? closes[closes.length - 2] ?? 0
    );

    const change = prevClose > 0 ? round2(price - prevClose) : 0;
    const changePercent = prevClose > 0 ? round2((change / prevClose) * 100) : 0;

    return { symbol: t.symbol, name: t.name, price, previousClose: prevClose, change, changePercent };
  });
}

// ─── Gold history (sparkline) ─────────────────────────────────────────────────

const HISTORY_CFG: Record<string, { totalDays: number; count: number; ttlMs: number }> = {
  '1D':  { totalDays: 1,    count: 0,  ttlMs: 5  * 60_000 },  // special: derived from cache
  '1W':  { totalDays: 7,    count: 7,  ttlMs: 30 * 60_000 },
  '1M':  { totalDays: 30,   count: 10, ttlMs: 60 * 60_000 },
  '3M':  { totalDays: 90,   count: 12, ttlMs: 3  * 3600_000 },
  '1Y':  { totalDays: 365,  count: 12, ttlMs: 6  * 3600_000 },
  'ALL': { totalDays: 1825, count: 18, ttlMs: 24 * 3600_000 },
};

const histCaches: Record<string, ReturnType<typeof makeCache<number[]>>> = Object.fromEntries(
  Object.entries(HISTORY_CFG).map(([k, v]) => [k, makeCache<number[]>(v.ttlMs)])
);

/** Generate `count` evenly-spaced business-day dates going back `totalDays`. */
function sampledDates(totalDays: number, count: number): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = count; i >= 1; i--) {
    const daysBack = Math.round((i / count) * totalDays);
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - daysBack);
    const dow = d.getUTCDay();
    if (dow === 0) d.setUTCDate(d.getUTCDate() - 2); // Sun → Fri
    if (dow === 6) d.setUTCDate(d.getUTCDate() - 1); // Sat → Fri
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

async function fetchOneClose(date: string, key: string): Promise<number | null> {
  const url = `${COMMODITY_API_BASE}/rates/historical?apiKey=${key}&symbols=XAU&date=${date}`;
  const data = await safeJson<CommodityHistoricalResponse>(await safeFetch(url));
  const c = data?.rates?.XAU?.close;
  return c && c > 0 ? c : null;
}

async function buildGoldHistory(range: string): Promise<number[]> {
  const cached = histCaches[range]?.get();
  if (cached) return cached;

  if (range === '1D') {
    // Reuse already-fetched yesterday close + today's current price — no extra API calls.
    // Tolerate either call failing individually (unlike a strict Promise.all) so a single
    // flaky/rate-limited leg doesn't blank out the whole 1D chart.
    const [histResult, latestResult] = await Promise.allSettled([
      fetchCommodityHistorical(),
      fetchCommodityLatest(),
    ]);
    const hist = histResult.status === 'fulfilled' ? histResult.value : null;
    const latest = latestResult.status === 'fulfilled' ? latestResult.value : null;

    let pts: number[] | null = null;
    if (hist && latest) {
      pts = [hist.xauClose, latest.xau];
    } else {
      // Fall back to the cached prices response (populated by /markets/prices) so we
      // still have *some* today value, and/or the tail of the 1W series for yesterday.
      const cachedPrices = pricesCache.get();
      const weekly = histCaches['1W']?.get();
      const yesterdayClose = hist?.xauClose ?? (weekly && weekly.length >= 2 ? weekly[weekly.length - 2] : null);
      const todayValue = latest?.xau ?? cachedPrices?.goldUsd ?? null;
      if (yesterdayClose != null && todayValue != null) {
        pts = [yesterdayClose, todayValue];
      }
    }

    if (!pts) return [];
    histCaches['1D'].set(pts);
    return pts;
  }

  const key = process.env.COMMODITY_API_KEY;
  if (!key) return [];
  const cfg = HISTORY_CFG[range];
  if (!cfg) return [];

  const dates = sampledDates(cfg.totalDays, cfg.count);
  const closes = await Promise.all(dates.map(d => fetchOneClose(d, key)));
  const valid = closes.filter((c): c is number => c !== null);
  if (valid.length < 2) return [];

  histCaches[range].set(valid);
  return valid;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/markets/prices", async (req, res) => {
  const cached = pricesCache.get();
  if (cached) { res.setHeader("X-Cache", "HIT"); res.json(cached); return; }
  try {
    const data = await fetchPrices();
    pricesCache.set(data);
    res.setHeader("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch market prices");
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

router.get("/markets/gold-history", async (req, res) => {
  const range = String(req.query.range ?? '1D');
  if (!HISTORY_CFG[range]) { res.status(400).json({ error: "Invalid range" }); return; }
  try {
    const points = await buildGoldHistory(range);
    res.json({ points, range });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch gold history");
    res.status(500).json({ error: "Failed to fetch gold history" });
  }
});

router.get("/markets/stocks", async (req, res) => {
  const cached = stocksCache.get();
  if (cached) { res.setHeader("X-Cache", "HIT"); res.json(cached); return; }
  try {
    const data = await fetchStocks();
    stocksCache.set(data);
    res.setHeader("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch EGX stocks");
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
});

export default router;
