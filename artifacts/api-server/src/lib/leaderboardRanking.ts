import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { cairoMonthStart, cairoWeekStart, tradingDayKey } from "./cairoDate";
import { earliestSnapshotBefore, snapshotBefore, snapshotOnOrBefore } from "./portfolioSnapshotHelpers";

export interface RankedReturn { id: string; pctReturn: number; rank: number }

// The portfolio-return ranking computation, shared by GET
// /competition/leaderboard (routes/competition.ts) and leaderboardRankCron —
// one place for this math so the two can never quietly drift apart. See
// competition.ts's own route comment for the full reasoning behind
// tradingDayKey() as "today" and the strictly-before baseline; this function
// is a straight extraction of that same logic, unchanged.
export async function computeRankedReturns(period: "week" | "month"): Promise<RankedReturn[]> {
  const periodStart = period === "month" ? cairoMonthStart() : cairoWeekStart();
  const opted = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.competitionOptedIn, true));

  const today = tradingDayKey();
  const withReturns: { id: string; pctReturn: number }[] = [];
  for (const u of opted) {
    const baseline = (await snapshotBefore(u.id, periodStart)) ?? await earliestSnapshotBefore(u.id, today);
    const current = await snapshotOnOrBefore(u.id, today);
    if (baseline == null || current == null) continue;
    withReturns.push({ id: u.id, pctReturn: ((current - baseline) / baseline) * 100 });
  }

  withReturns.sort((a, b) => b.pctReturn - a.pctReturn);
  return withReturns.map((u, i) => ({ id: u.id, pctReturn: Math.round(u.pctReturn * 100) / 100, rank: i + 1 }));
}
