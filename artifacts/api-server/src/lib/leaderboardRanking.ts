import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { cairoWeekStart } from "./cairoDate";
import { utcMonthStartKey } from "./calendarDate";
import { computePeriodPerformance } from "./portfolioValue";

export interface RankedReturn { id: string; pctReturn: number; rank: number }

// The portfolio-return ranking computation, shared by GET
// /competition/leaderboard (routes/competition.ts) and leaderboardRankCron —
// one place for this math so the two can never quietly drift apart.
//
// Restricted to gold, silver, and EGX stocks — see computePeriodPerformance
// (portfolioValue.ts) for the full reasoning. Real estate, personal assets,
// and fixed income are entirely excluded: their values are self-reported
// with no independent price feed, which is exactly what produced every
// leaderboard incident so far (the original 853% jump from one newly-added
// property, and this week's >100%/-100% swings from a mix of backdated
// purchase data and an exclusion rule that zeroed out most active users'
// whole portfolios on an app this young). No longer depends on
// portfolio_snapshots at all — baseline is computed fresh each time from
// real historical gold/silver prices and stock cost basis, not a daily
// aggregate snapshot that mixed in the now-excluded types anyway.
export async function computeRankedReturns(period: "week" | "month"): Promise<RankedReturn[]> {
  const periodStart = period === "month" ? utcMonthStartKey() : cairoWeekStart();
  const opted = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.competitionOptedIn, true));

  const withReturns: { id: string; pctReturn: number }[] = [];
  for (const u of opted) {
    const { pctReturn } = await computePeriodPerformance(u.id, periodStart);
    if (pctReturn == null) continue; // nothing eligible (no gold/silver, no pre-existing stock) — not a real 0/-100%, just unrankable yet
    withReturns.push({ id: u.id, pctReturn });
  }

  withReturns.sort((a, b) => b.pctReturn - a.pctReturn);
  return withReturns.map((u, i) => ({ id: u.id, pctReturn: Math.round(u.pctReturn * 100) / 100, rank: i + 1 }));
}
