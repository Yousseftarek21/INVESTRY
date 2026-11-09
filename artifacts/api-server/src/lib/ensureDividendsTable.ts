import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

// This app has no formal migration runner (see ensureUserColumns.ts) — the
// dividends table is self-created at boot the same idempotent way new
// columns are, just CREATE TABLE IF NOT EXISTS instead of ADD COLUMN IF NOT
// EXISTS. Shape must stay in sync with lib/db/src/schema/dividends.ts.
export async function ensureDividendsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "dividends" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL,
        "data" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    logger.error({ err }, "ensureDividendsTable: failed to create table — dividend tracking will be inert until this is resolved");
  }
}

// Same self-bootstrapping pattern for the sold_holdings table (see
// lib/db/src/schema/soldHoldings.ts) — realized profit/loss history created
// when a holding is marked sold/redeemed via POST /api/holdings/:id/sell.
export async function ensureSoldHoldingsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "sold_holdings" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL,
        "data" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    logger.error({ err }, "ensureSoldHoldingsTable: failed to create table — selling a holding will fail until this is resolved");
  }
}

// Same self-bootstrapping pattern for the daily_change_snapshots table (see
// lib/db/src/schema/dailyChangeSnapshots.ts) — one row per user per trading
// day, the closing "Today's Change %" once that day has rolled over.
export async function ensureDailyChangeSnapshotsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "daily_change_snapshots" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL,
        "date" text NOT NULL,
        "pct_return" real NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "daily_change_snapshots_user_id_date_unique" UNIQUE ("user_id", "date")
      )
    `);
  } catch (err) {
    logger.error({ err }, "ensureDailyChangeSnapshotsTable: failed to create table — daily change history will be inert until this is resolved");
  }
}

// Same self-bootstrapping pattern for the intraday series column added to
// portfolio_snapshots (see lib/db/src/schema/portfolioSnapshots.ts) — it
// backs the 1D chart's real intraday movement.
export async function ensureIntradayColumn(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE "portfolio_snapshots"
        ADD COLUMN IF NOT EXISTS "intraday" jsonb
    `);
  } catch (err) {
    logger.error({ err }, "ensureIntradayColumn: failed to add column — the 1D chart will fall back to client-side samples only");
  }
}

// Same self-bootstrapping pattern for the egx_close_snapshots table (see
// lib/db/src/schema/egxCloseSnapshots.ts) — one row per EGX ticker per day,
// written by markets.ts's fetchStocks() path, read by
// portfolioValue.ts's stockPriceOnOrBefore for the leaderboard's period math.
export async function ensureEgxCloseSnapshotsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "egx_close_snapshots" (
        "id" text PRIMARY KEY,
        "symbol" text NOT NULL,
        "date" text NOT NULL,
        "open_price" real NOT NULL,
        "close_price" real NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "egx_close_snapshots_symbol_date_unique" UNIQUE ("symbol", "date")
      )
    `);
  } catch (err) {
    logger.error({ err }, "ensureEgxCloseSnapshotsTable: failed to create table — EGX stocks will keep using the cost-basis leaderboard approximation until this is resolved");
  }
}

// Same self-bootstrapping pattern for the referral_monthly_winners table
// (see lib/db/src/schema/referralMonthlyWinners.ts) — one row per calendar
// month, written by referralMonthlyWinnerCron.ts.
export async function ensureReferralMonthlyWinnersTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "referral_monthly_winners" (
        "id" text PRIMARY KEY,
        "month" text NOT NULL,
        "user_id" text NOT NULL,
        "referred_count" integer NOT NULL,
        "notified_at" timestamptz,
        "paid_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "referral_monthly_winners_month_unique" UNIQUE ("month")
      )
    `);
  } catch (err) {
    logger.error({ err }, "ensureReferralMonthlyWinnersTable: failed to create table — the monthly referral prize will not be detected until this is resolved");
  }
}

// Same self-bootstrapping pattern for performance_leaderboard_results — see
// lib/db/src/schema/performanceLeaderboardResults.ts and
// leaderboardPeriodResultsCron.ts.
export async function ensurePerformanceLeaderboardResultsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "performance_leaderboard_results" (
        "id" text PRIMARY KEY,
        "period_type" text NOT NULL,
        "period_start" text NOT NULL,
        "rank" integer NOT NULL,
        "user_id" text NOT NULL,
        "pct_return" real NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "performance_leaderboard_results_period_rank_unique" UNIQUE ("period_type", "period_start", "rank")
      )
    `);
  } catch (err) {
    logger.error({ err }, "ensurePerformanceLeaderboardResultsTable: failed to create table — weekly/monthly leaderboard results will not be recorded until this is resolved");
  }
}

// Same self-bootstrapping pattern for the feedback_messages/feedback_likes
// tables (see lib/db/src/schema/feedbackMessages.ts and feedbackLikes.ts) —
// the shared in-app feedback chat, routes/feedback.ts.
export async function ensureFeedbackTables(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "feedback_messages" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL,
        "message" text NOT NULL,
        "like_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "feedback_likes" (
        "id" text PRIMARY KEY,
        "message_id" text NOT NULL,
        "user_id" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "feedback_likes_message_user_unique" UNIQUE ("message_id", "user_id")
      )
    `);
  } catch (err) {
    logger.error({ err }, "ensureFeedbackTables: failed to create tables — the feedback chat will not work until this is resolved");
  }
}

// Same self-bootstrapping pattern for push_tickets (see
// lib/db/src/schema/pushTickets.ts for why this table exists) — real
// per-token delivery outcomes for every push this server sends, read/written
// by lib/expoPush.ts and lib/pushReceiptCron.ts.
export async function ensurePushTicketsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "push_tickets" (
        "id" text PRIMARY KEY,
        "user_id" text,
        "token" text NOT NULL,
        "type" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "stage" text NOT NULL DEFAULT 'ticket',
        "error_code" text,
        "error_message" text,
        "sent_at" timestamptz NOT NULL DEFAULT now(),
        "checked_at" timestamptz
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "push_tickets_status_sent_at_idx" ON "push_tickets" ("status", "sent_at")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "push_tickets_token_idx" ON "push_tickets" ("token")`);
  } catch (err) {
    logger.error({ err }, "ensurePushTicketsTable: failed to create table — push delivery outcomes will not be recorded until this is resolved");
  }
}

// Same self-bootstrapping pattern as ensureDividendsTable above (not
// Recurring Income's — that table has no such function and was pushed
// once via drizzle-kit push, a real gap this deliberately doesn't repeat).
// A logged rental payment, always tied to a specific real_estate holding
// the owner already saved — see RentalRecord in
// artifacts/mobile/types/index.ts and routes/rentals.ts.
export async function ensureRentalRecordsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "rental_records" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL,
        "data" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    logger.error({ err }, "ensureRentalRecordsTable: failed to create table — rental tracking will be inert until this is resolved");
  }
}

// Real estate price data: the per-row unit type, and the daily history
// behind the single current row (see realEstatePriceCron.ts).
export async function ensureRealEstatePriceTables(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE "real_estate_prices" ADD COLUMN IF NOT EXISTS "price_basis" text`);
    await db.execute(sql`ALTER TABLE "real_estate_compound_prices" ADD COLUMN IF NOT EXISTS "price_basis" text`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "real_estate_price_history" (
        "id" text PRIMARY KEY,
        "kind" text NOT NULL,
        "ref_id" text NOT NULL,
        "day" text NOT NULL,
        "avg_price_per_m2" integer NOT NULL,
        "min_price_per_m2" integer NOT NULL,
        "max_price_per_m2" integer NOT NULL,
        "sample_size" integer NOT NULL,
        "source" text NOT NULL,
        "price_basis" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "real_estate_price_history_ref_idx"
      ON "real_estate_price_history" ("kind", "ref_id", "day")
    `);
  } catch (err) {
    logger.error({ err }, "ensureRealEstatePriceTables: failed — real estate price writes may fail until resolved");
  }
}

// Rental Properties — units plus their bookings, leases and expenses (see
// lib/db/src/schema/rentalProperties.ts and routes/rentalProperties.ts).
export async function ensureRentalPropertyTables(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "rental_units" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL,
        "data" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "rental_units_user_idx" ON "rental_units" ("user_id")`);
    for (const table of ["rental_bookings", "rental_leases", "rental_expenses"]) {
      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS "${table}" (
          "id" text PRIMARY KEY,
          "user_id" text NOT NULL,
          "unit_id" text NOT NULL,
          "data" jsonb NOT NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )
      `));
      await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "${table}_user_idx" ON "${table}" ("user_id")`));
    }
    // One row per reminder push already sent — see rentalReminderCron.ts.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "rental_reminders_sent" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL,
        "sent_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    logger.error({ err }, "ensureRentalPropertyTables: failed — Rental Properties will be inert until this is resolved");
  }
}

// One row per Paymob payment that unlocked Pro — the webhook claims the row
// before extending Pro, so a resent callback never adds the time twice.
export async function ensurePaymobPaymentsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "paymob_payments" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL,
        "period" text NOT NULL,
        "amount_cents" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    logger.error({ err }, "ensurePaymobPaymentsTable: failed — Paymob payments can't unlock Pro until this is resolved");
  }
}

// Loans the user owes (see lib/db/src/schema/loans.ts). Plus a log of
// reminder pushes already sent, so a due-date reminder goes out once.
export async function ensureLoansTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "loans" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL,
        "data" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "loans_user_idx" ON "loans" ("user_id")`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "loan_reminders_sent" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL,
        "sent_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    logger.error({ err }, "ensureLoansTable: failed — loans will be inert until this is resolved");
  }
}
