import { pgTable, text, real, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per user per calendar day (Africa/Cairo), used to detect
// day-over-day portfolio value swings and to track which whole-percent
// milestone (1%, 2%, 3%... in either direction) has already been pushed
// for that day, so a push fires again each time the move reaches a new
// milestone rather than only once per day.
export const portfolioSnapshotsTable = pgTable("portfolio_snapshots", {
  id:                    text("id").primaryKey(),
  userId:                text("user_id").notNull(),
  date:                  text("date").notNull(), // "YYYY-MM-DD" in Africa/Cairo
  totalValue:            real("total_value").notNull(),
  lastNotifiedMilestone: integer("last_notified_milestone").notNull().default(0), // signed whole-percent, e.g. -2 or 3
  createdAt:             timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userDateUnique: unique().on(t.userId, t.date),
}));

export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshotsTable);
export const selectPortfolioSnapshotSchema = createSelectSchema(portfolioSnapshotsTable);

export type InsertPortfolioSnapshot = z.infer<typeof insertPortfolioSnapshotSchema>;
export type DbPortfolioSnapshot     = typeof portfolioSnapshotsTable.$inferSelect;
