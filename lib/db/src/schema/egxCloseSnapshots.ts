import { pgTable, text, real, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per EGX ticker per calendar day (Africa/Cairo) — the per-stock
// equivalent of market_close_snapshots (gold/silver/USD-EGP). Didn't exist
// until now: computePeriodPerformance's leaderboard math could get a real
// historical price for gold/silver (immune to gaming, always mathematically
// correct for any period boundary) but had no equivalent for EGX stocks, so
// a stock holding that predates the period fell back to an all-time
// cost-basis approximation — accurate most days, but glaringly wrong on the
// very day a new week/month starts: a stock up 58% since it was bought
// showed as "+58% this week" even though the week had only just begun,
// because there was no real price on record for "what this stock cost when
// the week started" to ratio against instead.
//
// Same open/close pattern as market_close_snapshots: openPrice is set once,
// whatever the price was the first time today's row was written; closePrice
// is continuously overwritten with the latest live price all day, so
// whatever was last written before the Cairo day rolls over becomes that
// day's fixed close for every future period boundary to compare against.
export const egxCloseSnapshotsTable = pgTable("egx_close_snapshots", {
  id:         text("id").primaryKey(), // `${symbol}::${date}`
  symbol:     text("symbol").notNull(),
  date:       text("date").notNull(), // "YYYY-MM-DD" in Africa/Cairo
  openPrice:  real("open_price").notNull(),
  closePrice: real("close_price").notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  symbolDateUnique: unique().on(t.symbol, t.date),
}));

export const insertEgxCloseSnapshotSchema = createInsertSchema(egxCloseSnapshotsTable);
export const selectEgxCloseSnapshotSchema = createSelectSchema(egxCloseSnapshotsTable);

export type InsertEgxCloseSnapshot = z.infer<typeof insertEgxCloseSnapshotSchema>;
export type DbEgxCloseSnapshot     = typeof egxCloseSnapshotsTable.$inferSelect;
