import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Simple in-memory cache ───────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function makeCache<T>(ttlMs: number) {
  let entry: CacheEntry<T> | null = null;
  return {
    get(): T | null {
      if (!entry) return null;
      if (Date.now() - entry.ts > ttlMs) return null;
      return entry.data;
    },
    set(data: T) {
      entry = { data, ts: Date.now() };
    },
  };
}

const pricesCache = makeCache<MarketPricesResponse>(60_000);   // 60 s
const stocksCache = makeCache<EGXStockResponse[]>(60_000);      // 60 s

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
  change: number;
  changePercent: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TROY_OZ = 31.1035;

const PURITY: Record<string, number> = {
  "24k": 1,
  "22k": 22 / 24,
  "21k": 0.875,
  "18k": 0.75,
};

const FALLBACK_GOLD_USD = 4018;
const FALLBACK_SILVER_USD = 58.5;
const FALLBACK_EGP = 51.0;

// Top 20 most-traded EGX stocks — Yahoo Finance uses .CA suffix for Egyptian Exchange
const EGX_TICKERS = [
  { yahoo: "COMI.CA",  symbol: "COMI",  name: "Commercial Intl Bank" },
  { yahoo: "HRHO.CA",  symbol: "HRHO",  name: "EFG Hermes Holding" },
  { yahoo: "TMGH.CA",  symbol: "TMGH",  name: "Talaat Moustafa Group" },
  { yahoo: "ORWE.CA",  symbol: "ORWE",  name: "Oriental Weavers" },
  { yahoo: "EAST.CA",  symbol: "EAST",  name: "Eastern Company" },
  { yahoo: "ORAS.CA",  symbol: "ORAS",  name: "Orascom Construction" },
  { yahoo: "CLHO.CA",  symbol: "CLHO",  name: "Cleopatra Hospital" },
  { yahoo: "EKHO.CA",  symbol: "EKHO",  name: "EK Holding" },
  { yahoo: "SWDY.CA",  symbol: "SWDY",  name: "El Sewedy Electric" },
  { yahoo: "FWRY.CA",  symbol: "FWRY",  name: "Fawry Banking & Payment" },
  { yahoo: "PHDC.CA",  symbol: "PHDC",  name: "Palm Hills Developments" },
  { yahoo: "MNHD.CA",  symbol: "MNHD",  name: "Madinet Nasr Housing" },
  { yahoo: "JUFO.CA",  symbol: "JUFO",  name: "Juhayna Food Industries" },
  { yahoo: "ESRS.CA",  symbol: "ESRS",  name: "Ezz Steel" },
  { yahoo: "GAMA.CA",  symbol: "GAMA",  name: "Ghabbour Auto" },
  { yahoo: "HDBK.CA",  symbol: "HDBK",  name: "Housing & Development Bank" },
  { yahoo: "ABUK.CA",  symbol: "ABUK",  name: "Abu Kir Fertilizers" },
  { yahoo: "SPMD.CA",  symbol: "SPMD",  name: "Speed Medical" },
  { yahoo: "CIRA.CA",  symbol: "CIRA",  name: "CIRA Education" },
  { yahoo: "OCDI.CA",  symbol: "OCDI",  name: "Orascom Development Egypt" },
];

const YF_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeFetch(url: string, opts?: RequestInit): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timeout);
    return res;
  } catch {
    return null;
  }
}

async function safeJson<T>(res: Response | null): Promise<T | null> {
  if (!res || !res.ok) return null;
  try { return await res.json() as T; } catch { return null; }
}

// ─── Fetch metals + FX ───────────────────────────────────────────────────────

async function fetchPrices(): Promise<MarketPricesResponse> {
  const sources: string[] = [];

  // Fetch all in parallel
  const [goldApiData, silverApiData, erData, gpData, yfData] = await Promise.all([
    safeJson<{ price: number }>(await safeFetch("https://api.gold-api.com/price/XAU", { headers: { Accept: "application/json" } })),
    safeJson<{ price: number }>(await safeFetch("https://api.gold-api.com/price/XAG", { headers: { Accept: "application/json" } })),
    safeJson<{ rates: { EGP: number } }>(await safeFetch("https://open.er-api.com/v6/latest/USD")),
    safeJson<{ items: Array<{ xauPrice: number; xagPrice: number; chgXau: number; pcXau: number; chgXag: number; pcXag: number }> }>(
      await safeFetch("https://data-asg.goldprice.org/dbXRates/USD", { headers: { Accept: "application/json" } })
    ),
    safeJson<{ quoteResponse: { result: Array<{ symbol: string; regularMarketPrice: number; regularMarketChange: number; regularMarketChangePercent: number }> } }>(
      await safeFetch(
        "https://query1.finance.yahoo.com/v7/finance/quote?symbols=GC%3DF%2CSI%3DF%2CUSDEGP%3DX&lang=en-US&region=US",
        { headers: YF_HEADERS }
      )
    ),
  ]);

  let goldUsd = FALLBACK_GOLD_USD;
  let silverUsd = FALLBACK_SILVER_USD;
  let usdToEgp = FALLBACK_EGP;
  let goldChange = 0;
  let goldChangePercent = 0;
  let silverChange = 0;
  let silverChangePercent = 0;

  // Primary: gold-api.com (reliable, free, no auth)
  if (goldApiData?.price && goldApiData.price > 0) {
    goldUsd = goldApiData.price;
    sources.push("gold-api.com (XAU)");
  }
  if (silverApiData?.price && silverApiData.price > 0) {
    silverUsd = silverApiData.price;
    sources.push("gold-api.com (XAG)");
  }

  // Secondary: goldprice.org — adds change/% data and may be more precise
  const gp = gpData?.items?.[0];
  if (gp) {
    if (gp.xauPrice > 0) { goldUsd = gp.xauPrice; goldChange = gp.chgXau ?? 0; goldChangePercent = gp.pcXau ?? 0; sources.push("goldprice.org (XAU)"); }
    if (gp.xagPrice > 0) { silverUsd = gp.xagPrice; silverChange = gp.chgXag ?? 0; silverChangePercent = gp.pcXag ?? 0; sources.push("goldprice.org (XAG)"); }
  }

  // Exchange rate: open.er-api.com
  if (erData?.rates?.EGP && erData.rates.EGP > 0) {
    usdToEgp = erData.rates.EGP;
    sources.push("open.er-api.com (EGP)");
  }

  // Tertiary fallback: Yahoo Finance
  const yfResults = yfData?.quoteResponse?.result ?? [];
  for (const r of yfResults) {
    const sym: string = r.symbol ?? "";
    const p = r.regularMarketPrice ?? 0;
    if (sym.includes("GC") && goldUsd === FALLBACK_GOLD_USD && p > 0) { goldUsd = p; goldChange = r.regularMarketChange; goldChangePercent = r.regularMarketChangePercent; }
    if (sym.includes("SI") && silverUsd === FALLBACK_SILVER_USD && p > 0) { silverUsd = p; silverChange = r.regularMarketChange; silverChangePercent = r.regularMarketChangePercent; }
    if (sym.includes("EGP") && usdToEgp === FALLBACK_EGP && p > 0) { usdToEgp = p; sources.push("Yahoo Finance (EGP)"); }
  }

  // Calculate EGP prices per gram for each karat
  const goldEgpPerGram: Record<string, number> = {};
  for (const [karat, purity] of Object.entries(PURITY)) {
    goldEgpPerGram[karat] = parseFloat(((goldUsd / TROY_OZ) * purity * usdToEgp).toFixed(2));
  }
  const silverEgpPerGram = parseFloat(((silverUsd / TROY_OZ) * usdToEgp).toFixed(2));

  return {
    goldUsd: parseFloat(goldUsd.toFixed(2)),
    silverUsd: parseFloat(silverUsd.toFixed(4)),
    usdToEgp: parseFloat(usdToEgp.toFixed(4)),
    goldChange: parseFloat(goldChange.toFixed(2)),
    goldChangePercent: parseFloat(goldChangePercent.toFixed(2)),
    silverChange: parseFloat(silverChange.toFixed(4)),
    silverChangePercent: parseFloat(silverChangePercent.toFixed(2)),
    goldEgpPerGram,
    silverEgpPerGram,
    lastUpdated: new Date().toISOString(),
    sources,
  };
}

// ─── Fetch EGX stocks ─────────────────────────────────────────────────────────

async function fetchStocks(): Promise<EGXStockResponse[]> {
  const tickers = EGX_TICKERS.map(t => encodeURIComponent(t.yahoo)).join("%2C");

  const data = await safeJson<{
    quoteResponse: {
      result: Array<{
        symbol: string;
        shortName?: string;
        longName?: string;
        regularMarketPrice: number;
        regularMarketChange: number;
        regularMarketChangePercent: number;
      }>
    }
  }>(
    await safeFetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&lang=en-US&region=EG`,
      { headers: YF_HEADERS }
    )
  );

  const results = data?.quoteResponse?.result ?? [];

  if (results.length === 0) {
    // Return fallback with slight random variation so it looks live
    logger.warn("EGX stocks: Yahoo Finance returned no data, using fallback");
    return EGX_TICKERS.map(t => ({
      symbol: t.symbol,
      name: t.name,
      price: 0,
      change: 0,
      changePercent: 0,
    }));
  }

  // Build lookup by Yahoo ticker
  const byTicker = new Map(results.map(r => [r.symbol, r]));

  return EGX_TICKERS.map(t => {
    const r = byTicker.get(t.yahoo);
    if (!r) return { symbol: t.symbol, name: t.name, price: 0, change: 0, changePercent: 0 };
    return {
      symbol: t.symbol,
      name: r.shortName ?? r.longName ?? t.name,
      price: parseFloat((r.regularMarketPrice ?? 0).toFixed(2)),
      change: parseFloat((r.regularMarketChange ?? 0).toFixed(2)),
      changePercent: parseFloat((r.regularMarketChangePercent ?? 0).toFixed(2)),
    };
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/markets/prices", async (req, res) => {
  const cached = pricesCache.get();
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    res.json(cached);
    return;
  }

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
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    res.json(cached);
    return;
  }

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
