import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A logged rental payment, always tied to a specific real_estate holding
// the owner already saved — same independent-top-level-record shape as
// dividends.ts/recurringIncome.ts (own table, not embedded on the
// holding). The link to that holding, the tenant info, dates, amount, etc.
// all live inside the encrypted `data` blob (see RentalRecord in
// artifacts/mobile/types/index.ts) — same convention those two tables use.
export const rentalRecordsTable = pgTable("rental_records", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRentalRecordSchema = createInsertSchema(rentalRecordsTable);
export const selectRentalRecordSchema = createSelectSchema(rentalRecordsTable);

export type InsertRentalRecord = z.infer<typeof insertRentalRecordSchema>;
export type DbRentalRecord     = typeof rentalRecordsTable.$inferSelect;
