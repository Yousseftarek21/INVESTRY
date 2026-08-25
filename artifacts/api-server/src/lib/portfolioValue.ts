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
   * Live value (EGP) of holdings created on/after `cutoffDateKey`, still
   * held — subtracted back out of `current` so a holding added this period
   * contributes exactly nothing to the period's gain, positive or negative.
   */
  newHoldingsValue: number;
  /** Sale proceeds (EGP) from every sale that happened on/after `cutoffDateKey`. */
  saleProceeds: number;
  /**
   * Sale proceeds (EGP) from holdings that were BOTH created and sold
   * on/after `cutoffDateKey` (a same-period buy-then-sell) — subtracted
   * back out of `saleProceeds` the same way, so a same-period flip also
   * nets to zero.
   */
  newlySoldProceeds: number;
}

/**
 * A period's raw performance ingredients for one user — used by the
 * leaderboard as `(current + saleProceeds − baseline − newHoldingsValue −
 * newlySoldProceeds) / baseline`. A holding added this period cancels
 * itself out exactly: its value flows into `current`, then right back out
 * via `newHoldingsValue`, net zero — so buying (or buying-then-selling)
 * something new can never move a user's rank in either direction, and
 * every OTHER holding's real value and real price movement still counts
 * normally, since nothing is excluded from `current` itself.
 *
 * Earlier versions tried this two other ways, both wrong in production:
 * (1) excluding new/edited holdings from `current` entirely, which zeroed
 * out active users' whole portfolios and either fabricated a huge loss or
 * (combined with a since-removed "skip if zero" guard) silently dropped
 * them from the leaderboard — 25 opted-in users showed as 9, and since the
 * monthly window looked back further than weekly, even more people who
 * ranked weekly vanished monthly, same root cause. (2) offsetting by cost
 * basis instead of current value (a real technique, "Modified Dietz") —
 * broke down here specifically because purchasePrice/purchaseDate are
 * user-entered and freely backdatable: someone adding a holding they
 * actually bought 6 months ago gets a 6-month-old cost basis, so ALL of
 * that real appreciation read as "this week's gain," easily swinging past
 * 100% in a couple of days. Offsetting by the holding's OWN current value
 * instead sidesteps that completely — it can't leak pre-app history in
 * because it never looks at cost basis at all. The trade-off: a holding
 * genuinely bought (and briefly held) within the period gets no credit for
 * its own small real price move during that window either — accepted
 * deliberately, since a little lost precision on a rare case is far safer
 * than either prior failure mode.
 *
 * Still doesn't close every gaming vector — a user editing an EXISTING
 * (pre-period) holding's quantity to inflate it isn't caught, since there's
 * no per-holding value history to detect that against. That needs real
 * historical value-tracking to close properly; deliberately left open
 * rather than risk yet another blunt rule breaking real users again.
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
  let newHoldingsValue = 0;
  for (const row of holdingRows) {
    const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
    const value = computeHoldingValue(holding, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices);
    current += value;
    if (tradingDayKey(row.createdAt) >= cutoffDateKey) {
      newHoldingsValue += value;
    }
  }

  let saleProceeds = 0;
  let newlySoldProceeds = 0;
  for (const row of soldRows) {
    const data = decryptFromStorage(row.data) as {
      saleDate?: string; saleProceeds?: number; holdingCreatedDay?: string;
    };
    if (!data.saleDate || typeof data.saleProceeds !== "number") continue;
    if (data.saleDate < cutoffDateKey) continue;
    saleProceeds += data.saleProceeds;
    if (data.holdingCreatedDay && data.holdingCreatedDay >= cutoffDateKey) {
      newlySoldProceeds += data.saleProceeds;
    }
  }

  return { current, newHoldingsValue, saleProceeds, newlySoldProceeds };
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
