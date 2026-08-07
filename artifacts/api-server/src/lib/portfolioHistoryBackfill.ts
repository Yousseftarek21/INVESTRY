import { db, holdingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decryptFromStorage } from "./encryption";
import { cairoDateString } from "./cairoDate";
import { goldPricePerGram, silverPricePerGram, GoldKarat, StoredHolding } from "./portfolioValue";
import { fetchPrices } from "../routes/markets";
import { logger } from "./logger";

async function safeFetch(url: string, opts?: RequestInit): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, "portfolioHistoryBackfill: request failed");
    return null;
  }
}

export interface BackfillPoint {
  date: string;
  value: number;
}

export interface BackfillResult {
  points: BackfillPoint[];
  // True when the portfolio holds an asset type with no real historical
  // price source (currently: EGX stocks) — those holdings are valued at
  // their purchase price for every backfilled date instead of a live
  // day-by-day price, since no such history exists to fetch honestly.
  hasApproximatedTypes: boolean;
}

const DAY_MS = 86_400_000;

async function fetchMetalCloses(
  symbol: "XAU/USD" | "XAG/USD",
  fromDate: string,
  toDate: string,
): Promise<Map<string, number>> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  const closes = new Map<string, number>();
  if (!apiKey) { logger.warn("TWELVE_DATA_API_KEY not set — history backfill unavailable"); return closes; }

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${fromDate}&end_date=${toDate}&apikey=${apiKey}`;
  const res = await safeFetch(url, { headers: { Accept: "application/json" } });
  if (!res?.ok) { logger.warn({ symbol, status: res?.status }, "Twelve Data backfill history: non-OK response"); return closes; }

  const data = await res.json() as { status?: string; code?: number; values?: Array<{ datetime: string; close: string }> };
  if (data?.status === "error" || data?.code) {
    logger.warn({ symbol, code: data?.code }, "Twelve Data backfill history: API error");
    return closes;
  }

  for (const v of data?.values ?? []) {
    const c = parseFloat(v.close);
    if (!isNaN(c) && c > 0) closes.set(v.datetime.slice(0, 10), c);
  }
  return closes;
}

/** Carries the most recent known close forward across weekends/holidays the
 *  provider has no trading data for, so every calendar day in range gets a
 *  real, previously-observed price rather than a gap. Leading days before
 *  the first available close (a data-provider limitation, not a real gap)
 *  back-fill from that first close instead of being left empty. */
function forwardFill(closes: Map<string, number>, dates: string[]): Map<string, number> {
  const filled = new Map<string, number>();
  const sortedKnown = [...closes.keys()].sort();
  if (sortedKnown.length === 0) return filled;
  let last = closes.get(sortedKnown[0])!;
  for (const d of dates) {
    if (closes.has(d)) last = closes.get(d)!;
    filled.set(d, last);
  }
  return filled;
}

function fixedIncomeAccruedValueAt(h: StoredHolding, atDate: Date): number {
  const principal = Number(h.principal) || 0;
  if (h.paymentFrequency !== "at_maturity") return principal;

  const purchase = new Date(String(h.purchaseDate)).getTime();
  const maturity = new Date(String(h.maturityDate)).getTime();
  const at = atDate.getTime();
  if (!Number.isFinite(purchase) || !Number.isFinite(maturity) || maturity <= purchase) return principal;

  const daysTotal = Math.max(1, (maturity - purchase) / DAY_MS);
  const daysElapsed = Math.max(0, Math.min(daysTotal, (at - purchase) / DAY_MS));
  const annualRate = Number(h.annualRate) || 0;
  return principal * (1 + (annualRate / 100) * (daysElapsed / 365));
}

/**
 * Reconstructs total portfolio value for every real calendar day between a
 * user's earliest holding purchase date and yesterday (today itself is
 * already covered live — see usePortfolioSnapshots.ts). Gold and silver use
 * real historical XAU/USD & XAG/USD closes (Twelve Data — the same source
 * already powering the gold-history sparkline) converted to EGP using
 * today's live rate, since no historical USD/EGP source exists — this
 * keeps the real up/down shape of the metal's price intact, at the cost of
 * not reflecting how the EGP itself moved on those older dates. Fixed
 * income is computed from its own accrual formula, needing no external
 * price at all. EGX stocks, real estate, and personal assets have no real
 * historical price feed available, so they're valued at their own
 * purchase/recorded price for every backfilled date — a real number, just
 * not date-specific — rather than either fabricating a price or silently
 * omitting the holding from the total.
 */
export async function computeUserHistoryBackfill(userId: string): Promise<BackfillResult> {
  const holdingRows = await db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId));
  const holdings = holdingRows.map(row => (
    { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding
  ));

  const purchaseDates = holdings
    .map(h => new Date(String(h.purchaseDate)))
    .filter(d => Number.isFinite(d.getTime()));
  if (purchaseDates.length === 0) return { points: [], hasApproximatedTypes: false };

  const earliest = new Date(Math.min(...purchaseDates.map(d => d.getTime())));
  const earliestStr = cairoDateString(earliest);
  const todayStr = cairoDateString();
  if (earliestStr >= todayStr) return { points: [], hasApproximatedTypes: false };

  // Every calendar date from the earliest purchase up to (excluding) today.
  const dates: string[] = [];
  const cursor = new Date(earliest);
  while (cairoDateString(cursor) < todayStr) {
    dates.push(cairoDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const needsGold = holdings.some(h => h.type === "gold");
  const needsSilver = holdings.some(h => h.type === "silver");
  const hasApproximatedTypes = holdings.some(h => h.type === "stock" || h.type === "real_estate" || h.type === "personal_asset");

  const [rawGold, rawSilver, prices] = await Promise.all([
    needsGold ? fetchMetalCloses("XAU/USD", earliestStr, todayStr) : Promise.resolve(new Map<string, number>()),
    needsSilver ? fetchMetalCloses("XAG/USD", earliestStr, todayStr) : Promise.resolve(new Map<string, number>()),
    fetchPrices(),
  ]);
  const goldByDate = forwardFill(rawGold, dates);
  const silverByDate = forwardFill(rawSilver, dates);
  const usdToEgp = prices.usdToEgp;

  const points: BackfillPoint[] = dates.map(dateStr => {
    let total = 0;
    for (const h of holdings) {
      const purchaseStr = cairoDateString(new Date(String(h.purchaseDate)));
      if (!Number.isFinite(new Date(String(h.purchaseDate)).getTime()) || purchaseStr > dateStr) continue;

      switch (h.type) {
        case "gold": {
          const goldUsd = goldByDate.get(dateStr);
          if (goldUsd != null) {
            total += (Number(h.grams) || 0) * goldPricePerGram(goldUsd, usdToEgp, (h.karat as GoldKarat) ?? "24k");
          }
          break;
        }
        case "silver": {
          const silverUsd = silverByDate.get(dateStr);
          if (silverUsd != null) total += (Number(h.grams) || 0) * silverPricePerGram(silverUsd, usdToEgp);
          break;
        }
        case "fixed_income":
          total += fixedIncomeAccruedValueAt(h, new Date(dateStr));
          break;
        case "stock":
          total += (Number(h.shares) || 0) * (Number(h.purchasePricePerShare) || 0);
          break;
        case "real_estate":
        case "personal_asset":
          total += (h.currentValue as number | undefined) ?? (h.purchasePrice as number | undefined) ?? 0;
          break;
      }
    }
    return { date: dateStr, value: total };
  });

  return { points, hasApproximatedTypes };
}
