import { and, asc, desc, eq, lt, lte } from "drizzle-orm";
import { db, portfolioSnapshotsTable } from "@workspace/db";

// Shared by dailySummaryCron.ts and routes/competition.ts — both need "this
// user's portfolio value as of some date", reading the same table
// portfolioAlertCron.ts already writes every 5 minutes for every user
// regardless of push/competition settings, so neither has to collect its
// own history.
export async function snapshotOnOrBefore(userId: string, dateKey: string): Promise<number | null> {
  const [row] = await db
    .select({ totalValue: portfolioSnapshotsTable.totalValue })
    .from(portfolioSnapshotsTable)
    .where(and(eq(portfolioSnapshotsTable.userId, userId), lte(portfolioSnapshotsTable.date, dateKey)))
    .orderBy(desc(portfolioSnapshotsTable.date))
    .limit(1);
  return row && row.totalValue > 0 ? row.totalValue : null;
}

export interface DatedSnapshot { date: string; totalValue: number }

// Strictly-before variant of the above — needed for a leaderboard baseline
// on the exact day a period starts (e.g. the Sunday cairoWeekStart() itself
// falls on): snapshotOnOrBefore(userId, periodStart) would return TODAY's
// own snapshot on that day, making baseline === current and forcing every
// participant's return to exactly 0%. This looks one snapshot further back
// — the last value from before the period began — so day-one of a new
// period still shows genuine movement instead of a guaranteed zero.
//
// Returns the snapshot's own date alongside its value (not just a number) —
// leaderboardRanking.ts needs that date as the cutoff for which holdings
// were actually part of this baseline, so a holding added mid-period can't
// be counted as if it had always been there (see that file's own comment).
export async function snapshotBefore(userId: string, dateKey: string): Promise<DatedSnapshot | null> {
  const [row] = await db
    .select({ date: portfolioSnapshotsTable.date, totalValue: portfolioSnapshotsTable.totalValue })
    .from(portfolioSnapshotsTable)
    .where(and(eq(portfolioSnapshotsTable.userId, userId), lt(portfolioSnapshotsTable.date, dateKey)))
    .orderBy(desc(portfolioSnapshotsTable.date))
    .limit(1);
  return row && row.totalValue > 0 ? row : null;
}

// The user's very first ever recorded snapshot, but only if it's strictly
// before `beforeDateKey` — used as a leaderboard baseline fallback for a
// user whose tracking history doesn't reach back to the period's start (they
// joined, or opted into competition tracking, partway through the week/
// month). Rather than excluding them from ranking entirely until a full
// period has elapsed, their return is measured "since they started
// tracking" instead — the same inclusive philosophy chartUtils.ts's
// isPeriodAvailable already applies to chart periods. Requiring the row to
// be strictly before `beforeDateKey` (normally today) stops a user with only
// a single same-day snapshot from getting a fabricated baseline === current
// (0%) result; they're correctly excluded instead, same as anyone else with
// no comparison point yet.
export async function earliestSnapshotBefore(userId: string, beforeDateKey: string): Promise<DatedSnapshot | null> {
  const [row] = await db
    .select({ date: portfolioSnapshotsTable.date, totalValue: portfolioSnapshotsTable.totalValue })
    .from(portfolioSnapshotsTable)
    .where(and(eq(portfolioSnapshotsTable.userId, userId), lt(portfolioSnapshotsTable.date, beforeDateKey)))
    .orderBy(asc(portfolioSnapshotsTable.date))
    .limit(1);
  return row && row.totalValue > 0 ? row : null;
}
