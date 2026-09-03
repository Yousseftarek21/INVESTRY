import { and, eq } from "drizzle-orm";
import { db, performanceLeaderboardResultsTable } from "@workspace/db";
import { computeFrozenRankedReturns } from "./leaderboardRanking";
import { cairoWeekStart } from "./cairoDate";
import { utcMonthStart, utcMonthStartKey } from "./calendarDate";
import { logger } from "./logger";

// Checked every 6h, same cadence as referralMonthlyWinnerCron.ts (this is
// structurally a direct copy of that cron, extended for 3 winners instead
// of 1) — cheap once a period's results are already on record, since the
// idempotency check short-circuits before the ranking query for the rest
// of that period.
//
// Detects and freezes the previous week's and previous month's final top 3
// on the Performance Leaderboard the first time this runs after each has
// actually ended. No push notification here, unlike leaderboardRankCron's
// mid-week "you're #1" pushes — the user explicitly scoped this feature to
// "in the leaderboard screen, not outside it": everyone who's opted into
// the competition sees the celebration/recap in-app, nothing pushed.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let running = false;

async function crownPeriod(periodType: "week" | "month", periodStartKey: string, periodEndKey: string): Promise<void> {
  const [existing] = await db
    .select({ id: performanceLeaderboardResultsTable.id })
    .from(performanceLeaderboardResultsTable)
    .where(and(
      eq(performanceLeaderboardResultsTable.periodType, periodType),
      eq(performanceLeaderboardResultsTable.periodStart, periodStartKey),
    ));
  if (existing) return; // already crowned for this period — nothing to do until it closes again next cycle

  const ranked = await computeFrozenRankedReturns(periodStartKey, periodEndKey);
  const top3 = ranked.filter(r => r.rank <= 3);
  if (top3.length === 0) return; // nobody eligible this period — nothing to write, will just re-check next tick until someone is

  // onConflictDoNothing on the (periodType, periodStart, rank) unique
  // constraint — same race-safety pattern as referralMonthlyWinnerCron.ts,
  // safe against a concurrent process restart double-crowning.
  await db.insert(performanceLeaderboardResultsTable).values(
    top3.map(r => ({
      id: `perfwin_${periodType}_${periodStartKey}_${r.rank}`,
      periodType,
      periodStart: periodStartKey,
      rank: r.rank,
      userId: r.id,
      pctReturn: r.pctReturn,
    })),
  ).onConflictDoNothing({ target: [performanceLeaderboardResultsTable.periodType, performanceLeaderboardResultsTable.periodStart, performanceLeaderboardResultsTable.rank] });

  logger.info({ periodType, periodStart: periodStartKey, count: top3.length }, "Crowned performance leaderboard period results");
}

async function checkPeriodResults(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = new Date();

    // Previous week: cairoWeekStart() is the CURRENT week's Sunday: the
    // previous week ran from 7 days before that through the day before it.
    const thisWeekStart = cairoWeekStart(now);
    const lastWeekStartMs = Date.parse(`${thisWeekStart}T00:00:00Z`) - 7 * 86_400_000;
    const lastWeekStart = new Date(lastWeekStartMs).toISOString().slice(0, 10);
    const lastWeekEnd = new Date(Date.parse(`${thisWeekStart}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    await crownPeriod("week", lastWeekStart, lastWeekEnd);

    // Previous month: same arithmetic referralMonthlyWinnerCron.ts already
    // uses for its own "last month" boundary.
    const thisMonthStart = utcMonthStart(now);
    const lastMonthStart = utcMonthStart(new Date(thisMonthStart.getTime() - 1));
    const lastMonthStartKey = utcMonthStartKey(lastMonthStart);
    const lastMonthEndKey = new Date(thisMonthStart.getTime() - 86_400_000).toISOString().slice(0, 10);
    await crownPeriod("month", lastMonthStartKey, lastMonthEndKey);
  } catch (err) {
    logger.warn({ err }, "Leaderboard period results cron run failed");
  } finally {
    running = false;
  }
}

export function startLeaderboardPeriodResultsCron(): void {
  checkPeriodResults();
  setInterval(checkPeriodResults, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Leaderboard period results cron started");
}
