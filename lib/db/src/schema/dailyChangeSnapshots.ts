import { pgTable, text, real, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per user per trading day (see api-server's cairoDate.ts
// tradingDayKey) — that day's closing "Today's Change %", so a user can
// look back at what a past day's movement was after it's rolled over and
// the live Home-tab badge has reset to a new day. Continuously overwritten
// throughout the day (same pattern as marketCloseSnapshots.ts) so whatever
// was last written before the trading day rolled over becomes that day's
// fixed, permanent record. Computed the same gaming-proof way as the
// leaderboard (see api-server's portfolioValue.ts computePeriodPerformance)
// — real gold/silver price ratio plus pre-existing EGX stock cost basis —
// so this history can't be padded by adding or editing a holding either.
export const dailyChangeSnapshotsTable = pgTable("daily_change_snapshots", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  date:      text("date").notNull(), // trading day key, "YYYY-MM-DD"
  pctReturn: real("pct_return").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userDateUnique: unique().on(t.userId, t.date),
}));

export const insertDailyChangeSnapshotSchema = createInsertSchema(dailyChangeSnapshotsTable);
export const selectDailyChangeSnapshotSchema = createSelectSchema(dailyChangeSnapshotsTable);

export type InsertDailyChangeSnapshot = z.infer<typeof insertDailyChangeSnapshotSchema>;
export type DbDailyChangeSnapshot     = typeof dailyChangeSnapshotsTable.$inferSelect;
