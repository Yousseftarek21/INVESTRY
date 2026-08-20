import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dividendsTable = pgTable("dividends", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertDividendSchema = createInsertSchema(dividendsTable);
export const selectDividendSchema = createSelectSchema(dividendsTable);

export type InsertDividend = z.infer<typeof insertDividendSchema>;
export type DbDividend     = typeof dividendsTable.$inferSelect;
