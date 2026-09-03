import { db, holdingsTable, cashAccountsTable, soldHoldingsTable, marketCloseSnapshotsTable, egxCloseSnapshotsTable, type DbHolding } from "@workspace/db";
import { eq, lte, desc, and } from "drizzle-orm";
import { decryptFromStorage } from "./encryption";
import { getCachedPrices, getCachedStocks } from "../routes/markets";
import { tradingDayKey, cairoDateString } from "./cairoDate";

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

// Sums outstanding loan balances across every fixed_income holding's
// linkedLoan (see LinkedLoan in artifacts/mobile/types/index.ts) — mirrors
// utils/cash.ts's computeTotalLoanBalanceEGP on the client. Fixes a real
// double-counting bug: a certificate keeps its own full value, and money
// borrowed against it (spent on other holdings) was never netted back out
// anywhere, so a 100k certificate + a 90k loan spent on gold read as 190k
// instead of the real ~100k net position. No currency conversion —
// LinkedLoan has no currency field, outstandingBalance is always plain EGP.
export function totalLoanBalanceEGP(holdings: StoredHolding[]): number {
  return holdings.reduce((sum, h) => {
    if (h.type !== "fixed_income") return sum;
    const loan = h.linkedLoan as { outstandingBalance?: number } | undefined;
    return sum + (Number(loan?.outstandingBalance) || 0);
  }, 0);
}

/**
 * Total current value (EGP) of one user's investment holdings only —
 * matches "Total Portfolio Value" on the Home screen exactly (gold,
 * silver, stocks, real estate, personal assets, fixed income), net of any
 * outstanding linked-loan balances (see totalLoanBalanceEGP above) the same
 * way the Home screen nets them out. Cash is deliberately excluded: the app
 * shows it separately, under "Net Worth incl. cash", not as part of the
 * portfolio itself. This value is what both the multi-day snapshot history
 * (1W/1M/etc charts) and the ±1% portfolio alert are computed from, so it
 * needs to mean the same thing the app displays, not a broader net-worth
 * figure.
 */
export async function computeUserPortfolioValue(userId: string): Promise<number> {
  const [holdingRows, prices, egxStocks] = await Promise.all([
    db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
    getCachedPrices(),
    getCachedStocks().catch(() => []), // stock pricing degrades to purchase price if this fails
  ]);

  const egxPrices: Record<string, number> = {};
  for (const s of egxStocks) egxPrices[s.symbol] = s.price;

  const holdings = holdingRows.map(row => ({ id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding));

  const grossValue = holdings.reduce((sum, holding) => {
    return sum + computeHoldingValue(holding, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices);
  }, 0);

  // Floored at 0 — total debt exceeding total assets should never render
  // as a negative headline figure.
  return Math.max(0, grossValue - totalLoanBalanceEGP(holdings));
}

/** Real historical gold/silver EGP-24k-equivalent prices on or before
 * `dateKey` (Cairo calendar day), from market_close_snapshots — the same
 * table markets.ts's own "today vs yesterday" gold/silver change already
 * reads from. Null if the table has no row that far back (e.g. before it
 * started being written).
 *
 * If the matched row IS today's (still in progress), returns its fixed
 * OPEN price, never its continuously-updating close — that close column is
 * overwritten with the live price on every fetch (see markets.ts's
 * recordAndGetPrevClose), so "the price on or before today" would otherwise
 * always converge to "the price right now": comparing a period's baseline
 * against essentially itself, showing a permanent ~0% for everyone on the
 * exact day a new week/month starts, no matter how far the market actually
 * moved that day. Any date strictly BEFORE today has a real frozen close
 * (untouched since that day rolled over), so that case is unaffected. */
async function metalPriceOnOrBefore(dateKey: string): Promise<{ goldEgp24k: number; silverEgp: number } | null> {
  const [row] = await db
    .select({
      date: marketCloseSnapshotsTable.date,
      goldEgp24k: marketCloseSnapshotsTable.goldEgp24k,
      silverEgp: marketCloseSnapshotsTable.silverEgp,
      openGoldEgp24k: marketCloseSnapshotsTable.openGoldEgp24k,
      openSilverEgp: marketCloseSnapshotsTable.openSilverEgp,
    })
    .from(marketCloseSnapshotsTable)
    .where(lte(marketCloseSnapshotsTable.date, dateKey))
    .orderBy(desc(marketCloseSnapshotsTable.date))
    .limit(1);
  if (!row) return null;
  if (row.date === cairoDateString()) {
    return { goldEgp24k: row.openGoldEgp24k, silverEgp: row.openSilverEgp };
  }
  return { goldEgp24k: row.goldEgp24k, silverEgp: row.silverEgp };
}

/** Real historical EGX close price for `symbol` on or before `dateKey`, from
 * egx_close_snapshots (markets.ts's fetchStocks() writes these, throttled to
 * once per ~5 min). Null if the table has no row that far back yet for this
 * symbol — e.g. right after this table started being written, or a symbol
 * that's never been fetched. Callers fall back to the cost-basis
 * approximation in that case, same as before this existed.
 *
 * Same "today's row uses OPEN, not the continuously-updating close" rule as
 * metalPriceOnOrBefore above, for the same reason — without it, a period
 * that starts today would always ratio a stock's current price against
 * itself and show ~0% no matter how much the stock actually moved today. */
async function stockPriceOnOrBefore(symbol: string, dateKey: string): Promise<number | null> {
  const [row] = await db
    .select({ date: egxCloseSnapshotsTable.date, closePrice: egxCloseSnapshotsTable.closePrice, openPrice: egxCloseSnapshotsTable.openPrice })
    .from(egxCloseSnapshotsTable)
    .where(and(eq(egxCloseSnapshotsTable.symbol, symbol), lte(egxCloseSnapshotsTable.date, dateKey)))
    .orderBy(desc(egxCloseSnapshotsTable.date))
    .limit(1);
  if (!row) return null;
  return row.date === cairoDateString() ? row.openPrice : row.closePrice;
}

export interface PeriodPerformance {
  /** True, computable EGP return for this period, or null if there's nothing real to measure it against. */
  pctReturn: number | null;
}

// Mirrors artifacts/mobile/utils/pctDelta.ts exactly (same two functions,
// same formulas) — kept as its own small server-side copy rather than a
// shared package, same call this codebase already made for cairoDate.ts.
// Converts "today's value + today's live % change" into the EGP delta since
// the trading day began, without the v*pct shortcut (which applies the
// percentage to TODAY's value instead of the day's start and
// under/overstates the delta as the move gets bigger).
function pctDelta(todaysValue: number, pctChange: number): number {
  const f = pctChange / 100;
  if (f <= -1) return -todaysValue;
  return (todaysValue * f) / (1 + f);
}

// Same as todayContributionFromStamp in pctDelta.ts — the honest, unfakeable
// contribution for a lot added/edited today: current value minus what it
// was worth at the server-stamped price captured that instant. Null (not 0)
// when no stamp exists, so the caller can exclude the lot entirely exactly
// like the client does, rather than fabricating a baseline.
function todayContributionFromStamp(
  stampedPricePerUnit: number | null | undefined,
  quantity: number,
  currentValueEGP: number,
): number | null {
  if (stampedPricePerUnit == null || !Number.isFinite(stampedPricePerUnit)) return null;
  return currentValueEGP - quantity * stampedPricePerUnit;
}

/**
 * The leaderboard's return for a period that starts TODAY (the first day of
 * a new week/month) — used instead of the historical-ratio method below so
 * the number a user sees on the leaderboard for "today" is IDENTICAL to
 * what their own portfolio card's Today chip shows, not a separately
 * re-derived approximation. Ports (tabs)/index.tsx's `summary` useMemo
 * byte-for-byte for the gold/silver/stock buckets specifically — same
 * pctDelta formula, same live goldChangePercentEgp/silverChangePercentEgp/
 * EGX changePercent inputs, same server-stamped-price fallback for a lot
 * touched today — restricted to gold/silver/EGX stock only (no Fixed
 * Income, no real estate/personal assets), matching computePeriodPerformance's
 * own scope and anti-gaming boundary exactly.
 *
 * Deliberately does NOT touch sold_holdings — the client's own Today chip
 * only ever iterates currently-held holdings too, so a lot sold today
 * simply drops out of both totalValue and todayGain with no special case,
 * and this mirrors that.
 */
async function computeTodayEligiblePerformance(
  holdingRows: DbHolding[],
  prices: Awaited<ReturnType<typeof getCachedPrices>>,
  egxStocks: Awaited<ReturnType<typeof getCachedStocks>>,
): Promise<PeriodPerformance> {
  const egxPrices: Record<string, number> = {};
  const egxChangePercent: Record<string, number> = {};
  for (const s of egxStocks) { egxPrices[s.symbol] = s.price; egxChangePercent[s.symbol] = s.changePercent; }

  const today = tradingDayKey();
  let eligibleValue = 0;
  let todayGain = 0;

  for (const row of holdingRows) {
    const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
    if (holding.type !== "gold" && holding.type !== "silver" && holding.type !== "stock") continue;

    const value = computeHoldingValue(holding, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices);
    eligibleValue += value;
    // touchedToday, mirroring utils/cairoDate.ts's own touchedToday exactly:
    // true when this row's updatedAt falls on today's TRADING day (the
    // 18:00 New York boundary), not the calendar day.
    const touchedToday = tradingDayKey(row.updatedAt) === today;

    if (!touchedToday) {
      if (holding.type === "gold") {
        todayGain += pctDelta(value, prices.goldChangePercentEgp);
      } else if (holding.type === "silver") {
        todayGain += pctDelta(value, prices.silverChangePercentEgp);
      } else {
        todayGain += pctDelta(value, egxChangePercent[String(holding.symbol)] ?? 0);
      }
    } else {
      const stampedPrice = (holding.priceAtLastEditEgp ?? holding.priceAtCreationEgp) as number | undefined;
      const quantity = holding.type === "stock" ? Number(holding.shares) || 0 : Number(holding.grams) || 0;
      const contribution = todayContributionFromStamp(stampedPrice, quantity, value);
      if (contribution != null) todayGain += contribution;
    }
  }

  if (eligibleValue <= 0) return { pctReturn: null };
  const startOfDayValue = eligibleValue - todayGain;
  if (startOfDayValue <= 0) return { pctReturn: null };
  return { pctReturn: (todayGain / startOfDayValue) * 100 };
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
 * EGX stocks now have the same real-price-ratio treatment via
 * egx_close_snapshots (one row per ticker per Cairo day, written by
 * markets.ts's fetchStocks() — see that table's own schema comment for why
 * it was added): a stock holding that predates the period ratios its
 * CURRENT shares against its price on or before cutoffDateKey, exactly like
 * gold/silver above, immune to cost-basis gaming/staleness and correct on
 * any period boundary including the very first day of a new week. Only
 * falls back to its entered cost basis (same caveat as before: user-entered,
 * could be backdated, but EGX prices are public and checkable) when no
 * snapshot that far back exists yet — e.g. shortly after this table started
 * being written, before enough daily history has accumulated. A stock
 * bought (or last quantity-edited) DURING the period instead uses the
 * server-stamped priceAtCreationEgp/priceAtLastEditEgp captured the instant
 * that happened (never client-supplied — see POST/PUT /holdings) as its
 * baseline, folded into the same ratio — a real, unfakeable "how has this
 * stock moved since it entered the portfolio" contribution instead of being
 * excluded outright. A stock with NO stamp at all is treated as if it
 * predates the period instead (cost basis vs current, same as any other
 * pre-period holding) rather than excluded: since every stock creation is
 * stamped unconditionally from the moment this feature shipped, a stamp-less
 * row is proof the holding already existed before that — it couldn't
 * possibly have been added to exploit "just created, no stamp yet" leniency,
 * because that leniency didn't exist yet when it was added. This is what
 * keeps the leaderboard from staying permanently skewed toward gold-only
 * ties for every user whose stock holdings predate this rollout.
 *
 * Returns pctReturn: null when the user has nothing eligible to measure at
 * all (no gold/silver held and no pre-existing stock holdings/sales) — not
 * a fabricated 0% or -100%, genuinely "nothing to rank yet."
 *
 * Everything above describes the historical-ratio path, used once a period
 * is at least a day old. When cutoffDateKey IS today (the period just
 * started), this delegates entirely to computeTodayEligiblePerformance
 * instead — see that function's own comment for why "today" needs a
 * genuinely different method, not just a special case of the ratio above.
 */
export async function computePeriodPerformance(userId: string, cutoffDateKey: string): Promise<PeriodPerformance> {
  const [holdingRows, soldRows, prices, egxStocks, baselineMetal] = await Promise.all([
    db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
    db.select().from(soldHoldingsTable).where(eq(soldHoldingsTable.userId, userId)),
    getCachedPrices(), // also ensures today's market_close_snapshots row exists (written as a side effect)
    getCachedStocks().catch(() => []),
    metalPriceOnOrBefore(cutoffDateKey),
  ]);

  // The period starts TODAY (day one of a new week/month) — delegate to the
  // exact-match-with-the-client method instead of the historical-ratio one
  // below. See computeTodayEligiblePerformance's own comment for why: any
  // ratio computed against "today" ends up comparing the live price to
  // itself no matter how carefully the open/close distinction is handled,
  // and more importantly, the user's own portfolio card already shows a
  // real, live "Today" number for these same assets — this makes sure the
  // leaderboard shows that same number instead of an independently-derived
  // one that can drift from it.
  if (cutoffDateKey === cairoDateString()) {
    return computeTodayEligiblePerformance(holdingRows, prices, egxStocks);
  }

  // The genuine live price right now — computed directly from prices
  // (already fetched above), not looked up via metalPriceOnOrBefore. That
  // function's job is resolving a *past* boundary date to a real frozen
  // price (and, for today specifically, today's OPEN — see its own
  // comment); routing "the current price" through it too would have
  // returned today's OPEN here as well, converging "current" toward
  // "baseline" and producing the same permanent ~0% bug this whole fix
  // exists to remove.
  const todayMetal = {
    goldEgp24k: goldPricePerGram(prices.goldUsd, prices.usdToEgp, "24k"),
    silverEgp: silverPricePerGram(prices.silverUsd, prices.usdToEgp),
  };

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
      const stampedPrice = (holding.priceAtLastEditEgp ?? holding.priceAtCreationEgp) as number | undefined;
      const hasStamp = typeof stampedPrice === "number" && Number.isFinite(stampedPrice);

      if (tradingDayKey(row.createdAt) < cutoffDateKey || !hasStamp) {
        // Predates the period — OR predates the stamping feature itself
        // (no stamp at all). The second case is proof this lot was already
        // sitting in the database before stamping shipped, since every
        // stock creation is stamped unconditionally from that point on: a
        // holding that couldn't possibly have been created to exploit "just
        // added, no stamp yet" leniency (because that leniency didn't exist
        // when it was added) gets the same honest cost-basis treatment as
        // any other pre-period holding, rather than being excluded just
        // because it happens to fall inside this calendar period.
        //
        // Real historical price first, cost basis only as a fallback: a
        // stock's own cost basis is its ALL-TIME purchase price, not its
        // price when this period started — using it directly is what made a
        // holding up 58% since purchase show as "+58% this week" on the very
        // day a new week began, with zero real movement yet to justify it.
        // egx_close_snapshots (see markets.ts's fetchStocks()) gives a real
        // price-ratio here, exactly like gold/silver's metalPriceOnOrBefore
        // above — current shares on both sides, immune to cost-basis
        // gaming/staleness. Falls back to cost basis only when no snapshot
        // that far back exists yet (e.g. right after this table started
        // being written) rather than excluding the holding outright.
        const histPrice = await stockPriceOnOrBefore(String(holding.symbol), cutoffDateKey);
        stockCurrent += value;
        stockBaselineCost += histPrice != null
          ? (Number(holding.shares) || 0) * histPrice
          : costBasisEGP(holding, prices.usdToEgp);
      } else {
        // Bought (or last edited) during this period, WITH a real stamp —
        // no pre-period cost basis to ratio against, but the server-stamped
        // price captured the instant this lot was created/last edited
        // (priceAtCreationEgp/priceAtLastEditEgp, never client-supplied —
        // see POST/PUT /holdings) is a real, unfakeable baseline for "how
        // has this stock moved since it entered the portfolio." Folded into
        // the same ratio as pre-period stock so it contributes a real %
        // instead of being excluded outright.
        stockCurrent += value;
        stockBaselineCost += (Number(holding.shares) || 0) * stampedPrice!;
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
  let metalSaleAmountInvested = 0;
  let stockSaleProceeds = 0;
  let stockSaleAmountInvested = 0;
  for (const row of soldRows) {
    const data = decryptFromStorage(row.data) as {
      type?: string; saleDate?: string; saleProceeds?: number; holdingCreatedDay?: string;
      amountInvested?: number; costBasis?: number; // costBasis: pre-rename records, read for backward compatibility only — see holdings.ts's sell/delete routes for what actually gets written now
    };
    if (!data.saleDate || typeof data.saleProceeds !== "number") continue;
    if (data.saleDate < cutoffDateKey) continue;
    if (!data.holdingCreatedDay || data.holdingCreatedDay >= cutoffDateKey) continue; // bought and sold within the period: excluded entirely
    const amountInvested = typeof data.amountInvested === "number" ? data.amountInvested
      : typeof data.costBasis === "number" ? data.costBasis
      : data.saleProceeds;
    if (data.type === "gold" || data.type === "silver") {
      metalSaleProceeds += data.saleProceeds;
      metalSaleAmountInvested += amountInvested;
    } else if (data.type === "stock") {
      stockSaleProceeds += data.saleProceeds;
      stockSaleAmountInvested += amountInvested;
    }
  }

  const hasMetal = pureGoldGrams > 0 || silverGrams > 0;
  const hasMetalSale = metalSaleProceeds > 0;
  const hasStock = stockCurrent > 0 || stockSaleProceeds > 0;
  if (!hasMetal && !hasMetalSale && !hasStock) return { pctReturn: null };

  let baseline = stockBaselineCost + stockSaleAmountInvested + metalSaleAmountInvested;
  let current = stockCurrent + stockSaleProceeds + metalSaleProceeds;
  if (hasMetal) {
    const base = baselineMetal ?? todayMetal; // no historical row on record yet (table too new) — fall back to today's live price on both sides rather than fabricate a number, so still-held metal contributes its live value with zero assumed movement
    baseline += pureGoldGrams * base.goldEgp24k + silverGrams * base.silverEgp;
    current += pureGoldGrams * todayMetal.goldEgp24k + silverGrams * todayMetal.silverEgp;
  }

  if (baseline <= 0) return { pctReturn: null };
  return { pctReturn: ((current - baseline) / baseline) * 100 };
}

/**
 * The FROZEN twin of computePeriodPerformance, for a period that has
 * already ended — used by leaderboardPeriodResultsCron.ts to crown a
 * week/month's final top 3 once it's over, never for the live leaderboard.
 *
 * computePeriodPerformance itself is deliberately untouched by this: it's
 * the anti-gaming-hardened core behind the LIVE leaderboard (three real
 * production incidents in its history — see its own comment), and always
 * ratios a period's baseline against TODAY'S live price. That's exactly
 * wrong for "what were last week's final standings" once we're now in a
 * new week — it would compare the old baseline against this week's price
 * instead of the price the old period actually ended on. Genuinely
 * different question, so a genuinely separate function, not a branch
 * bolted onto the live one.
 *
 * Both ends resolved from real historical snapshots — metalPriceOnOrBefore
 * / stockPriceOnOrBefore (both already generic over any past date, not
 * "today"-specific) — never from getCachedPrices()/getCachedStocks() live
 * data. periodEndKey is always a date already in the past by construction
 * (the cron only calls this after a period has closed), so neither
 * function's special "today uses OPEN" case can ever fire here — no
 * date-is-today branch needed the way computePeriodPerformance has one.
 *
 * Same eligibility rule as the live function: gold/silver/EGX-stock only,
 * same sold-holdings period-membership logic, same "nothing real to
 * measure" -> null rather than a fabricated number. Where the live
 * function falls back to a live price when no historical row exists yet,
 * this has no live price to fall back to — a holding with no resolvable
 * price at EITHER end is simply excluded from the ratio, rather than
 * guessed at.
 */
export async function computeFrozenPeriodPerformance(
  userId: string,
  periodStartKey: string,
  periodEndKey: string,
): Promise<PeriodPerformance> {
  const [holdingRows, soldRows, baselineMetal, endMetal] = await Promise.all([
    db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
    db.select().from(soldHoldingsTable).where(eq(soldHoldingsTable.userId, userId)),
    metalPriceOnOrBefore(periodStartKey),
    metalPriceOnOrBefore(periodEndKey),
  ]);

  let pureGoldGrams = 0; // 24k-equivalent, purity-weighted across mixed karats
  let silverGrams = 0;
  let stockCurrent = 0;
  let stockBaselineCost = 0;
  for (const row of holdingRows) {
    const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
    if (holding.type === "gold") {
      pureGoldGrams += (Number(holding.grams) || 0) * goldPurity((holding.karat as GoldKarat) ?? "24k");
    } else if (holding.type === "silver") {
      silverGrams += Number(holding.grams) || 0;
    } else if (holding.type === "stock") {
      const symbol = String(holding.symbol);
      const endPrice = await stockPriceOnOrBefore(symbol, periodEndKey);
      if (endPrice == null) continue; // no snapshot that recent — can't value this stock at period-end, exclude rather than guess

      const stampedPrice = (holding.priceAtLastEditEgp ?? holding.priceAtCreationEgp) as number | undefined;
      const hasStamp = typeof stampedPrice === "number" && Number.isFinite(stampedPrice);
      const shares = Number(holding.shares) || 0;

      if (tradingDayKey(row.createdAt) < periodStartKey || !hasStamp) {
        // Predates the period (or predates the stamping feature). Real,
        // gaming-proof historical price only — NOT the live function's
        // cost-basis fallback. This was a genuine bug, not just a
        // documented limitation: egx_close_snapshots is a young table, so
        // right after this feature shipped it had no row anywhere near a
        // week back for most symbols. Falling back to costBasisEGP there
        // means "this stock's entire ALL-TIME gain since purchase" gets
        // counted as "gained in the last week" — a stock bought months ago
        // and up 50% since would show +50% for one week alone. That's a
        // frozen, permanent record, unlike the live leaderboard's identical
        // fallback (which self-corrects every 5 minutes as the table fills
        // in) — bad enough here that excluding the stock is the honest
        // choice, not an approximation worth keeping.
        const startPrice = await stockPriceOnOrBefore(symbol, periodStartKey);
        if (startPrice == null) continue;
        stockCurrent += shares * endPrice;
        stockBaselineCost += shares * startPrice;
      } else {
        // Bought (or last edited) during this period, with a real stamp —
        // the stamped price is the baseline, same as the live function.
        stockCurrent += shares * endPrice;
        stockBaselineCost += shares * stampedPrice!;
      }
    }
  }

  let metalSaleProceeds = 0;
  let metalSaleAmountInvested = 0;
  let stockSaleProceeds = 0;
  let stockSaleAmountInvested = 0;
  for (const row of soldRows) {
    const data = decryptFromStorage(row.data) as {
      type?: string; saleDate?: string; saleProceeds?: number; holdingCreatedDay?: string;
      amountInvested?: number; costBasis?: number;
    };
    if (!data.saleDate || typeof data.saleProceeds !== "number") continue;
    // Must fall within THIS period specifically — a sale after periodEndKey
    // happened in a later period and isn't part of what this one closed on.
    if (data.saleDate < periodStartKey || data.saleDate > periodEndKey) continue;
    if (!data.holdingCreatedDay || data.holdingCreatedDay >= periodStartKey) continue; // bought and sold within the period: excluded entirely
    const amountInvested = typeof data.amountInvested === "number" ? data.amountInvested
      : typeof data.costBasis === "number" ? data.costBasis
      : data.saleProceeds;
    if (data.type === "gold" || data.type === "silver") {
      metalSaleProceeds += data.saleProceeds;
      metalSaleAmountInvested += amountInvested;
    } else if (data.type === "stock") {
      stockSaleProceeds += data.saleProceeds;
      stockSaleAmountInvested += amountInvested;
    }
  }

  const hasMetal = pureGoldGrams > 0 || silverGrams > 0;
  const hasMetalSale = metalSaleProceeds > 0;
  const hasStock = stockCurrent > 0 || stockSaleProceeds > 0;
  if (!hasMetal && !hasMetalSale && !hasStock) return { pctReturn: null };

  let baseline = stockBaselineCost + stockSaleAmountInvested + metalSaleAmountInvested;
  let current = stockCurrent + stockSaleProceeds + metalSaleProceeds;
  if (hasMetal) {
    // No live fallback here (unlike the live function's `?? todayMetal`) —
    // if either end has no historical row yet, metal simply isn't
    // included in the ratio rather than assuming zero movement.
    if (baselineMetal != null && endMetal != null) {
      baseline += pureGoldGrams * baselineMetal.goldEgp24k + silverGrams * baselineMetal.silverEgp;
      current += pureGoldGrams * endMetal.goldEgp24k + silverGrams * endMetal.silverEgp;
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

  const holdings: StoredHolding[] = [];
  for (const row of holdingRows) {
    const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
    holdings.push(holding);
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

  // Net the same linked-loan balance out of both the fixedIncome bucket and
  // the running total, by the same amount — keeps byClass still summing to
  // totalValue, and matches the client's own driftRows treatment (Analytics
  // screen), which target-allocation drift alerts need to agree with. See
  // totalLoanBalanceEGP's own comment for the underlying double-counting fix.
  const loanBalance = totalLoanBalanceEGP(holdings);
  if (loanBalance > 0) {
    const netFixedIncome = Math.max(0, byClass.fixedIncome - loanBalance);
    totalValue -= byClass.fixedIncome - netFixedIncome;
    byClass.fixedIncome = netFixedIncome;
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
