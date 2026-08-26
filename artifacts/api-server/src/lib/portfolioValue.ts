import { db, holdingsTable, cashAccountsTable, soldHoldingsTable, marketCloseSnapshotsTable } from "@workspace/db";
import { eq, lte, desc } from "drizzle-orm";
import { decryptFromStorage } from "./encryption";
import { getCachedPrices, getCachedStocks } from "../routes/markets";
import { tradingDayKey } from "./cairoDate";

const TROY_OZ_TO_GRAMS = 31.1034768;

export type GoldKarat = "24k" | "22k" | "21k" | "18k";

export function goldPurity(karat: GoldKarat): number {
  return karat === "24k" ? 1 : karat === "22k" ? 22 / 24 : karat === "21k" ? 0.875 : 0.75;
}

// Mirrors artifacts/mobile/types/index.ts's Holding union — only the fields
// actually needed for valuation are read here, everything else is opaque.
export interface StoredHolding {
  id: string;
  type: string;
  [key: string]: unknown;
}

export function goldPricePerGram(goldUsd: number, usdToEgp: number, karat: GoldKarat): number {
  const perGramUsd = goldUsd / TROY_OZ_TO_GRAMS;
  return perGramUsd * goldPurity(karat) * usdToEgp;
}

export function silverPricePerGram(silverUsd: number, usdToEgp: number): number {
  return (silverUsd / TROY_OZ_TO_GRAMS) * usdToEgp;
}

/**
 * Live EGP price per unit (per gram for gold/silver, per share for stock) —
 * the number stamped server-side into a holding's `priceAtCreationEgp`/
 * `priceAtLastEditEgp` fields at the moment it's created or edited, NEVER
 * supplied by the client. This is what makes a lot's baseline unfakeable:
 * the price is read from the same live feeds getCachedPrices()/
 * getCachedStocks() already trust elsewhere, at the exact instant the
 * server processes the request, not typed in by the user.
 *
 * Returns null for a type with no live price feed (real_estate,
 * personal_asset, fixed_income) or when the EGX feed doesn't have the
 * requested symbol — callers must treat null as "don't stamp anything"
 * rather than fabricate a number.
 */
export function livePricePerUnit(
  holding: StoredHolding,
  prices: { goldUsd: number; silverUsd: number; usdToEgp: number },
  egxPrices: Record<string, number>,
): number | null {
  if (holding.type === "gold") {
    return goldPricePerGram(prices.goldUsd, prices.usdToEgp, (holding.karat as GoldKarat) ?? "24k");
  }
  if (holding.type === "silver") {
    return silverPricePerGram(prices.silverUsd, prices.usdToEgp);
  }
  if (holding.type === "stock") {
    const price = egxPrices[String(holding.symbol)];
    return typeof price === "number" ? price : null;
  }
  return null;
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

/** Real historical gold/silver EGP-24k-equivalent prices on or before `dateKey` (Cairo calendar day), from market_close_snapshots — the same table markets.ts's own "today vs yesterday" gold/silver change already reads from. Null if the table has no row that far back (e.g. before it started being written). */
async function metalPriceOnOrBefore(dateKey: string): Promise<{ goldEgp24k: number; silverEgp: number } | null> {
  const [row] = await db
    .select({ goldEgp24k: marketCloseSnapshotsTable.goldEgp24k, silverEgp: marketCloseSnapshotsTable.silverEgp })
    .from(marketCloseSnapshotsTable)
    .where(lte(marketCloseSnapshotsTable.date, dateKey))
    .orderBy(desc(marketCloseSnapshotsTable.date))
    .limit(1);
  return row ?? null;
}

export interface PeriodPerformance {
  /** True, computable EGP return for this period, or null if there's nothing real to measure it against. */
  pctReturn: number | null;
}

/**
 * The leaderboard's period return, restricted to gold, silver, and EGX
 * stocks — the only holding types with real, live, objective market prices.
 * Real estate, personal assets, and fixed income are entirely excluded from
 * this calculation (not offset, not filtered — simply never read here):
 * their values are self-reported by the user with no independent price
 * feed, which is exactly the opening this whole feature has been getting
 * exploited/broken through — a backdated or inflated "current value" on a
 * newly-entered property was the actual mechanism behind both the original
 * 853% incident and this week's >100%/-100% swings.
 *
 * Gold and silver use a genuinely gaming-proof method: real historical EGP
 * prices from market_close_snapshots (the same table markets.ts's own
 * "today's change" reads from), applied to the user's CURRENT grams on both
 * sides of the comparison —
 *   baseline = currentGrams × priceOnBaselineDate,  current = currentGrams × priceToday
 * Because the same gram figure appears on both sides, it cancels out of the
 * ratio algebraically: the result is ALWAYS exactly the metal's real price
 * move over the period, no matter how many grams are held or when they were
 * added or edited. This is the one case in the whole leaderboard where
 * "when was this holding touched" genuinely doesn't matter, because the
 * question being answered is "how did the metal's price move," not "how
 * did this specific quantity's value move."
 *
 * EGX stocks don't have that: no historical per-stock closing price is
 * recorded anywhere in this app (confirmed — getCachedStocks() is a live
 * in-memory cache only, nothing persisted day to day, unlike gold/silver).
 * Without a real price to compare against, a stock holding that already
 * existed before the period contributes its live gain/loss vs its entered
 * cost basis (same caveat as before: cost basis is user-entered and could
 * be backdated, but EGX prices are public and checkable, unlike real
 * estate/personal-asset valuations — a materially narrower risk). A stock
 * bought (or last quantity-edited) DURING the period instead uses the
 * server-stamped priceAtCreationEgp/priceAtLastEditEgp captured the instant
 * that happened (never client-supplied — see POST/PUT /holdings) as its
 * baseline, folded into the same ratio — a real, unfakeable "how has this
 * stock moved since it entered the portfolio" contribution instead of being
 * excluded outright. Only a stock with no stamp at all (older data from
 * before this stamping existed) is excluded from the ratio entirely
 * (contributes to neither side) — accepted as a real, honestly-disclosed
 * gap rather than another fabricated number.
 *
 * Returns pctReturn: null when the user has nothing eligible to measure at
 * all (no gold/silver held and no pre-existing stock holdings/sales) — not
 * a fabricated 0% or -100%, genuinely "nothing to rank yet."
 */
export async function computePeriodPerformance(userId: string, cutoffDateKey: string): Promise<PeriodPerformance> {
  const [holdingRows, soldRows, prices, egxStocks, baselineMetal] = await Promise.all([
    db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
    db.select().from(soldHoldingsTable).where(eq(soldHoldingsTable.userId, userId)),
    getCachedPrices(), // also ensures today's market_close_snapshots row exists (written as a side effect)
    getCachedStocks().catch(() => []),
    metalPriceOnOrBefore(cutoffDateKey),
  ]);
  const todayMetal = await metalPriceOnOrBefore(tradingDayKey());

  const egxPrices: Record<string, number> = {};
  for (const s of egxStocks) egxPrices[s.symbol] = s.price;

  let pureGoldGrams = 0; // 24k-equivalent, purity-weighted across mixed karats
  let silverGrams = 0;
  let stockCurrent = 0;
  let stockBaselineCost = 0; // cost basis of stock holdings that predate the period — the baseline approximation
  for (const row of holdingRows) {
    const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
    if (holding.type === "gold") {
      pureGoldGrams += (Number(holding.grams) || 0) * goldPurity((holding.karat as GoldKarat) ?? "24k");
    } else if (holding.type === "silver") {
      silverGrams += Number(holding.grams) || 0;
    } else if (holding.type === "stock") {
      const value = computeHoldingValue(holding, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices);
      if (tradingDayKey(row.createdAt) < cutoffDateKey) {
        stockCurrent += value;
        stockBaselineCost += costBasisEGP(holding, prices.usdToEgp);
      } else {
        // Bought during this period — no pre-period cost basis to ratio
        // against, but the server-stamped price captured the instant this
        // lot was created/last edited (priceAtCreationEgp/
        // priceAtLastEditEgp, never client-supplied — see POST/PUT
        // /holdings) is a real, unfakeable baseline for "how has this stock
        // moved since it entered the portfolio." Folded into the same
        // ratio as pre-period stock so it contributes a real % instead of
        // being excluded outright.
        const stampedPrice = (holding.priceAtLastEditEgp ?? holding.priceAtCreationEgp) as number | undefined;
        if (typeof stampedPrice === "number" && Number.isFinite(stampedPrice)) {
          stockCurrent += value;
          stockBaselineCost += (Number(holding.shares) || 0) * stampedPrice;
        }
        // No stamp available (older data from before stamping existed):
        // excluded entirely, exactly as before — never fabricated.
      }
    }
  }

  // A metal holding still HELD uses the pure price-ratio (current grams on
  // both sides — see the function comment). A metal holding SOLD this
  // period no longer has "current grams" to ratio against, so it falls
  // back to the same treatment as a sold stock: its stored cost basis (what
  // was actually paid, recorded at sale time) as the baseline contribution,
  // its real sale proceeds as the current contribution — same accepted,
  // narrower "cost basis could be backdated" caveat as stocks, and only for
  // the sale event itself, not for anything still held.
  let metalSaleProceeds = 0;
  let metalSaleCostBasis = 0;
  let stockSaleProceeds = 0;
  let stockSaleCostBasis = 0;
  for (const row of soldRows) {
    const data = decryptFromStorage(row.data) as {
      type?: string; saleDate?: string; saleProceeds?: number; holdingCreatedDay?: string; costBasis?: number;
    };
    if (!data.saleDate || typeof data.saleProceeds !== "number") continue;
    if (data.saleDate < cutoffDateKey) continue;
    if (!data.holdingCreatedDay || data.holdingCreatedDay >= cutoffDateKey) continue; // bought and sold within the period: excluded entirely
    if (data.type === "gold" || data.type === "silver") {
      metalSaleProceeds += data.saleProceeds;
      metalSaleCostBasis += typeof data.costBasis === "number" ? data.costBasis : data.saleProceeds;
    } else if (data.type === "stock") {
      stockSaleProceeds += data.saleProceeds;
      stockSaleCostBasis += typeof data.costBasis === "number" ? data.costBasis : data.saleProceeds;
    }
  }

  const hasMetal = pureGoldGrams > 0 || silverGrams > 0;
  const hasMetalSale = metalSaleProceeds > 0;
  const hasStock = stockCurrent > 0 || stockSaleProceeds > 0;
  if (!hasMetal && !hasMetalSale && !hasStock) return { pctReturn: null };

  let baseline = stockBaselineCost + stockSaleCostBasis + metalSaleCostBasis;
  let current = stockCurrent + stockSaleProceeds + metalSaleProceeds;
  if (hasMetal) {
    const today = todayMetal ?? await metalPriceOnOrBefore(tradingDayKey());
    const base = baselineMetal ?? today; // no historical row on record yet (table too new) — fall back to today's price on both sides rather than fabricate a number, so still-held metal contributes its live value with zero assumed movement
    if (today && base) {
      baseline += pureGoldGrams * base.goldEgp24k + silverGrams * base.silverEgp;
      current += pureGoldGrams * today.goldEgp24k + silverGrams * today.silverEgp;
    }
  }

  if (baseline <= 0) return { pctReturn: null };
  return { pctReturn: ((current - baseline) / baseline) * 100 };
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
