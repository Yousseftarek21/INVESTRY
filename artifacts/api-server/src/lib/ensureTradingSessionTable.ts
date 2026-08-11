import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

// This app has no formal migration runner — schema changes are normally
// applied by hand via `pnpm --filter @workspace/db push` before the code
// that depends on them deploys. Run once at boot (IF NOT EXISTS makes every
// later boot a no-op) so a deploy can't start 500ing on
// trading_session_state just because that manual step hasn't happened yet.
// Column set must stay in sync with lib/db/src/schema/tradingSessionState.ts.
export async function ensureTradingSessionTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "trading_session_state" (
        "id" text PRIMARY KEY NOT NULL,
        "metals_prev_close_marker" double precision NOT NULL,
        "session_start_at" timestamp with time zone NOT NULL,
        "session_open_usd_to_egp" real NOT NULL,
        "prev_session_close_usd_to_egp" real,
        "current_usd_to_egp" real NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    // Covers a boot that already ran CREATE TABLE with the old `real` type
    // for this column before it was corrected to `double precision` (see
    // the comment on it in tradingSessionState.ts) — safe/idempotent to
    // repeat on every boot even once it's already the right type.
    await db.execute(sql`
      ALTER TABLE "trading_session_state"
      ALTER COLUMN "metals_prev_close_marker" TYPE double precision
    `);
  } catch (err) {
    // Fails open, not closed: recordAndGetSessionAlignedUsdToEgp already
    // catches DB errors and falls back to an honest 0% change, same pattern
    // as every other price-fetch failure in this codebase — a missing table
    // degrades the feature, it doesn't take the server down.
    logger.error({ err }, "ensureTradingSessionTable: failed to create table — currency/cash today-change will read 0% until this is resolved");
  }
}
