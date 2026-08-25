import { db, holdingsTable, cashAccountsTable, soldHoldingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decryptFromStorage } from "./encryption";
import { getCachedPrices, getCachedStocks } from "../routes/markets";
import { tradingDayKey } from "./cairoDate";

const TROY_OZ_TO_GRAMS = 31.1034768;

export type GoldKarat = "24k" | "22k" | "21k" | "18k";

// Mirrors artifacts/mobile/types/index.ts's Holding union — only the fields
// actually needed for valuation are read here, everything else is opaque.
export interface StoredHolding {
  id: string;
  type: string;
  [key: string]: unknown;
}

export function goldPricePerGram(goldUsd: number, usdToEgp: number, karat: GoldKarat): number {
  const perGramUsd = goldUsd / TROY_OZ_TO_GRAMS;
  const purity = karat === "24k" ? 1 : karat === "22k" ? 22 / 24 : karat === "21k" ? 0.875 : 0.75;
  return perGramUsd * purity * usdToEgp;
}

export function silverPricePerGram(silverUsd: number, usdToEgp: number): number {
  return (silverUsd / TROY_OZ_TO_GRAMS) * usdToEgp;
}

// At-maturity certificates accrue toward their principal + interest daily;
// monthly/quarterly-payout products pay interest out instead of compounding,
// so their redemption value stays flat at principal until maturity — same
// rule as artifacts/mobile/components/HoldingCard.tsx's fixedIncomeAccruedValue.
function fixedIncomeAccruedValue(h: StoredHolding): number {
  const principal = Number(h.principal) || 0;
  if (h.paymentFrequency !== "at_maturity") return principal;

  const purchase = new Date(String(h.purchaseDate)).getTime();
  const maturity = new Date(String(h.maturityDate)).getTime();
  const now = Date.now();
  if (!Number.isFinite(purchase) || !Number.isFinite(maturity) || maturity <= purchase) return principal;

  const daysTotal = Math.max(1, (maturity - purchase) / 86_400_000);
  const daysElapsed = Math.max(0, Math.min(daysTotal, (now - purchase) / 86_400_000));
  const annualRate = Number(h.annualRate) || 0;
  return principal * (1 + (annualRate / 100) * (daysElapsed / 365));
}

function personalAssetValueEGP(h: StoredHolding, usdToEgp: number): number {
  const v = (h.currentValue as number | undefined) ?? (h.purchasePrice as number | undefined) ?? 0;
  return h.currency === "USD" ? v * usdToEgp : v;
}

export function computeHoldingValue(
  h: StoredHolding,
  goldUsd: number,
  silverUsd: number,
  usdToEgp: number,
  egxPrices: Record<string, number>,
): number {
  switch (h.type) {
    case "gold":
      return (Number(h.grams) || 0) * goldPricePerGram(goldUsd, usdToEgp, (h.karat as GoldKarat) ?? "24k");
    case "silver":
      return (Number(h.grams) || 0) * silverPricePerGram(silverUsd, usdToEgp);
    case "stock": {
      const price = egxPrices[String(h.symbol)] ?? (Number(h.purchasePricePerShare) || 0);
      return (Number(h.shares) || 0) * price;
    }
    case "fixed_income":
      return fixedIncomeAccruedValue(h);
    case "personal_asset":
      return personalAssetValueEGP(h, usdToEgp);
    case "real_estate":
      // No live day-to-day feed for this on the server (the curated
      // per-area dataset only ships with the mobile bundle) — real estate
      // doesn't move day-to-day anyway, so the last valuation is a fine
      // stand-in for the purpose of detecting a ±1% portfolio swing.
      return (h.currentValue as number | undefined) ?? (h.purchasePrice as number | undefined) ?? 0;
    default:
      return 0;
  }
}

/**
 * What the user actually paid (EGP), for computing realized profit/loss
 * when a holding is sold — covers all 6 types, unlike the narrower partial
 * versions in HoldingCard.tsx/holdings.tsx (display-only, mobile) and
 * chat.ts (deliberately returns null for personal_asset/fixed_income for
 * its own "don't show unrealized %" reason, untouched here). fixed_income's
 * cost basis is its principal — the amount handed over, not the accrued
 * redemption value computeHoldingValue returns for it.
 */
export function costBasisEGP(h: StoredHolding, usdToEgp: number): number {
  switch (h.type) {
    case "gold":
    case "silver":
      return (Number(h.grams) || 0) * (Number(h.purchasePricePerGram) || 0);
    case "stock":
      return (Number(h.shares) || 0) * (Number(h.purchasePricePerShare) || 0);
    case "real_estate":
      return Number(h.purchasePrice) || 0;
    case "personal_asset": {
      const v = Number(h.purchasePrice) || 0;
      return h.currency === "USD" ? v * usdToEgp : v;
    }
    case "fixed_income":
      return Number(h.principal) || 0;
    default:
      return 0;
  }
}

/**
 * Total current value (EGP) of one user's investment holdings only —
 * matches "Total Portfolio Value" on the Home screen exactly (gold,
 * silver, stocks, real estate, personal assets, fixed income). Cash is
 * deliberately excluded: the app shows it separately, under "Net Worth
 * incl. cash", not as part of the portfolio itself. This value is what
 * both the multi-day snapshot history (1W/1M/etc charts) and the ±1%
 * portfolio alert are computed from, so it needs to mean the same thing
 * the app displays, not a broader net-worth figure.
 */
export async function computeUserPortfolioValue(userId: string): Promise<number> {
  const [holdingRows, prices, egxStocks] = await Promise.all([
    db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
    getCachedPrices(),
    getCachedStocks().catch(() => []), // stock pricing degrades to purchase price if this fails
  ]);

  const egxPrices: Record<string, number> = {};
  for (const s of egxStocks) egxPrices[s.symbol] = s.price;

  return holdingRows.reduce((sum, row) => {
    const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
    return sum + computeHoldingValue(holding, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices);
  }, 0);
}

export interface PeriodPerformance {
  /** Live value (EGP) of every holding the user still has, no filtering. */
  current: number;
  /**
   * Cost basis (EGP) of holdings created on/after `cutoffDateKey`, still
   * held — the "new capital contributed this period" side of the
   * adjustment below.
   */
  netNewCapital: number;
  /** Sale proceeds (EGP) from every sale that happened on/after `cutoffDateKey`. */
  saleProceeds: number;
  /**
   * Cost basis (EGP) of holdings that were BOTH created and sold on/after
   * `cutoffDateKey` (a same-period buy-then-sell) — also "new capital,"
   * offsetting saleProceeds the same way netNewCapital offsets current.
   */
  soldNetNewCapital: number;
}

/**
 * A period's raw performance ingredients for one user — used by the
 * leaderboard as `(current + saleProceeds − baseline − netNewCapital −
 * soldNetNewCapital) / baseline`. This is the standard technique real
 * portfolio-performance tools use for periods with cash flows (deposits/
 * withdrawals) in the middle — sometimes called the Modified Dietz method:
 * don't exclude contributed capital from the numbers, offset it out of the
 * GAIN instead, so contributing money is neutral rather than either
 * inflating a return or making a holding (and the user entirely, if it's
 * most of their portfolio) invisible to the calculation.
 *
 * Replaces an earlier "exclude anything created/edited this period"
 * approach that caused two real problems in production: (1) a user who
 * added most of their portfolio recently — completely normal for anyone
 * who joined the app in the last few weeks — ended up with ~0 "eligible"
 * value and either showed a fabricated huge loss or got silently dropped
 * from the leaderboard (25 opted-in users showed as 9); (2) since the
 * monthly window looks back 4x further than weekly, it excluded even more
 * of a typical recent holding's history, so plenty of people who ranked in
 * the weekly leaderboard vanished from the monthly one — same underlying
 * cause, not a separate bug. This version never excludes a real holding
 * from the math at all, so neither failure mode can happen: current is
 * always the true, full portfolio value.
 *
 * This does NOT close every gaming vector — a user editing an EXISTING
 * (pre-period) holding's quantity to inflate it still isn't caught, since
 * there's no per-holding value history to detect that against. That gap
 * needs real historical value-tracking to close properly; it was
 * deliberately left open here rather than risk another blunt exclusion
 * rule breaking real users again.
 */
export async function computePeriodPerformance(userId: string, cutoffDateKey: string): Promise<PeriodPerformance> {
  const [holdingRows, soldRows, prices, egxStocks] = await Promise.all([
    db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
    db.select().from(soldHoldingsTable).where(eq(soldHoldingsTable.userId, userId)),
    getCachedPrices(),
    getCachedStocks().catch(() => []),
  ]);

  const egxPrices: Record<string, number> = {};
  for (const s of egxStocks) egxPrices[s.symbol] = s.price;

  let current = 0;
  let netNewCapital = 0;
  for (const row of holdingRows) {
    const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
    current += computeHoldingValue(holding, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices);
    if (tradingDayKey(row.createdAt) >= cutoffDateKey) {
      netNewCapital += costBasisEGP(holding, prices.usdToEgp);
    }
  }

  let saleProceeds = 0;
  let soldNetNewCapital = 0;
  for (const row of soldRows) {
    const data = decryptFromStorage(row.data) as {
      saleDate?: string; saleProceeds?: number; holdingCreatedDay?: string; costBasis?: number;
    };
    if (!data.saleDate || typeof data.saleProceeds !== "number") continue;
    if (data.saleDate < cutoffDateKey) continue;
    saleProceeds += data.saleProceeds;
    if (data.holdingCreatedDay && data.holdingCreatedDay >= cutoffDateKey && typeof data.costBasis === "number") {
      soldNetNewCapital += data.costBasis;
    }
  }

  return { current, netNewCapital, saleProceeds, soldNetNewCapital };
}

export type AllocationClass = "gold" | "silver" | "stock" | "realEstate" | "personalAsset" | "fixedIncome" | "cash";

/**
 * Bucketed by asset class instead of summed into one scalar — the input
 * portfolioDriftCron needs to compare each class's live share of the
 * portfolio against the user's stored targets. Mirrors the bucketing in
 * artifacts/mobile/app/(tabs)/analytics.tsx's `sm`/driftRows useMemos
 * exactly, so a class's server-computed % matches what the user sees on
 * their own Analytics screen.
 *
 * Unlike computeUserPortfolioValue (investment holdings only, matching
 * "Total Portfolio Value"), cash IS included here as its own class — target
 * allocation is about the user's whole net worth mix ("keep 15% in cash"),
 * not just the investment side.
 */
export async function computeUserPortfolioAllocation(
  userId: string,
): Promise<{ totalValue: number; byClass: Record<AllocationClass, number> }> {
  const [holdingRows, cashRows, prices, egxStocks] = await Promise.all([
    db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
    db.select().from(cashAccountsTable).where(eq(cashAccountsTable.userId, userId)),
    getCachedPrices(),
    getCachedStocks().catch(() => []),
  ]);

  const egxPrices: Record<string, number> = {};
  for (const s of egxStocks) egxPrices[s.symbol] = s.price;

  const byClass: Record<AllocationClass, number> = {
    gold: 0, silver: 0, stock: 0, realEstate: 0, personalAsset: 0, fixedIncome: 0, cash: 0,
  };
  let totalValue = 0;

  for (const row of holdingRows) {
    const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
    const value = computeHoldingValue(holding, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices);
    totalValue += value;
    switch (holding.type) {
      case "gold": byClass.gold += value; break;
      case "silver": byClass.silver += value; break;
      case "stock": byClass.stock += value; break;
      case "real_estate": byClass.realEstate += value; break;
      case "personal_asset": byClass.personalAsset += value; break;
      case "fixed_income": byClass.fixedIncome += value; break;
    }
  }

  // Same per-currency conversion as the mobile Overview Cash card's own
  // total — USD via the dedicated usdToEgp field, everything else via
  // fxRates, unknown currencies falling back to face value.
  for (const row of cashRows) {
    const account = decryptFromStorage(row.data) as { balance?: number; currency?: string };
    const bal = Number(account.balance) || 0;
    let egpValue = bal;
    if (account.currency && account.currency !== "EGP") {
      if (account.currency === "USD" && prices.usdToEgp) egpValue = bal * prices.usdToEgp;
      else if (prices.fxRates?.[account.currency]) egpValue = bal * prices.fxRates[account.currency];
    }
    byClass.cash += egpValue;
    totalValue += egpValue;
  }

  return { totalValue, byClass };
}
