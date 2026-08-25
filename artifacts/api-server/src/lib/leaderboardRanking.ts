import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { cairoMonthStart, cairoWeekStart, tradingDayKey } from "./cairoDate";
import { earliestSnapshotBefore, snapshotBefore } from "./portfolioSnapshotHelpers";
import { computeEligiblePortfolioValue, sumEligibleSaleProceeds } from "./portfolioValue";

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
// actual performance) or by editing an existing holding's quantity
// mid-period (e.g. bumping a gold holding from 10g to 500g — same exploit,
// no new holding needed). It's the live value of holdings that already
// existed at the baseline AND haven't been touched since, plus proceeds
// from any of those same pre-existing, untouched holdings sold during the
// period — "how did what I already had actually perform," which a
// leaderboard is supposed to measure, not "how much new capital did I add
// or inflate."
export async function computeRankedReturns(period: "week" | "month"): Promise<RankedReturn[]> {
  const periodStart = period === "month" ? cairoMonthStart() : cairoWeekStart();
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

    const [eligibleValue, saleProceeds] = await Promise.all([
      computeEligiblePortfolioValue(u.id, baselineDate),
      sumEligibleSaleProceeds(u.id, baselineDate),
    ]);
    const current = eligibleValue + saleProceeds;

    // Zero eligible value with a positive baseline doesn't mean "lost
    // everything" — it means every holding this user currently has (or
    // sold) was added on or after the baseline day, so nothing accounts
    // for what the baseline actually measured (most often: they joined
    // this period and their only snapshot is itself same-day as their
    // first holding). Showing -100% here would be exactly the kind of
    // false number this whole eligibility filter exists to prevent, just
    // in the opposite direction — skip them, same as the existing
    // no-baseline-at-all case just above.
    if (current === 0) continue;

    withReturns.push({ id: u.id, pctReturn: ((current - baseline) / baseline) * 100 });
  }

  withReturns.sort((a, b) => b.pctReturn - a.pctReturn);
  return withReturns.map((u, i) => ({ id: u.id, pctReturn: Math.round(u.pctReturn * 100) / 100, rank: i + 1 }));
}
