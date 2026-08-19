import { and, desc, eq, lte } from "drizzle-orm";
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
