import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per calendar day (Africa/Cairo). Two snapshots per metric:
//  - open*  is written once — whatever the price was the very first time
//    this day's row was created — and never touched again.
//  - gold_egp_24k/silver_egp/usd_to_egp ("close") are continuously
//    overwritten with the latest live price all day, so whatever was last
//    written before the Cairo day rolls over becomes that day's fixed close
//    for tomorrow's comparison.
// Persisted (unlike the in-memory version this replaced) so a server
// restart can't silently wipe the reference point and force a fallback to a
// stale, wrongly-dated third-party rate. The open columns exist so a brand
// new day (or the first day after this table was created, with no prior
// day to compare against yet) can still show real intraday movement —
// "since today opened" — instead of a flat 0% until the next midnight.
export const marketCloseSnapshotsTable = pgTable("market_close_snapshots", {
  date:          text("date").primaryKey(), // "YYYY-MM-DD" in Africa/Cairo
  openGoldEgp24k: real("open_gold_egp_24k").notNull(),
  openSilverEgp:  real("open_silver_egp").notNull(),
  openUsdToEgp:   real("open_usd_to_egp").notNull(),
  goldEgp24k: real("gold_egp_24k").notNull(),
  silverEgp:  real("silver_egp").notNull(),
  usdToEgp:   real("usd_to_egp").notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMarketCloseSnapshotSchema = createInsertSchema(marketCloseSnapshotsTable);
export const selectMarketCloseSnapshotSchema = createSelectSchema(marketCloseSnapshotsTable);

export type InsertMarketCloseSnapshot = z.infer<typeof insertMarketCloseSnapshotSchema>;
export type DbMarketCloseSnapshot     = typeof marketCloseSnapshotsTable.$inferSelect;
