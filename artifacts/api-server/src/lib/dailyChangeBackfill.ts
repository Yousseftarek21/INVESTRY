import { asc, eq } from "drizzle-orm";
import { db, usersTable, holdingsTable, marketCloseSnapshotsTable, dailyChangeSnapshotsTable } from "@workspace/db";
import { decryptFromStorage } from "./encryption";
import { goldPurity, type GoldKarat, type StoredHolding } from "./portfolioValue";
import { tradingDayKey } from "./cairoDate";

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
      const pctReturn = ((current - baseline) / baseline) * 100;

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
