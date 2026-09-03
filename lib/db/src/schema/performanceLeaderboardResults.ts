import { pgTable, text, integer, real, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per (period, rank) — up to 3 rows per closed week/month, the
// durable record of who finished 1st/2nd/3rd on the Performance Leaderboard
// once that period is over. Written once by leaderboardPeriodResultsCron.ts
// the first time it runs after a period has actually ended, computed from
// real historical prices as of that period's last day (see
// computeFrozenPeriodPerformance in api-server's portfolioValue.ts) — never
// from live/current prices, since by the time the cron notices a period has
// closed, "today" is already a different period.
//
// Same problem this solves as referralMonthlyWinnersTable does for the
// referral prize: the live leaderboard (GET /competition/leaderboard) only
// ever computes the CURRENT period — the instant a new week/month starts,
// the old period's standings are gone, so without this table there's
// nothing to show a "last week's results" celebration from.
export const performanceLeaderboardResultsTable = pgTable("performance_leaderboard_results", {
  id:         text("id").primaryKey(),
  periodType: text("period_type").notNull(), // "week" | "month"
  periodStart: text("period_start").notNull(), // cairoWeekStart / utcMonthStartKey of the period this ranks
  rank:       integer("rank").notNull(), // 1, 2, or 3
  userId:     text("user_id").notNull(),
  pctReturn:  real("pct_return").notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // One row per rank per period — the cron is safe to run more than once
  // (e.g. a restart mid-window) without crowning a second set of winners
  // or writing duplicate rows.
  periodRankUnique: unique().on(t.periodType, t.periodStart, t.rank),
}));

export const insertPerformanceLeaderboardResultSchema = createInsertSchema(performanceLeaderboardResultsTable);
export const selectPerformanceLeaderboardResultSchema = createSelectSchema(performanceLeaderboardResultsTable);

export type InsertPerformanceLeaderboardResult = z.infer<typeof insertPerformanceLeaderboardResultSchema>;
export type DbPerformanceLeaderboardResult     = typeof performanceLeaderboardResultsTable.$inferSelect;
