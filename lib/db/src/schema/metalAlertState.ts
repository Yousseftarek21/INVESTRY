import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Single-row table (id is always "singleton") tracking the last notified
// gold/silver ±1% milestone. Must be persisted, not held in memory — an
// in-memory counter resets to 0 on every server restart (deploy, crash,
// autoscale), which re-fires a "new" notification for a milestone that was
// already sent before the restart.
export const metalAlertStateTable = pgTable("metal_alert_state", {
  id:                  text("id").primaryKey(),
  lastGoldMilestone:   integer("last_gold_milestone").notNull().default(0),
  lastSilverMilestone: integer("last_silver_milestone").notNull().default(0),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMetalAlertStateSchema = createInsertSchema(metalAlertStateTable);
export const selectMetalAlertStateSchema = createSelectSchema(metalAlertStateTable);

export type InsertMetalAlertState = z.infer<typeof insertMetalAlertStateSchema>;
export type DbMetalAlertState     = typeof metalAlertStateTable.$inferSelect;
