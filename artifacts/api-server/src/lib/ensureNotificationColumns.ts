import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

// This app has no formal migration runner — schema changes are normally
// applied by hand via `pnpm --filter @workspace/db push` before the code
// that depends on them deploys. Run once at boot (every statement is
// idempotent — IF NOT EXISTS / ADD COLUMN IF NOT EXISTS — so every later
// boot is a no-op) so a deploy can't start erroring on missing columns just
// because that manual step hasn't happened yet. Columns must stay in sync
// with lib/db/src/schema/users.ts.
export async function ensureNotificationColumns(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "daily_summary_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "weekly_summary_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "last_daily_summary_date" text,
        ADD COLUMN IF NOT EXISTS "last_weekly_summary_date" text
    `);
  } catch (err) {
    // Fails open, not closed: every caller of these columns already treats a
    // DB error as "skip this user/tick", same pattern as every other cron in
    // this codebase — a missing column degrades the feature, it doesn't take
    // the server down.
    logger.error({ err }, "ensureNotificationColumns: failed to add columns — daily/weekly summary will be inert until this is resolved");
  }
}
