import { and, eq, inArray, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { computeRankedReturns } from "./leaderboardRanking";
import { cairoWeekStart } from "./cairoDate";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";

// Checked on the same 5-minute cadence as portfolioAlertCron, since that
// cron's writes are the only thing that can ever move a rank — no point
// polling faster than the values it depends on can change.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const RANK_COPY: Record<number, { title: string; body: string }> = {
  1: { title: "🥇 You're #1 this week!", body: "You're leading the Performance Leaderboard. Keep going!" },
  2: { title: "🥈 You're #2 this week!", body: "You've climbed to 2nd on the Performance Leaderboard. Keep going!" },
  3: { title: "🥉 You're #3 this week!", body: "You've made the top 3 on the Performance Leaderboard. Keep going!" },
};

let running = false;

// Congratulates the current top 3 on the WEEKLY performance leaderboard —
// once per user per rank actually reached, not once per tick. A user only
// gets a push when their rank is a genuinely NEW personal best for the
// current week: reaching #2 then slipping back to #3 never re-sends the #3
// push (already congratulated for that or better), but climbing from #3 to
// #1 does send the #1 push, since that's a real new milestone. A fresh week
// (cairoWeekStart() has moved on) resets eligibility for everyone, same as
// the leaderboard itself resetting.
//
// Deliberately the weekly view only, not monthly — the weekly board is the
// default/primary one, and a single "you're #1" congratulation per week is
// the natural cadence; the monthly board would just re-congratulate the
// same people on a slower, redundant clock.
async function checkTopRanks(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const weekStart = cairoWeekStart();
    const ranked = await computeRankedReturns("week");
    const top3 = ranked.filter(r => r.rank <= 3);
    if (top3.length === 0) return;

    const rows = await db
      .select({
        id: usersTable.id,
        pushToken: usersTable.pushToken,
        notifiedRank: usersTable.perfLeaderboardNotifiedRank,
        notifiedWeek: usersTable.perfLeaderboardNotifiedWeek,
      })
      .from(usersTable)
      .where(inArray(usersTable.id, top3.map(r => r.id)));
    const byId = new Map(rows.map(r => [r.id, r]));

    for (const entry of top3) {
      const u = byId.get(entry.id);
      if (!u) continue;

      const isNewBest = u.notifiedWeek !== weekStart || u.notifiedRank == null || entry.rank < u.notifiedRank;
      if (!isNewBest) continue;

      // Atomic compare-and-swap, same pattern as portfolioAlertCron's
      // lastNotifiedMilestone — the WHERE re-checks the same freshness
      // condition the SELECT above already tested, so only the write that
      // actually advances the record sends the push, closing the same
      // multi-process race that pattern exists to close.
      const updated = await db
        .update(usersTable)
        .set({ perfLeaderboardNotifiedRank: entry.rank, perfLeaderboardNotifiedWeek: weekStart, updatedAt: new Date() })
        .where(and(
          eq(usersTable.id, entry.id),
          sql`(
            ${usersTable.perfLeaderboardNotifiedWeek} IS DISTINCT FROM ${weekStart}
            OR ${usersTable.perfLeaderboardNotifiedRank} IS NULL
            OR ${usersTable.perfLeaderboardNotifiedRank} > ${entry.rank}
          )`,
        ))
        .returning({ id: usersTable.id });

      if (updated.length === 0) continue; // lost the race, or already congratulated for this-or-better

      if (u.pushToken) {
        const copy = RANK_COPY[entry.rank];
        await sendPushToTokens([u.pushToken], copy.title, copy.body, { type: "leaderboard_rank", rank: entry.rank });
      }
    }
  } catch (err) {
    logger.warn({ err }, "Leaderboard rank cron run failed");
  } finally {
    running = false;
  }
}

export function startLeaderboardRankCron(): void {
  checkTopRanks();
  setInterval(checkTopRanks, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Leaderboard rank cron started");
}
