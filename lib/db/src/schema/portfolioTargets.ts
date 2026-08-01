import { pgTable, text, jsonb, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per user: their target allocation percentages across the same six
// asset classes shown on the mobile Analytics allocation bar (gold, silver,
// stock, realEstate, personalAsset, fixedIncome — each 0-100, summing to
// ~100). Compared against the live computed allocation by
// portfolioDriftCron.ts to fire a "drifted from target" push once a class
// moves past DRIFT_THRESHOLD_PP. driftAlertsEnabled/lastDriftAlertAt gate
// and rate-limit that push the same way portfolioSnapshots.lastNotifiedMilestone
// gates the daily ±1% push.
export const portfolioTargetsTable = pgTable("portfolio_targets", {
  id:                  text("id").primaryKey(),
  userId:              text("user_id").notNull(),
  data:                jsonb("data").notNull(),
  driftAlertsEnabled:  boolean("drift_alerts_enabled").notNull().default(true),
  lastDriftAlertAt:    timestamp("last_drift_alert_at", { withTimezone: true }),
  createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userUnique: unique().on(t.userId),
}));

export const insertPortfolioTargetSchema = createInsertSchema(portfolioTargetsTable);
export const selectPortfolioTargetSchema = createSelectSchema(portfolioTargetsTable);

export type InsertPortfolioTarget = z.infer<typeof insertPortfolioTargetSchema>;
export type DbPortfolioTarget     = typeof portfolioTargetsTable.$inferSelect;
