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

/**
 * Live current value (EGP) of only the holdings that already existed before
 * `cutoffDateKey` — used for the leaderboard, where naively comparing
 * "current total" against a period-start baseline let anyone top the
 * rankings by simply adding a large new holding mid-period (that full
 * value read as a "gain," nothing to do with actual investment
 * performance). A holding added on or after the cutoff contributes
 * nothing here, exactly as it should for "how did what I already had
 * perform" — new capital isn't a return.
 */
export async function computeEligiblePortfolioValue(userId: string, cutoffDateKey: string): Promise<number> {
  const [holdingRows, prices, egxStocks] = await Promise.all([
    db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
    getCachedPrices(),
    getCachedStocks().catch(() => []),
  ]);

  const egxPrices: Record<string, number> = {};
  for (const s of egxStocks) egxPrices[s.symbol] = s.price;

  return holdingRows.reduce((sum, row) => {
    if (tradingDayKey(row.createdAt) >= cutoffDateKey) return sum;
    const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
    return sum + computeHoldingValue(holding, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices);
  }, 0);
}

/**
 * Sum of sale proceeds (EGP) from holdings that (a) were sold on or after
 * `cutoffDateKey` — during the period being measured — and (b) already
 * existed before that same cutoff. Without this, selling a holding that
 * was part of the baseline makes a period's return look like a huge loss:
 * computeEligiblePortfolioValue no longer counts it (it's gone), but
 * nothing replaces its value, even though the sale itself may have been a
 * genuine gain. Adding the proceeds back in is what makes "current" mean
 * "what I still hold, plus what I got for what I sold" — the actual
 * question a performance leaderboard is supposed to answer.
 *
 * Holds sold before this field was ever recorded have no
 * holdingCreatedDay — treated as eligible rather than silently dropped,
 * since excluding a real historical sale is worse than the narrow window
 * where that default could be wrong.
 */
export async function sumEligibleSaleProceeds(userId: string, cutoffDateKey: string): Promise<number> {
  const rows = await db.select().from(soldHoldingsTable).where(eq(soldHoldingsTable.userId, userId));

  let sum = 0;
  for (const row of rows) {
    const data = decryptFromStorage(row.data) as {
      saleDate?: string; saleProceeds?: number; holdingCreatedDay?: string;
    };
    if (!data.saleDate || typeof data.saleProceeds !== "number") continue;
    if (data.saleDate < cutoffDateKey) continue;
    if (data.holdingCreatedDay && data.holdingCreatedDay >= cutoffDateKey) continue;
    sum += data.saleProceeds;
  }
  return sum;
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
