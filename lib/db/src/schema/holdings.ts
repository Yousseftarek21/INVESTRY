import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const holdingsTable = pgTable("holdings", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  type:      text("type").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertHoldingSchema = createInsertSchema(holdingsTable);
export const selectHoldingSchema = createSelectSchema(holdingsTable);

export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type DbHolding     = typeof holdingsTable.$inferSelect;
