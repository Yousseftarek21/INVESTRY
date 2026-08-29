import { pgTable, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per calendar month, written once by referralMonthlyWinnerCron.ts
// the moment a month ends — the durable record of who won the referral
// leaderboard's monthly prize (see i18n's referralHeroSub/inviteFriendsNavSub
// promising "the top referrer each month wins a prize"), since that promise
// previously had zero code behind it: no detection, no notification, no
// record an admin could act on to actually pay someone. Prize fulfillment
// itself stays manual/off-app (there's no in-app payout mechanism), but this
// table is what makes "who won last month" answerable at all instead of
// relying on someone manually re-running the leaderboard query before the
// month's data ages out of relevance.
export const referralMonthlyWinnersTable = pgTable("referral_monthly_winners", {
  id:             text("id").primaryKey(),
  month:          text("month").notNull(), // "YYYY-MM-01" (utcMonthStartKey of the WON month, not the month this was computed in)
  userId:         text("user_id").notNull(),
  referredCount:  integer("referred_count").notNull(),
  notifiedAt:     timestamp("notified_at", { withTimezone: true }), // null if the push failed/no token — the row itself still stands as the record
  paidAt:         timestamp("paid_at", { withTimezone: true }),     // set manually via the admin endpoint once the prize is actually sent
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // One winner per month — the cron is safe to run more than once (e.g. a
  // restart mid-window) without crowning a second winner or double-pushing.
  monthUnique: unique().on(t.month),
}));

export const insertReferralMonthlyWinnerSchema = createInsertSchema(referralMonthlyWinnersTable);
export const selectReferralMonthlyWinnerSchema = createSelectSchema(referralMonthlyWinnersTable);

export type InsertReferralMonthlyWinner = z.infer<typeof insertReferralMonthlyWinnerSchema>;
export type DbReferralMonthlyWinner     = typeof referralMonthlyWinnersTable.$inferSelect;
