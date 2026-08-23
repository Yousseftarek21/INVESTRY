import { and, desc, eq, lt, lte } from "drizzle-orm";
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

// Strictly-before variant of the above — needed for a leaderboard baseline
// on the exact day a period starts (e.g. the Sunday cairoWeekStart() itself
// falls on): snapshotOnOrBefore(userId, periodStart) would return TODAY's
// own snapshot on that day, making baseline === current and forcing every
// participant's return to exactly 0%. This looks one snapshot further back
// — the last value from before the period began — so day-one of a new
// period still shows genuine movement instead of a guaranteed zero.
export async function snapshotBefore(userId: string, dateKey: string): Promise<number | null> {
  const [row] = await db
    .select({ totalValue: portfolioSnapshotsTable.totalValue })
    .from(portfolioSnapshotsTable)
    .where(and(eq(portfolioSnapshotsTable.userId, userId), lt(portfolioSnapshotsTable.date, dateKey)))
    .orderBy(desc(portfolioSnapshotsTable.date))
    .limit(1);
  return row && row.totalValue > 0 ? row.totalValue : null;
}
