import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cashAccountsTable = pgTable("cash_accounts", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  type:      text("type").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCashAccountSchema = createInsertSchema(cashAccountsTable);
export const selectCashAccountSchema = createSelectSchema(cashAccountsTable);

export type InsertCashAccount = z.infer<typeof insertCashAccountSchema>;
export type DbCashAccount     = typeof cashAccountsTable.$inferSelect;
