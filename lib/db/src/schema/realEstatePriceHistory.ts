import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

// One row per area/compound per day with a successful scrape — the trend
// behind the single current row in real_estate_prices /
// real_estate_compound_prices. `id` is `${kind}:${refId}:${YYYY-MM-DD}`, so
// a second scrape the same day overwrites rather than adds.
export const realEstatePriceHistoryTable = pgTable("real_estate_price_history", {
  id:            text("id").primaryKey(),
  kind:          text("kind").notNull(), // 'area' | 'compound'
  refId:         text("ref_id").notNull(), // RE_PRICES / RE_COMPOUNDS id
  day:           text("day").notNull(), // YYYY-MM-DD, Africa/Cairo
  avgPricePerM2: integer("avg_price_per_m2").notNull(),
  minPricePerM2: integer("min_price_per_m2").notNull(),
  maxPricePerM2: integer("max_price_per_m2").notNull(),
  sampleSize:    integer("sample_size").notNull(),
  source:        text("source").notNull(),
  priceBasis:    text("price_basis"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  refIdx: index("real_estate_price_history_ref_idx").on(t.kind, t.refId, t.day),
}));

export type DbRealEstatePriceHistory = typeof realEstatePriceHistoryTable.$inferSelect;
