import { asc, eq } from "drizzle-orm";
import { db, usersTable, holdingsTable, portfolioSnapshotsTable, marketCloseSnapshotsTable, dailyChangeSnapshotsTable } from "@workspace/db";
import { decryptFromStorage } from "./encryption";
import { goldPurity, type GoldKarat, type StoredHolding } from "./portfolioValue";
import { tradingDayKey, isSaturday } from "./cairoDate";
import { SANITY_MAX_PCT } from "./portfolioAlertCron";

// Explicit, requested starting point for backfilled history — earlier days
// exist in portfolio_snapshots for some users, but this is where the
// full-reset rebuild was asked to start from, not a data limitation.
const MIN_BACKFILL_DATE = "2026-08-01";

/**
 * Wipes ALL daily_change_snapshots rows for every user — a genuine full
 * reset, meant to be followed immediately by re-running both backfill
 * passes below. Safe with respect to the LIVE, going-forward figure: the
 * cron in portfolioAlertCron.ts recomputes and rewrites today's row every
 * 5 minutes regardless of what's in the table, using the gaming-proof
 * gold/silver+EGX method — wiping today's row just means it's briefly
 * empty until the next tick, never wrong.
 */
export async function resetDailyChangeHistory(): Promise<{ rowsDeleted: number }> {
  const deleted = await db.delete(dailyChangeSnapshotsTable).returning({ id: dailyChangeSnapshotsTable.id });
  return { rowsDeleted: deleted.length };
}

/**
 * One-time (or re-runnable) backfill for daily_change_snapshots, for days
 * before the live cron (portfolioAlertCron.ts) started recording them.
 *
 * Only fills in a day when it's provably correct, never a guess:
 *  - Gold/silver only — there's no historical per-stock price anywhere in
 *    this app, so a stock-only user simply can't be backfilled at all; the
 *    real answer is "not enough data," not a fabricated number.
 *  - A holding only counts toward a given day if its `updatedAt` is on or
 *    before the PRIOR day — i.e. it was never edited between then and now.
 *    Since this uses the holding's CURRENT grams for both sides of the
 *    ratio (see computePeriodPerformance's own comment for why that's
 *    gaming-proof), that's only accurate for a day if the grams genuinely
 *    haven't changed since — an edited-since holding is excluded from that
 *    specific day rather than assumed unchanged.
 *  - Never overwrites a day the live cron already recorded for real.
 *  - Only walks days market_close_snapshots actually has real prices for —
 *    it can't manufacture history from before that table existed either.
 */
export async function backfillDailyChanges(): Promise<{ daysWritten: number; usersAffected: number }> {
  const prices = await db
    .select({ date: marketCloseSnapshotsTable.date, goldEgp24k: marketCloseSnapshotsTable.goldEgp24k, silverEgp: marketCloseSnapshotsTable.silverEgp })
    .from(marketCloseSnapshotsTable)
    .orderBy(asc(marketCloseSnapshotsTable.date));
  if (prices.length < 2) return { daysWritten: 0, usersAffected: 0 };

  const today = tradingDayKey();
  const users = await db.select({ id: usersTable.id }).from(usersTable);

  let daysWritten = 0;
  let usersAffected = 0;

  for (const user of users) {
    const holdingRows = await db.select().from(holdingsTable).where(eq(holdingsTable.userId, user.id));
    const metals = holdingRows
      .map(row => ({
        holding: { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding,
        updatedDay: tradingDayKey(row.updatedAt),
      }))
      .filter(m => m.holding.type === "gold" || m.holding.type === "silver");
    if (metals.length === 0) continue; // nothing backfillable for this user — no historical stock data exists

    const existing = await db
      .select({ date: dailyChangeSnapshotsTable.date })
      .from(dailyChangeSnapshotsTable)
      .where(eq(dailyChangeSnapshotsTable.userId, user.id));
    const existingDays = new Set(existing.map(r => r.date));

    let wroteAny = false;
    for (let i = 1; i < prices.length; i++) {
      const cur = prices[i];
      const prev = prices[i - 1];
      if (cur.date < MIN_BACKFILL_DATE) continue; // requested starting point
      if (cur.date >= today) continue; // today/future is the live cron's job, not this backfill's
      if (existingDays.has(cur.date)) continue; // never overwrite a real, forward-recorded value

      // Only holdings untouched since the prior day accurately represent
      // what was actually held on both sides of this day's comparison.
      const eligible = metals.filter(m => m.updatedDay <= prev.date);
      if (eligible.length === 0) continue;

      let pureGoldGrams = 0;
      let silverGrams = 0;
      for (const { holding } of eligible) {
        if (holding.type === "gold") {
          pureGoldGrams += (Number(holding.grams) || 0) * goldPurity((holding.karat as GoldKarat) ?? "24k");
        } else {
          silverGrams += Number(holding.grams) || 0;
        }
      }

      const baseline = pureGoldGrams * prev.goldEgp24k + silverGrams * prev.silverEgp;
      if (baseline <= 0) continue;
      const current = pureGoldGrams * cur.goldEgp24k + silverGrams * cur.silverEgp;
      // Every market this app prices is closed the entire span of a
      // Saturday trading day (see isSaturday's own comment) — any nonzero
      // ratio here is live-feed jitter, not a real move, so it's forced to
      // exactly 0 rather than trusted.
      const pctReturn = isSaturday(cur.date) ? 0 : ((current - baseline) / baseline) * 100;

      await db
        .insert(dailyChangeSnapshotsTable)
        .values({ id: `dchg_${user.id}_${cur.date}`, userId: user.id, date: cur.date, pctReturn })
        .onConflictDoNothing();
      daysWritten++;
      wroteAny = true;
    }
    if (wroteAny) usersAffected++;
  }

  return { daysWritten, usersAffected };
}

/**
 * Second-pass, broader backfill for whatever gaps remain after
 * backfillDailyChanges — meant to be run right after it, and safe to run
 * on its own too since it also never overwrites an existing day.
 *
 * Uses day-to-day totalValue from portfolio_snapshots directly (all
 * holding types, not just gold/silver/EGX) — full daily history already
 * exists there for every user regardless of what they hold, going back to
 * whenever they first opened the app. The catch, and why this ISN'T the
 * primary method: a raw day-to-day % change on total portfolio value is
 * exactly what caused the leaderboard incidents earlier today — a holding
 * added, edited, or removed reads as a huge fake "gain" or "loss" that has
 * nothing to do with real market movement. Confirmed on real data: one
 * account's snapshots show a raw -25% single-day reading that's a holding
 * being removed, not an actual crash.
 *
 * The mitigation: skip any day whose raw change exceeds SANITY_MAX_PCT
 * (20%, the same threshold portfolioAlertCron.ts already uses to decide
 * whether a move is even plausible for a real diversified portfolio) —
 * don't show it at all rather than show a number that's probably fake.
 * This doesn't eliminate the underlying risk the way the metals/EGX method
 * does (a *smaller* composition change, e.g. adding a modest holding,
 * could still slip through under the cap and read as real movement), which
 * is exactly why backfillDailyChanges's more precise, gaming-proof method
 * always gets first claim on a day — this function only ever fills in
 * whatever's left over, and is the visibly weaker source when the two
 * would disagree.
 */
export async function backfillDailyChangesFromSnapshots(): Promise<{ daysWritten: number; usersAffected: number }> {
  const today = tradingDayKey();
  const users = await db.select({ id: usersTable.id }).from(usersTable);

  let daysWritten = 0;
  let usersAffected = 0;

  for (const user of users) {
    const snapshots = await db
      .select({ date: portfolioSnapshotsTable.date, totalValue: portfolioSnapshotsTable.totalValue })
      .from(portfolioSnapshotsTable)
      .where(eq(portfolioSnapshotsTable.userId, user.id))
      .orderBy(asc(portfolioSnapshotsTable.date));
    if (snapshots.length < 2) continue;

    const existing = await db
      .select({ date: dailyChangeSnapshotsTable.date })
      .from(dailyChangeSnapshotsTable)
      .where(eq(dailyChangeSnapshotsTable.userId, user.id));
    const existingDays = new Set(existing.map(r => r.date));

    let wroteAny = false;
    for (let i = 1; i < snapshots.length; i++) {
      const cur = snapshots[i];
      const prev = snapshots[i - 1];
      if (cur.date < MIN_BACKFILL_DATE) continue; // requested starting point
      if (cur.date >= today) continue; // today/future is the live cron's job
      if (existingDays.has(cur.date)) continue; // never overwrite a real or metals-backfilled value
      if (prev.totalValue <= 0) continue;

      // Every market this app prices is closed the entire span of a
      // Saturday trading day (see isSaturday's own comment) — force 0
      // rather than trust this method's already-weaker raw value ratio,
      // which is even more likely to be a composition change (a holding
      // added/removed) than real movement on a day nothing was trading.
      const rawPctReturn = ((cur.totalValue - prev.totalValue) / prev.totalValue) * 100;
      if (!isSaturday(cur.date) && Math.abs(rawPctReturn) > SANITY_MAX_PCT) continue; // almost certainly a composition change, not real movement — skip rather than mislead
      const pctReturn = isSaturday(cur.date) ? 0 : rawPctReturn;

      await db
        .insert(dailyChangeSnapshotsTable)
        .values({ id: `dchg_${user.id}_${cur.date}`, userId: user.id, date: cur.date, pctReturn })
        .onConflictDoNothing();
      daysWritten++;
      wroteAny = true;
    }
    if (wroteAny) usersAffected++;
  }

  return { daysWritten, usersAffected };
}
