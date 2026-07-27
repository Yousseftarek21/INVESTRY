import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per calendar day (Africa/Cairo) — the EGP-denominated close for
// gold, silver, and USD/EGP that this same server displayed that day.
// "Today"'s row is continuously overwritten with the latest live price all
// day, so whatever was last written before the Cairo day rolls over becomes
// that day's fixed close. Persisted (unlike the in-memory version this
// replaced) so a server restart can't silently wipe the reference point and
// force a fallback to a stale, wrongly-dated third-party rate — "today's
// change" always resets against a real, durable yesterday's close.
export const marketCloseSnapshotsTable = pgTable("market_close_snapshots", {
  date:       text("date").primaryKey(), // "YYYY-MM-DD" in Africa/Cairo
  goldEgp24k: real("gold_egp_24k").notNull(),
  silverEgp:  real("silver_egp").notNull(),
  usdToEgp:   real("usd_to_egp").notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMarketCloseSnapshotSchema = createInsertSchema(marketCloseSnapshotsTable);
export const selectMarketCloseSnapshotSchema = createSelectSchema(marketCloseSnapshotsTable);

export type InsertMarketCloseSnapshot = z.infer<typeof insertMarketCloseSnapshotSchema>;
export type DbMarketCloseSnapshot     = typeof marketCloseSnapshotsTable.$inferSelect;
