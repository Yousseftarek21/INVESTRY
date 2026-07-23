import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const priceAlertsTable = pgTable("price_alerts", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPriceAlertSchema = createInsertSchema(priceAlertsTable);
export const selectPriceAlertSchema = createSelectSchema(priceAlertsTable);

export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type DbPriceAlert     = typeof priceAlertsTable.$inferSelect;
