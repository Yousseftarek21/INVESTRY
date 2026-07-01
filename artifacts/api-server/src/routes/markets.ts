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

const TROY_OZ = 31.1035;
const PURITY: Record<string, number> = { "24k": 1, "22k": 22 / 24, "21k": 0.875, "18k": 0.75 };

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
// CommodityPriceAPI does not provide FX pairs; EGP conversion requires a
// separate FX source. We use open.er-api.com (free, no key) for this only.

interface ErApiResponse { rates: { EGP: number } }

async function fetchUsdToEgp(): Promise<number> {
  const data = await safeJson<ErApiResponse>(
    await safeFetch("https://open.er-api.com/v6/latest/USD")
  );
  if (data?.rates?.EGP && data.rates.EGP > 0) return data.rates.EGP;
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

  const goldEgpPerGram: Record<string, number> = {};
  for (const [karat, purity] of Object.entries(PURITY)) {
    goldEgpPerGram[karat] = round2((goldUsd / TROY_OZ) * purity * usdToEgp);
  }
  const silverEgpPerGram = round2((silverUsd / TROY_OZ) * usdToEgp);

  const sources: string[] = latest ? ["commoditypriceapi.com"] : ["fallback"];

  return {
    goldUsd:             round2(goldUsd),
    silverUsd:           round2(silverUsd),
    usdToEgp:            round2(usdToEgp),
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
