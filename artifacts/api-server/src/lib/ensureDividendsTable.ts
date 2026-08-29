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
