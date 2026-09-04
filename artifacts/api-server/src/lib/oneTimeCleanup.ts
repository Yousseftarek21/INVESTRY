import { db, performanceLeaderboardResultsTable, holdingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { tradingDayKey } from "./cairoDate";

// ─────────────────────────────────────────────────────────────────────────
// ONE-TIME CLEANUP — remove this whole file and its call site in index.ts
// once this has deployed and booted successfully once. Do not leave it
// running on every boot: it would also wipe any GOOD data the cron writes
// after the fix, not just the bad pre-fix rows.
//
// Wipes performance_leaderboard_results entirely. Every row in it was
// computed by the pre-fix version of computeFrozenPeriodPerformance
// (portfolioValue.ts), which had a real bug: a stock with no historical
// price snapshot old enough to cover the period's start fell back to that
// stock's all-time cost basis as the baseline — counting its entire
// lifetime gain as if it happened within that one week/month. No row this
// wrote is trustworthy (Claude has no direct production DB access, so
// this is a server-boot self-cleanup rather than a manual DELETE).
// Idempotent-safe to run more than once (deleting an already-empty table
// is a no-op) — the actual reason to remove it is the risk above, not
// re-run safety.
// ─────────────────────────────────────────────────────────────────────────
export async function oneTimeClearBadFrozenLeaderboardResults(): Promise<void> {
  try {
    const deleted = await db.delete(performanceLeaderboardResultsTable).returning({ id: performanceLeaderboardResultsTable.id });
    logger.info({ count: deleted.length }, "One-time cleanup: cleared performance_leaderboard_results (pre-fix bad data)");
  } catch (err) {
    logger.error({ err }, "oneTimeClearBadFrozenLeaderboardResults failed");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ONE-TIME CLEANUP — remove this whole function and its call site in
// index.ts once this has deployed and booted successfully once. Leaving it
// running on every boot would also un-stick a holding's updatedAt on a day
// it was GENUINELY given a real quantity change, defeating the actual
// anti-gaming protection routes/holdings.ts's PUT handler now correctly
// applies going forward.
//
// PUT /holdings/:id used to bump updatedAt on ANY real edit, not just a
// quantity (grams/shares) change — the actual anti-gaming boundary, fixed
// in that handler now. Every holding whose updatedAt already landed on
// today's trading day before that fix shipped is stuck showing the stale-
// reference-price fallback for the rest of today regardless — a live user
// report (Today read +3.55% against a real +0.14% market move), not
// hypothetical. Since the old bug bumped updatedAt on essentially any
// save, the overwhelming majority of holdings "touched today" right now
// got there via a non-quantity edit, not a genuine same-day quantity
// change — so resetting updatedAt back to createdAt for every holding
// currently flagged "touched today" is the correct one-time repair: it
// only touches the updatedAt column (never grams/shares/price/notes/
// anything in `data`), and un-sticks Today's-change back onto live market
// prices immediately for the holdings this bug actually broke.
export async function oneTimeResetTodayTouchedHoldings(): Promise<void> {
  try {
    const rows = await db.select({ id: holdingsTable.id, updatedAt: holdingsTable.updatedAt, createdAt: holdingsTable.createdAt }).from(holdingsTable);
    const todayKey = tradingDayKey();
    const stuck = rows.filter(r => tradingDayKey(r.updatedAt) === todayKey);
    for (const row of stuck) {
      await db.update(holdingsTable).set({ updatedAt: row.createdAt }).where(eq(holdingsTable.id, row.id));
    }
    logger.info({ count: stuck.length, total: rows.length }, "One-time cleanup: reset updatedAt for holdings stuck 'touched today' (pre-fix bug)");
  } catch (err) {
    logger.error({ err }, "oneTimeResetTodayTouchedHoldings failed");
  }
}
