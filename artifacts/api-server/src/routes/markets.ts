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
const globalStocksCache = makeCache<EGXStockResponse[]>(5 * 60_000); // 5 min (Twelve Data free tier)

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
  fxRates: Record<string, number>;
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

// 42 verified EGX companies — kept in sync with artifacts/mobile/data/egx-companies.ts
// 4 tickers (QNBA, EKHO, ESRS, IDHC) are valid EGX listings but absent from TradingView's
// Egypt scanner feed; they fall back to Yahoo Finance spark on native devices.
const EGX_TICKERS = [
  // Banking
  { yahoo: "COMI.CA",  symbol: "COMI",  name: "Commercial International Bank (CIB)" },
  { yahoo: "QNBA.CA",  symbol: "QNBA",  name: "QNB Al Ahli"                         },
  { yahoo: "CIEB.CA",  symbol: "CIEB",  name: "Credit Agricole Egypt"               },
  { yahoo: "ADIB.CA",  symbol: "ADIB",  name: "Abu Dhabi Islamic Bank Egypt"        },
  { yahoo: "HDBK.CA",  symbol: "HDBK",  name: "Housing & Development Bank"          },
  // Financial Services
  { yahoo: "HRHO.CA",  symbol: "HRHO",  name: "EFG Holding"                         },
  { yahoo: "EKHO.CA",  symbol: "EKHO",  name: "Egypt Kuwait Holding"                },
  { yahoo: "CICH.CA",  symbol: "CICH",  name: "CI Capital Holding"                  },
  { yahoo: "EFIC.CA",  symbol: "EFIC",  name: "Egyptian Financial & Industrial"     },
  // Real Estate
  { yahoo: "TMGH.CA",  symbol: "TMGH",  name: "Talaat Moustafa Group Holding"       },
  { yahoo: "PHDC.CA",  symbol: "PHDC",  name: "Palm Hills Developments"             },
  { yahoo: "MASR.CA",  symbol: "MASR",  name: "Madinet Masr Housing & Development"  },
  { yahoo: "OCDI.CA",  symbol: "OCDI",  name: "SODIC"                               },
  { yahoo: "EMFD.CA",  symbol: "EMFD",  name: "Emaar Misr for Development"          },
  { yahoo: "ORHD.CA",  symbol: "ORHD",  name: "Ora Developers Egypt"               },
  { yahoo: "HELI.CA",  symbol: "HELI",  name: "Heliopolis Housing"                  },
  // Telecom
  { yahoo: "ETEL.CA",  symbol: "ETEL",  name: "Telecom Egypt"                       },
  // Industrial
  { yahoo: "SWDY.CA",  symbol: "SWDY",  name: "El Sewedy Electric"                  },
  { yahoo: "ESRS.CA",  symbol: "ESRS",  name: "Ezz Steel"                           },
  { yahoo: "EAST.CA",  symbol: "EAST",  name: "Eastern Company"                     },
  { yahoo: "ORAS.CA",  symbol: "ORAS",  name: "Orascom Construction"                },
  { yahoo: "MOIL.CA",  symbol: "MOIL",  name: "Maridive & Oil Services"             },
  { yahoo: "EGAL.CA",  symbol: "EGAL",  name: "Egypt Aluminum"                      },
  // Chemicals & Fertilizers
  { yahoo: "ABUK.CA",  symbol: "ABUK",  name: "Abu Kir Fertilizers"                 },
  { yahoo: "SKPC.CA",  symbol: "SKPC",  name: "Sidi Kerir Petrochemicals"           },
  { yahoo: "MFPC.CA",  symbol: "MFPC",  name: "Misr Fertilizers Production (MOPCO)" },
  { yahoo: "EGCH.CA",  symbol: "EGCH",  name: "Egyptian Chemical Industries (KIMA)" },
  // Energy
  { yahoo: "AMOC.CA",  symbol: "AMOC",  name: "Alexandria Mineral Oils"             },
  // Construction Materials
  { yahoo: "SUCE.CA",  symbol: "SUCE",  name: "Suez Cement"                         },
  { yahoo: "MCQE.CA",  symbol: "MCQE",  name: "Misr Cement (Qena)"                  },
  { yahoo: "LCSW.CA",  symbol: "LCSW",  name: "Lecico Egypt"                        },
  // Healthcare
  { yahoo: "CLHO.CA",  symbol: "CLHO",  name: "Cleopatra Hospital Group"            },
  { yahoo: "PHAR.CA",  symbol: "PHAR",  name: "EIPICO"                              },
  { yahoo: "SPMD.CA",  symbol: "SPMD",  name: "Speed Medical"                       },
  { yahoo: "IDHC.CA",  symbol: "IDHC",  name: "Integrated Diagnostics (IDH)"       },
  // Food & Beverage
  { yahoo: "JUFO.CA",  symbol: "JUFO",  name: "Juhayna Food Industries"             },
  { yahoo: "DOMT.CA",  symbol: "DOMT",  name: "Domty"                               },
  // Technology
  { yahoo: "FWRY.CA",  symbol: "FWRY",  name: "Fawry for Banking & Payment"         },
  { yahoo: "EFIH.CA",  symbol: "EFIH",  name: "e-finance for Digital Investments"   },
  // Textile
  { yahoo: "ORWE.CA",  symbol: "ORWE",  name: "Oriental Weavers"                    },
  // Education
  { yahoo: "CIRA.CA",  symbol: "CIRA",  name: "CIRA Education"                      },
  // Transportation
  { yahoo: "ALCN.CA",  symbol: "ALCN",  name: "Alexandria Container & Cargo"        },
];

// ─── Global stock ticker list — 8 symbols, fits Twelve Data free tier (8 credits/min) ───

const GLOBAL_TICKERS = [
  { yahoo: "SPY",   symbol: "SPY",   name: "S&P 500 (SPDR ETF)"       },
  { yahoo: "QQQ",   symbol: "QQQ",   name: "NASDAQ 100 (Invesco ETF)" },
  { yahoo: "AAPL",  symbol: "AAPL",  name: "Apple Inc."               },
  { yahoo: "MSFT",  symbol: "MSFT",  name: "Microsoft Corp."          },
  { yahoo: "NVDA",  symbol: "NVDA",  name: "NVIDIA Corp."             },
  { yahoo: "GOOGL", symbol: "GOOGL", name: "Alphabet Inc."            },
  { yahoo: "AMZN",  symbol: "AMZN",  name: "Amazon.com Inc."          },
  { yahoo: "TSLA",  symbol: "TSLA",  name: "Tesla Inc."               },
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

// ─── Yahoo Finance Session (crumb + cookie) ────────────────────────────────────
// Yahoo Finance rate-limits unauthenticated API calls from shared IPs.
// Establishing a session cookie (from fc.yahoo.com) + crumb bypasses this.

interface YFSession { crumb: string; cookie: string; expiresAt: number }
let _yfSession: YFSession | null = null;

async function getYFSession(): Promise<YFSession | null> {
  if (_yfSession && Date.now() < _yfSession.expiresAt) return _yfSession;

  try {
    // Step 1 — fc.yahoo.com issues the A3 session cookie via a redirect response.
    // Use redirect:'manual' so we can read Set-Cookie before it's consumed.
    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 8000);
    const fcRes = await fetch("https://fc.yahoo.com/", {
      redirect: "manual",
      headers: {
        "User-Agent": BASE_HEADERS["User-Agent"],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: ctrl1.signal,
    });
    clearTimeout(t1);

    // Collect Set-Cookie headers (Node 18+ Headers.getSetCookie() returns string[])
    const rawCookies: string[] =
      typeof (fcRes.headers as any).getSetCookie === "function"
        ? (fcRes.headers as any).getSetCookie()
        : [(fcRes.headers.get("set-cookie") ?? "")];

    let cookie = "";
    for (const rc of rawCookies) {
      const m = rc.match(/\b(A3=[^;]+)/);
      if (m) { cookie = m[1]; break; }
    }
    if (!cookie) {
      for (const rc of rawCookies) {
        const m = rc.match(/\b(A1=[^;]+)/);
        if (m) { cookie = m[1]; break; }
      }
    }
    if (!cookie) {
      logger.warn("YF session: no A3/A1 cookie from fc.yahoo.com");
      return null;
    }

    // Step 2 — exchange cookie for a crumb
    const ctrl2 = new AbortController();
    const t2 = setTimeout(() => ctrl2.abort(), 8000);
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { ...BASE_HEADERS, Cookie: cookie },
      signal: ctrl2.signal,
    });
    clearTimeout(t2);

    if (!crumbRes.ok) {
      logger.warn({ status: crumbRes.status }, "YF session: getcrumb failed");
      return null;
    }
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 30 || crumb.includes("<")) {
      logger.warn("YF session: invalid crumb received");
      return null;
    }

    _yfSession = { crumb, cookie, expiresAt: Date.now() + 20 * 60_000 }; // 20 min TTL
    logger.info({ crumbLen: crumb.length }, "YF session established");
    return _yfSession;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, "YF session: setup failed");
    return null;
  }
}

/** Build authenticated YF headers (with cookie + crumb appended to URL). */
function yfAuthHeaders(session: YFSession | null): Record<string, string> {
  const h: Record<string, string> = { ...BASE_HEADERS };
  if (session?.cookie) h["Cookie"] = session.cookie;
  return h;
}
function yfCrumbParam(session: YFSession | null): string {
  return session ? `&crumb=${encodeURIComponent(session.crumb)}` : "";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of u.searchParams.keys()) {
      if (/key|token|secret/i.test(key)) u.searchParams.set(key, "***");
    }
    return u.toString();
  } catch {
    return url;
  }
}

async function safeFetch(url: string, opts?: RequestInit): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    logger.warn({ url: redactUrl(url), err: err instanceof Error ? err.message : err }, "safeFetch: request failed");
    return null;
  }
}

async function safeJson<T>(res: Response | null, label?: string): Promise<T | null> {
  if (!res) {
    if (label) logger.warn({ label }, "safeJson: no response (network error or timeout)");
    return null;
  }
  if (!res.ok) {
    if (label) {
      const body = await res.text().catch(() => "<unreadable>");
      logger.warn({ label, status: res.status, statusText: res.statusText, body: body.slice(0, 500) }, "safeJson: non-OK response");
    }
    return null;
  }
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
  const data = await safeJson<CommodityLatestResponse>(await safeFetch(url), "CommodityPriceAPI latest");

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
  const data = await safeJson<CommodityHistoricalResponse>(await safeFetch(url), "CommodityPriceAPI historical");

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

// ─── FX cross rates (floating currencies vs EGP) ─────────────────────────────
// Uses open.er-api.com (free, no key) which returns USD-based rates.
// EGP per 1 unit of each currency = usdToEgp / rates[sym]

const FX_SYMBOLS = ['EUR', 'GBP', 'TRY', 'CNY', 'CHF', 'QAR', 'SAR', 'AED', 'KWD'] as const;

interface ErApiFullResponse { rates: Record<string, number> }

async function fetchFxCrossRates(usdToEgp: number): Promise<Record<string, number>> {
  const er = await safeJson<ErApiFullResponse>(
    await safeFetch("https://open.er-api.com/v6/latest/USD")
  );
  const raw = er?.rates ?? {};
  const out: Record<string, number> = {};
  for (const sym of FX_SYMBOLS) {
    const r = raw[sym];
    if (r && r > 0) out[sym] = Math.round((usdToEgp / r) * 10000) / 10000;
  }
  return out;
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

  // Fetch FX cross rates in parallel with the existing requests would be
  // ideal, but usdToEgp must be known first to compute EGP-based rates.
  const fxRates = await fetchFxCrossRates(usdToEgp);

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
    fxRates,
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

/** Fetch live quotes for a list of Yahoo tickers via the free spark endpoint, in batches of 10. */
async function fetchTickersViaSpark(
  tickers: { yahoo: string; symbol: string; name: string }[],
  logLabel: string
): Promise<EGXStockResponse[]> {
  const session = await getYFSession();
  const batches: { yahoo: string; symbol: string; name: string }[][] = [];
  for (let i = 0; i < tickers.length; i += 10) batches.push(tickers.slice(i, i + 10));

  const responses = await Promise.all(
    batches.map(async batch =>
      safeJson<SparkResponse>(
        await safeFetch(
          `${YF_SPARK_BASE}?symbols=${encodeURIComponent(batch.map(t => t.yahoo).join(","))}&range=5d&interval=1d${yfCrumbParam(session)}`,
          { headers: yfAuthHeaders(session) }
        )
      )
    )
  );

  const allResults = responses.flatMap(r => r?.spark?.result ?? []);

  if (allResults.length === 0) {
    logger.warn(`${logLabel}: Yahoo Finance spark returned no data`);
    return [];
  }

  const byTicker = new Map(allResults.map(r => [r.symbol, r]));

  return tickers.map(t => {
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

// ─── EGX via TradingView Egypt scanner ────────────────────────────────────────
// No filter — fetches ALL 292 EGX stocks in one request.
// columns: [close, change_abs, change%, volume]

// Build lookup maps from our authoritative EGX ticker list
const EGX_NAMES: Record<string, string>  = Object.fromEntries(EGX_TICKERS.map(t => [t.symbol, t.name]));
const EGX_SYMBOL_SET: Set<string>        = new Set(EGX_TICKERS.map(t => t.symbol));

async function fetchEGXViaTradingView(): Promise<EGXStockResponse[]> {
  const body = JSON.stringify({
    columns: ["close", "change_abs", "change", "volume"],
    sort: { sortBy: "name", sortOrder: "asc" },
    range: [0, 300],
  });

  const res = await safeFetch("https://scanner.tradingview.com/egypt/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "https://www.tradingview.com" },
    body,
  });
  if (!res?.ok) throw new Error(`TV scanner ${res?.status}`);

  const data = await res.json() as { data: Array<{ s: string; d: [number, number, number, number] }> };
  if (!data?.data?.length) throw new Error("TV scanner: empty");

  const results: EGXStockResponse[] = [];
  for (const item of data.data) {
    const sym = item.s.replace(/^EGX:/, "");
    if (!EGX_SYMBOL_SET.has(sym)) continue;          // skip non-EGX / unwanted tickers
    const [close, changeAbs, changePct] = item.d;
    results.push({
      symbol:        sym,
      name:          EGX_NAMES[sym] ?? sym,
      price:         round2(close),
      previousClose: round2(close - changeAbs),
      change:        round2(changeAbs),
      changePercent: round2(changePct),
    });
  }
  return results;
}

async function fetchStocks(): Promise<EGXStockResponse[]> {
  // 1. TradingView Egypt scanner — single request, correct prices, works from server
  try {
    const data = await fetchEGXViaTradingView();
    if (data.some(s => s.price > 0)) {
      logger.info({ count: data.length }, "EGX stocks via TradingView scanner");
      return data;
    }
  } catch (err) {
    logger.warn({ err }, "EGX: TradingView scanner failed");
  }

  // 2. YF spark fallback
  return fetchTickersViaSpark(EGX_TICKERS, "EGX stocks");
}

/** Fetch US stock quotes via Yahoo Finance v7/finance/quote (authenticated with crumb+cookie). */
async function fetchGlobalStocksViaQuote(): Promise<EGXStockResponse[]> {
  const session = await getYFSession();
  const symbols = GLOBAL_TICKERS.map(t => t.yahoo).join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=en-US&region=US${yfCrumbParam(session)}`;
  const res = await safeFetch(url, { headers: yfAuthHeaders(session) });
  const data = await safeJson<{ quoteResponse: { result: any[] } }>(res, "Global stocks quote");
  const results: any[] = data?.quoteResponse?.result ?? [];
  if (results.length === 0) {
    logger.warn("Global stocks: Yahoo Finance quote returned no data");
    return [];
  }
  const byTicker = new Map<string, any>(results.map((r: any) => [r.symbol as string, r]));
  return GLOBAL_TICKERS.map(t => {
    const r = byTicker.get(t.yahoo);
    if (!r?.regularMarketPrice) {
      return { symbol: t.symbol, name: t.name, price: 0, previousClose: 0, change: 0, changePercent: 0 };
    }
    return {
      symbol: t.symbol, name: t.name,
      price:         round2(r.regularMarketPrice),
      previousClose: round2(r.regularMarketPreviousClose ?? 0),
      change:        round2(r.regularMarketChange ?? 0),
      changePercent: round2(r.regularMarketChangePercent ?? 0),
    };
  });
}

// ─── Twelve Data — primary live source for US stocks ─────────────────────────
// Free tier: 800 credits/day; each symbol = 1 credit; batch call = Σ symbols.
// With 20 symbols and 5-min cache: ~40 fetches/day = 800 credits/day (at the limit).

async function fetchGlobalStocksViaTwelveData(): Promise<EGXStockResponse[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) { logger.warn("TWELVE_DATA_API_KEY not set"); return []; }

  const symbols = GLOBAL_TICKERS.map(t => t.yahoo).join(",");
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`;
  const res = await safeFetch(url, { headers: { Accept: "application/json" } });
  if (!res?.ok) {
    logger.warn({ status: res?.status }, "Twelve Data: non-OK response");
    return [];
  }

  const data = await res.json() as Record<string, any>;

  // Top-level error (bad key, quota exceeded, etc.)
  if (data?.status === "error" || data?.code) {
    logger.warn({ code: data?.code, message: data?.message }, "Twelve Data: API error");
    return [];
  }

  // Single-symbol response comes back as a flat object; multi-symbol is keyed by ticker
  const isSingle = GLOBAL_TICKERS.length === 1;

  return GLOBAL_TICKERS.map(t => {
    const q = isSingle ? data : data[t.yahoo];
    if (!q || q.status === "error" || !q.close) {
      return { symbol: t.symbol, name: t.name, price: 0, previousClose: 0, change: 0, changePercent: 0 };
    }
    return {
      symbol:        t.symbol,
      name:          t.name,
      price:         round2(parseFloat(q.close)),
      previousClose: round2(parseFloat(q.previous_close ?? "0")),
      change:        round2(parseFloat(q.change ?? "0")),
      changePercent: round2(parseFloat(q.percent_change ?? "0")),
    };
  });
}

// ─── Stooq fallback for US stocks (truly free, no API key, different IP allowance) ──

async function fetchGlobalStocksViaStooq(): Promise<EGXStockResponse[]> {
  // Stooq format: f=sd2t2ohlcv → Symbol,Date,Time,Open,High,Low,Close,Volume
  // Each symbol needs its own request; run in parallel.
  const rows = await Promise.all(
    GLOBAL_TICKERS.map(async t => {
      const sym = t.yahoo.toLowerCase() + ".us"; // e.g., AAPL → aapl.us
      const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`;
      const res = await safeFetch(url, {
        headers: { "User-Agent": BASE_HEADERS["User-Agent"], Accept: "text/csv,text/plain" },
      });
      if (!res?.ok) return null;
      const text = await res.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) return null;
      const parts = lines[1].split(","); // skip header row
      // parts: [Symbol, Date, Time, Open, High, Low, Close, Volume]
      const open  = parseFloat(parts[3]);
      const close = parseFloat(parts[6]);
      if (!close || isNaN(close) || close <= 0) return null;
      const change       = round2(close - open);
      const changePercent = open > 0 ? round2((change / open) * 100) : 0;
      return {
        symbol: t.symbol, name: t.name,
        price: round2(close), previousClose: round2(open),
        change, changePercent,
      } as EGXStockResponse;
    })
  );
  const valid = rows.filter((r): r is EGXStockResponse => r !== null);
  logger.info({ count: valid.length }, "Global stocks via Stooq");
  return valid;
}

async function fetchGlobalStocks(): Promise<EGXStockResponse[]> {
  // 1. Twelve Data — authenticated, proper change vs previous close
  try {
    const data = await fetchGlobalStocksViaTwelveData();
    if (data.some(s => s.price > 0)) {
      logger.info("Global stocks via Twelve Data");
      return data;
    }
  } catch (err) {
    logger.warn({ err }, "Global stocks: Twelve Data failed");
  }

  // 2. YF quote with crumb/cookie
  try {
    const data = await fetchGlobalStocksViaQuote();
    if (data.some(s => s.price > 0)) {
      logger.info("Global stocks via YF quote");
      return data;
    }
  } catch { /* fall through */ }

  // 3. YF spark
  try {
    const data = await fetchTickersViaSpark(GLOBAL_TICKERS, "Global stocks spark");
    if (data.some(s => s.price > 0)) return data;
  } catch { /* fall through */ }

  // 4. Stooq — independent provider, not IP-blocked by YF
  try {
    const data = await fetchGlobalStocksViaStooq();
    if (data.length > 0) return data;
  } catch (err) {
    logger.warn({ err }, "Global stocks: all sources failed");
  }

  return [];
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

router.get("/markets/global-stocks", async (req, res) => {
  const cached = globalStocksCache.get();
  if (cached) { res.setHeader("X-Cache", "HIT"); res.json(cached); return; }
  try {
    const data = await fetchGlobalStocks();
    globalStocksCache.set(data);
    res.setHeader("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch global stocks");
    res.status(500).json({ error: "Failed to fetch global stocks" });
  }
});

export default router;
