import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Money the user owes: bank loans, car loans, credit cards, money borrowed
// from someone, and property installment plans. One encrypted JSON blob per
// loan, same as goals — the payments log lives inside it.
export const loansTable = pgTable("loans", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("loans_user_idx").on(t.userId)]);

export type DbLoan = typeof loansTable.$inferSelect;
