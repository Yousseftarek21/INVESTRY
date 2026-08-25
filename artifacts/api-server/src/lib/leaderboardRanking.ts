import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { cairoWeekStart, tradingDayKey } from "./cairoDate";
import { utcMonthStartKey } from "./calendarDate";
import { earliestSnapshotBefore, snapshotBefore } from "./portfolioSnapshotHelpers";
import { computePeriodPerformance } from "./portfolioValue";

export interface RankedReturn { id: string; pctReturn: number; rank: number }

// The portfolio-return ranking computation, shared by GET
// /competition/leaderboard (routes/competition.ts) and leaderboardRankCron —
// one place for this math so the two can never quietly drift apart. See
// competition.ts's own route comment for the full reasoning behind
// tradingDayKey() as "today" and the strictly-before baseline.
//
// "current" is deliberately not just "today's total portfolio value" —
// that let anyone top the leaderboard by adding one large new holding
// mid-period (real case seen in production: a user's weekly return read as
// +853% after adding a single real estate property, nothing to do with
// actual performance). computePeriodPerformance (portfolioValue.ts) offsets
// any capital added during the period out of the gain instead of excluding
// it from the value entirely — see that function's own comment: an earlier
// exclusion-based version caused a worse production incident, wiping most
// of the leaderboard because ordinary recently-added holdings got treated
// the same as gaming.
export async function computeRankedReturns(period: "week" | "month"): Promise<RankedReturn[]> {
  const periodStart = period === "month" ? utcMonthStartKey() : cairoWeekStart();
  const opted = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.competitionOptedIn, true));

  const today = tradingDayKey();
  const withReturns: { id: string; pctReturn: number }[] = [];
  for (const u of opted) {
    const baselineSnap = (await snapshotBefore(u.id, periodStart)) ?? await earliestSnapshotBefore(u.id, today);
    if (baselineSnap == null) continue;
    const { date: baselineDate, totalValue: baseline } = baselineSnap;

    const perf = await computePeriodPerformance(u.id, baselineDate);
    const gain = (perf.current + perf.saleProceeds - baseline) - (perf.newHoldingsValue + perf.newlySoldProceeds);

    withReturns.push({ id: u.id, pctReturn: (gain / baseline) * 100 });
  }

  withReturns.sort((a, b) => b.pctReturn - a.pctReturn);
  return withReturns.map((u, i) => ({ id: u.id, pctReturn: Math.round(u.pctReturn * 100) / 100, rank: i + 1 }));
}
