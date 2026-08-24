import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id:                     text("id").primaryKey(), // Clerk userId
  email:                  text("email"),
  stripeCustomerId:       text("stripe_customer_id"),
  stripeSubscriptionId:   text("stripe_subscription_id"),
  plan:                   text("plan").notNull().default("free"), // 'free' | 'pro'
  billingPeriod:          text("billing_period").notNull().default("monthly"), // 'monthly' | 'annual'
  referralCode:           text("referral_code").unique(), // short shareable code, lazily generated
  referredByUserId:       text("referred_by_user_id"), // id of the user whose code was redeemed
  referralRedeemedAt:     timestamp("referral_redeemed_at", { withTimezone: true }), // when THIS user redeemed a code — NOT createdAt, which can predate redemption; anchors the referral leaderboard's monthly window
  proCreditExpiresAt:     timestamp("pro_credit_expires_at", { withTimezone: true }), // bonus Pro time earned from referrals
  pushToken:              text("push_token"), // Expo push token for the user's most recent device
  portfolioAlertsEnabled: boolean("portfolio_alerts_enabled").notNull().default(true), // gates the daily ±1% portfolio-value push
  priceAlertsEnabled:     boolean("price_alerts_enabled").notNull().default(true), // gates the custom target-price push
  activityAlertsEnabled:  boolean("activity_alerts_enabled").notNull().default(true), // gates the "you just added/edited X" push
  // Opt-in, default false — matches the client's own default before this
  // existed server-side. See lib/dailySummaryCron.ts.
  dailySummaryEnabled:    boolean("daily_summary_enabled").notNull().default(false),
  weeklySummaryEnabled:   boolean("weekly_summary_enabled").notNull().default(false),
  // Trading-day key (see cairoDate.ts) of the last summary actually sent —
  // the idempotency guard for a poll-interval cron: without this, two ticks
  // inside the same send window would each pass their own check and both
  // send, since neither writes anything the other's check would see.
  lastDailySummaryDate:   text("last_daily_summary_date"),
  lastWeeklySummaryDate:  text("last_weekly_summary_date"),
  // Weekly % return leaderboard (routes/competition.ts). Opt-in, off by
  // default — a portfolio-return ranking is still real financial signal
  // even without an absolute EGP figure attached, so nobody appears on it
  // without deliberately choosing to.
  competitionOptedIn:     boolean("competition_opted_in").notNull().default(false),
  // Unused as of the real-identity switch (see competition.ts) — the
  // leaderboard now shows each user's real Clerk name/photo instead of a
  // chosen nickname. Left in place rather than dropped: nothing reads it
  // anymore, but dropping a column is an irreversible migration for zero
  // functional gain. Safe to drop in a later cleanup pass.
  competitionNickname:    text("competition_nickname"),
  // One-time broadcast tracking, not a preference — set the first time each
  // user is sent the "leaderboard launched" push so a redeploy/restart of
  // the boot-time sender (see competitionAnnouncement.ts) can't resend it.
  competitionAnnouncementSentAt: timestamp("competition_announcement_sent_at", { withTimezone: true }),
  createdAt:              timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:              timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export const selectUserSchema = createSelectSchema(usersTable);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type DbUser     = typeof usersTable.$inferSelect;
