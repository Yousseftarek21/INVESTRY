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

const pricesCache = makeCache<MarketPricesResponse>(30_000);  // 30 s
const stocksCache = makeCache<EGXStockResponse[]>(30_000);    // 30 s

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

// ─── EGX ticker list ──────────────────────────────────────────────────────────

const EGX_TICKERS = [
  { yahoo: "COMI.CA",  symbol: "COMI",  name: "Commercial Intl Bank"     },
  { yahoo: "HRHO.CA",  symbol: "HRHO",  name: "EFG Hermes Holding"        },
  { yahoo: "TMGH.CA",  symbol: "TMGH",  name: "Talaat Moustafa Group"     },
  { yahoo: "ORWE.CA",  symbol: "ORWE",  name: "Oriental Weavers"          },
  { yahoo: "EAST.CA",  symbol: "EAST",  name: "Eastern Company"           },
  { yahoo: "ORAS.CA",  symbol: "ORAS",  name: "Orascom Construction"      },
  { yahoo: "CLHO.CA",  symbol: "CLHO",  name: "Cleopatra Hospital"        },
  { yahoo: "EKHO.CA",  symbol: "EKHO",  name: "EK Holding"                },
  { yahoo: "SWDY.CA",  symbol: "SWDY",  name: "El Sewedy Electric"        },
  { yahoo: "FWRY.CA",  symbol: "FWRY",  name: "Fawry Banking & Payment"   },
  { yahoo: "PHDC.CA",  symbol: "PHDC",  name: "Palm Hills Developments"   },
  { yahoo: "MNHD.CA",  symbol: "MNHD",  name: "Madinet Nasr Housing"      },
  { yahoo: "JUFO.CA",  symbol: "JUFO",  name: "Juhayna Food Industries"   },
  { yahoo: "ESRS.CA",  symbol: "ESRS",  name: "Ezz Steel"                 },
  { yahoo: "GAMA.CA",  symbol: "GAMA",  name: "Ghabbour Auto"             },
  { yahoo: "HDBK.CA",  symbol: "HDBK",  name: "Housing & Development Bank" },
  { yahoo: "ABUK.CA",  symbol: "ABUK",  name: "Abu Kir Fertilizers"       },
  { yahoo: "SPMD.CA",  symbol: "SPMD",  name: "Speed Medical"             },
  { yahoo: "CIRA.CA",  symbol: "CIRA",  name: "CIRA Education"            },
  { yahoo: "OCDI.CA",  symbol: "OCDI",  name: "Orascom Development Egypt" },
];

const TROY_OZ = 31.1035;
const PURITY: Record<string, number> = { "24k": 1, "22k": 22 / 24, "21k": 0.875, "18k": 0.75 };

const FALLBACK_GOLD  = 4018;
const FALLBACK_SILVER = 58.5;
const FALLBACK_EGP   = 51.0;

// Yahoo Finance spark endpoint — uses a different rate-limit pool than /v7/quote
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

// ─── Metals + FX ─────────────────────────────────────────────────────────────

async function fetchPrices(): Promise<MarketPricesResponse> {
  const sources: string[] = [];

  const [goldData, silverData, erData, gpData] = await Promise.all([
    safeJson<{ price: number }>(
      await safeFetch("https://api.gold-api.com/price/XAU", { headers: BASE_HEADERS })
    ),
    safeJson<{ price: number }>(
      await safeFetch("https://api.gold-api.com/price/XAG", { headers: BASE_HEADERS })
    ),
    safeJson<{ rates: { EGP: number } }>(
      await safeFetch("https://open.er-api.com/v6/latest/USD")
    ),
    safeJson<{ items: Array<{ xauPrice: number; xagPrice: number; chgXau: number; pcXau: number; chgXag: number; pcXag: number }> }>(
      await safeFetch("https://data-asg.goldprice.org/dbXRates/USD", { headers: BASE_HEADERS })
    ),
  ]);

  let goldUsd = FALLBACK_GOLD;
  let silverUsd = FALLBACK_SILVER;
  let usdToEgp = FALLBACK_EGP;
  let goldChange = 0, goldChangePct = 0, silverChange = 0, silverChangePct = 0;

  // gold-api.com — primary for spot price (real-time, ~15s delay behind spot)
  if (goldData?.price && goldData.price > 0)   { goldUsd = goldData.price;   sources.push("gold-api.com"); }
  if (silverData?.price && silverData.price > 0) { silverUsd = silverData.price; }

  // goldprice.org — adds change/24h data and is more precise when available
  const gp = gpData?.items?.[0];
  if (gp?.xauPrice && gp.xauPrice > 0) {
    goldUsd = gp.xauPrice;
    goldChange = gp.chgXau ?? 0;
    goldChangePct = gp.pcXau ?? 0;
    sources.push("goldprice.org");
  }
  if (gp?.xagPrice && gp.xagPrice > 0) {
    silverUsd = gp.xagPrice;
    silverChange = gp.chgXag ?? 0;
    silverChangePct = gp.pcXag ?? 0;
  }

  // open.er-api.com — live USD/EGP central bank rate
  if (erData?.rates?.EGP && erData.rates.EGP > 0) {
    usdToEgp = erData.rates.EGP;
    sources.push("open.er-api.com");
  }

  // Pre-compute all Egyptian EGP prices (what Egyptian jewelers quote)
  const goldEgpPerGram: Record<string, number> = {};
  for (const [karat, purity] of Object.entries(PURITY)) {
    goldEgpPerGram[karat] = round2((goldUsd / TROY_OZ) * purity * usdToEgp);
  }
  const silverEgpPerGram = round2((silverUsd / TROY_OZ) * usdToEgp);

  return {
    goldUsd:            round2(goldUsd),
    silverUsd:          round2(silverUsd * 100) / 100,
    usdToEgp:           round2(usdToEgp * 100) / 100,
    goldChange:         round2(goldChange),
    goldChangePercent:  round2(goldChangePct),
    silverChange:       round2(silverChange * 10000) / 10000,
    silverChangePercent: round2(silverChangePct),
    goldEgpPerGram,
    silverEgpPerGram,
    lastUpdated: new Date().toISOString(),
    sources,
  };
}

// ─── EGX Stocks via Yahoo Finance Spark endpoint ──────────────────────────────
//
// The /v7/finance/spark endpoint is in a different rate-limit pool than /v7/quote,
// so it works from server IPs where the quote endpoint gets blocked.
// Returns price history; we use last close for price and second-to-last for change.

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
  // Split into two batches of 10 to avoid URL length limits and reduce block chance
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

  // Build lookup by Yahoo symbol
  const byTicker = new Map(allResults.map(r => [r.symbol, r]));

  return EGX_TICKERS.map(t => {
    const r = byTicker.get(t.yahoo);
    if (!r) return { symbol: t.symbol, name: t.name, price: 0, previousClose: 0, change: 0, changePercent: 0 };

    const resp = r.response?.[0];
    if (!resp) return { symbol: t.symbol, name: t.name, price: 0, previousClose: 0, change: 0, changePercent: 0 };

    const meta = resp.meta;
    const closes = (resp.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c !== null && c > 0);

    // Use regularMarketPrice from meta if available, else last close
    const price = round2(meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0);

    // Previous close: prefer meta.previousClose / chartPreviousClose, else second-to-last close
    const prevClose = round2(
      meta.previousClose ?? meta.chartPreviousClose ?? closes[closes.length - 2] ?? 0
    );

    const change = prevClose > 0 ? round2(price - prevClose) : 0;
    const changePercent = prevClose > 0 ? round2((change / prevClose) * 100) : 0;

    return {
      symbol: t.symbol,
      name: t.name,  // use our canonical names (spark meta names are garbled)
      price,
      previousClose: prevClose,
      change,
      changePercent,
    };
  });
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
