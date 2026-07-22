import { pgTable, text, real, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per user per calendar day (Africa/Cairo), used to detect
// day-over-day portfolio value swings and to avoid re-notifying the same
// user more than once for the same day's move.
export const portfolioSnapshotsTable = pgTable("portfolio_snapshots", {
  id:         text("id").primaryKey(),
  userId:     text("user_id").notNull(),
  date:       text("date").notNull(), // "YYYY-MM-DD" in Africa/Cairo
  totalValue: real("total_value").notNull(),
  notified:   boolean("notified").notNull().default(false), // whether a push already went out for this day's move
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userDateUnique: unique().on(t.userId, t.date),
}));

export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshotsTable);
export const selectPortfolioSnapshotSchema = createSelectSchema(portfolioSnapshotsTable);

export type InsertPortfolioSnapshot = z.infer<typeof insertPortfolioSnapshotSchema>;
export type DbPortfolioSnapshot     = typeof portfolioSnapshotsTable.$inferSelect;
