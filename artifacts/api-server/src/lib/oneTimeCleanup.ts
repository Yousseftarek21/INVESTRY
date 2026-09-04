import { db, performanceLeaderboardResultsTable } from "@workspace/db";
import { logger } from "./logger";

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
