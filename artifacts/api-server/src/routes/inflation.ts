import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface InflationResponse { rate: number; year: number; }

// Maintained by hand rather than fetched live. This used to call World
// Bank's FP.CPI.TOTL.ZG indicator, but that's a full prior calendar year's
// finalized annual average (e.g. it currently reports ~14.1% for 2025) —
// a year or more behind the actual current rate, which read as visibly
// stale next to real-world figures. Check
// https://tradingeconomics.com/egypt/inflation-cpi periodically (no free
// API there, so this is a manual reference, not a second live source) and
// update the value/year below to match its latest monthly reading.
// Last checked 2026-08-25: 14.90% (July 2026).
const CURRENT_INFLATION: InflationResponse = { rate: 14.9, year: 2026 };

// Shared by the route below and the AI chat context (chat.ts) — both want
// Egypt's current annual inflation rate, so this lives in one place rather
// than being duplicated.
export async function fetchInflation(): Promise<InflationResponse> {
  return CURRENT_INFLATION;
}

// GET /api/inflation — Egypt's current annual inflation rate. Used as the
// real benchmark line in the portfolio performance chart, replacing what
// used to be a hardcoded ~25%/yr guess.
router.get("/inflation", async (req, res) => {
  res.json(await fetchInflation());
});

export default router;
