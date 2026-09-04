import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

// This app has no formal migration runner — schema changes are normally
// applied by hand via `pnpm --filter @workspace/db push` before the code
// that depends on them deploys. Run once at boot (every statement is
// idempotent — IF NOT EXISTS / ADD COLUMN IF NOT EXISTS — so every later
// boot is a no-op) so a deploy can't start erroring on missing columns just
// because that manual step hasn't happened yet. Columns must stay in sync
// with lib/db/src/schema/users.ts. One function for every self-bootstrapped
// users column, rather than one function per feature, so there's a single
// place this pattern lives as it keeps growing.
export async function ensureUserColumns(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "daily_summary_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "weekly_summary_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "last_daily_summary_date" text,
        ADD COLUMN IF NOT EXISTS "last_weekly_summary_date" text,
        ADD COLUMN IF NOT EXISTS "competition_opted_in" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "competition_nickname" text,
        ADD COLUMN IF NOT EXISTS "competition_announcement_sent_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "referral_redeemed_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "perf_leaderboard_notified_rank" integer,
        ADD COLUMN IF NOT EXISTS "perf_leaderboard_notified_week" text,
        ADD COLUMN IF NOT EXISTS "feedback_alerts_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "pro_gate_notice_sent_at" timestamptz
    `);
  } catch (err) {
    // Fails open, not closed: every caller of these columns already treats a
    // DB error as "skip this user/tick", same pattern as every other cron in
    // this codebase — a missing column degrades the feature, it doesn't take
    // the server down.
    logger.error({ err }, "ensureUserColumns: failed to add columns — daily/weekly summary and the leaderboard will be inert until this is resolved");
  }
}
