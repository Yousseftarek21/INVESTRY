import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A confirmation feed for the user's own add/edit actions on cash accounts
// and investment holdings — "you just did X", not a market/portfolio alert.
// Plain text, not encrypted: same precedent as cash_balance_updates and
// portfolio_snapshots — title/subtitle here are no more sensitive than a
// number already visible elsewhere in its own encrypted row.
export const activityLogTable = pgTable("activity_log", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  type:      text("type").notNull(), // 'cash_added' | 'cash_edited' | 'holding_added' | 'holding_edited'
  title:     text("title").notNull(),
  subtitle:  text("subtitle").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogTable);
export const selectActivityLogSchema = createSelectSchema(activityLogTable);

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type DbActivityLog     = typeof activityLogTable.$inferSelect;
