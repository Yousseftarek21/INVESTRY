import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface InflationResponse { rate: number; year: number; }

interface CacheEntry { data: InflationResponse; ts: number; isFallback: boolean; }
let cache: CacheEntry | null = null;
const TTL_MS = 24 * 60 * 60 * 1000; // successful fetch: 24h — source only updates annually
// A failed fetch used to leave `cache` unset entirely, so every single call
// (including one on every AI Assistant message, via buildPortfolioContext)
// retried the same broken endpoint and paid its full failure latency again —
// observed at ~9s per call in production once World Bank started returning
// 400. Caching the fallback too, with a shorter retry window, means a
// failure is paid once per hour instead of once per request.
const RETRY_TTL_MS = 60 * 60 * 1000;
// Without this, a hanging/slow upstream (rather than a fast 400) could block
// every AI Assistant message for however long fetch takes to give up on its
// own — which on some networks is a lot longer than 9s.
const FETCH_TIMEOUT_MS = 3000;

// Last known good value, used if the World Bank API is ever unreachable and
// no cached value exists yet.
const FALLBACK: InflationResponse = { rate: 14.1, year: 2025 };

// Shared by the route below and the AI chat context (chat.ts) — both want
// Egypt's latest annual inflation rate, so the fetch/cache/fallback logic
// lives in one place rather than being duplicated.
export async function fetchInflation(): Promise<InflationResponse> {
  if (cache) {
    const ttl = cache.isFallback ? RETRY_TTL_MS : TTL_MS;
    if (Date.now() - cache.ts < ttl) return cache.data;
  }

  try {
    const wbRes = await fetch(
      // mrnev ("most recent non-empty value") now gets a hard 400 from
      // World Bank's API — confirmed live, not a network blip. mrv ("most
      // recent value") returns the identical shape and still works.
      "https://api.worldbank.org/v2/country/EGY/indicator/FP.CPI.TOTL.ZG?format=json&mrv=1",
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!wbRes.ok) throw new Error(`World Bank API ${wbRes.status}`);
    const json = (await wbRes.json()) as unknown[];
    const point = (json?.[1] as any[] | undefined)?.[0];
    const rate = point?.value;
    const year = point?.date ? parseInt(point.date, 10) : undefined;
    if (typeof rate !== "number" || !year) throw new Error("Unexpected response shape");

    const data: InflationResponse = { rate: Math.round(rate * 10) / 10, year };
    cache = { data, ts: Date.now(), isFallback: false };
    return data;
  } catch (err) {
    logger.error({ err }, "fetchInflation failed, serving fallback");
    const data = cache?.data ?? FALLBACK;
    cache = { data, ts: Date.now(), isFallback: true };
    return data;
  }
}

// GET /api/inflation — Egypt's latest annual inflation rate (World Bank,
// free/no-key API, same CPI data CAPMAS publishes). Used as the real
// benchmark line in the portfolio performance chart, replacing what used to
// be a hardcoded ~25%/yr guess.
router.get("/inflation", async (req, res) => {
  const wasHit = cache !== null && Date.now() - cache.ts < TTL_MS;
  const data = await fetchInflation();
  res.setHeader("X-Cache", wasHit ? "HIT" : "MISS");
  res.json(data);
});

export default router;
