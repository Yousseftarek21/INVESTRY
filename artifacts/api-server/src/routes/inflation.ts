import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface InflationResponse { rate: number; year: number; }

interface CacheEntry { data: InflationResponse; ts: number; }
let cache: CacheEntry | null = null;
const TTL_MS = 24 * 60 * 60 * 1000; // 24h — source only updates annually

// Last known good value, used if the World Bank API is ever unreachable and
// no cached value exists yet.
const FALLBACK: InflationResponse = { rate: 14.1, year: 2025 };

// GET /api/inflation — Egypt's latest annual inflation rate (World Bank,
// free/no-key API, same CPI data CAPMAS publishes). Used as the real
// benchmark line in the portfolio performance chart, replacing what used to
// be a hardcoded ~25%/yr guess.
router.get("/inflation", async (req, res) => {
  if (cache && Date.now() - cache.ts < TTL_MS) {
    res.setHeader("X-Cache", "HIT");
    res.json(cache.data);
    return;
  }

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
    res.setHeader("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "GET /inflation failed, serving fallback");
    res.json(cache?.data ?? FALLBACK);
  }
});

export default router;
