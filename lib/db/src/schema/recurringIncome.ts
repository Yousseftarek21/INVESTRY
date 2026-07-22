import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recurringIncomeTable = pgTable("recurring_income", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRecurringIncomeSchema = createInsertSchema(recurringIncomeTable);
export const selectRecurringIncomeSchema = createSelectSchema(recurringIncomeTable);

export type InsertRecurringIncome = z.infer<typeof insertRecurringIncomeSchema>;
export type DbRecurringIncome     = typeof recurringIncomeTable.$inferSelect;
