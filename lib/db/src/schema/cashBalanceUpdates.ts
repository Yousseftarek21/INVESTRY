import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// An append-only log of manual cash-account balance changes — not a
// transaction/expense ledger (no categories, no line items), just "this
// account's balance changed by this much, at this time." Computed and
// written by the client at the moment of a manual edit (it already knows
// the old and new balance to derive delta from), matching how
// portfolioSnapshots stores a plain numeric history rather than an
// encrypted rich object — there's nothing here more sensitive than a number
// already visible in the (encrypted) cash_accounts row itself.
export const cashBalanceUpdatesTable = pgTable("cash_balance_updates", {
  id:               text("id").primaryKey(),
  userId:           text("user_id").notNull(),
  cashAccountId:    text("cash_account_id").notNull(),
  delta:            real("delta").notNull(),
  resultingBalance: real("resulting_balance").notNull(),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCashBalanceUpdateSchema = createInsertSchema(cashBalanceUpdatesTable);
export const selectCashBalanceUpdateSchema = createSelectSchema(cashBalanceUpdatesTable);

export type InsertCashBalanceUpdate = z.infer<typeof insertCashBalanceUpdateSchema>;
export type DbCashBalanceUpdate     = typeof cashBalanceUpdatesTable.$inferSelect;
