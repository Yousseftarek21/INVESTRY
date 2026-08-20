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
