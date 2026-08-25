import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per realized sale — created when a holding is marked sold/redeemed
// (see POST /api/holdings/:id/sell), at which point the original holdings
// row is deleted. data is a denormalized snapshot (type, label, quantity,
// purchaseDate, costBasis, saleProceeds, saleDate, realizedGainLoss,
// optional notes) so this record still reads correctly after the holding
// it came from is gone — same reasoning as Dividend.symbol/companyName.
export const soldHoldingsTable = pgTable("sold_holdings", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSoldHoldingSchema = createInsertSchema(soldHoldingsTable);
export const selectSoldHoldingSchema = createSelectSchema(soldHoldingsTable);

export type InsertSoldHolding = z.infer<typeof insertSoldHoldingSchema>;
export type DbSoldHolding     = typeof soldHoldingsTable.$inferSelect;
