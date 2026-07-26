import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface InflationResponse { rate: number; year: number; }

interface CacheEntry { data: InflationResponse; ts: number; }
let cache: CacheEntry | null = null;
const TTL_MS = 24 * 60 * 60 * 1000; // 24h — source only updates annually

// Last known good value, used if the World Bank API is ever unreachable and
// no cached value exists yet.
const FALLBACK: InflationResponse = { rate: 14.1, year: 2025 };

// Shared by the route below and the AI chat context (chat.ts) — both want
// Egypt's latest annual inflation rate, so the fetch/cache/fallback logic
// lives in one place rather than being duplicated.
export async function fetchInflation(): Promise<InflationResponse> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.data;

  try {
    const wbRes = await fetch(
      "https://api.worldbank.org/v2/country/EGY/indicator/FP.CPI.TOTL.ZG?format=json&mrnev=1"
    );
    if (!wbRes.ok) throw new Error(`World Bank API ${wbRes.status}`);
    const json = (await wbRes.json()) as unknown[];
    const point = (json?.[1] as any[] | undefined)?.[0];
    const rate = point?.value;
    const year = point?.date ? parseInt(point.date, 10) : undefined;
    if (typeof rate !== "number" || !year) throw new Error("Unexpected response shape");

    const data: InflationResponse = { rate: Math.round(rate * 10) / 10, year };
    cache = { data, ts: Date.now() };
    return data;
  } catch (err) {
    logger.error({ err }, "fetchInflation failed, serving fallback");
    return cache?.data ?? FALLBACK;
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
