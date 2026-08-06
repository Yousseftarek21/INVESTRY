import { pgTable, text, integer, real, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One current row per area, upserted on every scrape — not a history log
// (see portfolioSnapshotsTable for that pattern instead). `area` here uses
// the same ids as lib/shared-data's RE_PRICES static list, so a scraped row
// and its static fallback can be matched 1:1.
export const realEstatePricesTable = pgTable("real_estate_prices", {
  id:            text("id").primaryKey(), // matches REAreaPrice.id, e.g. 'cairo-new-cairo'
  governorate:   text("governorate").notNull(),
  area:          text("area").notNull(),
  minPricePerM2: integer("min_price_per_m2").notNull(),
  maxPricePerM2: integer("max_price_per_m2").notNull(),
  avgPricePerM2: integer("avg_price_per_m2").notNull(),
  changePercent: real("change_percent"), // vs. previous scrape; null until a 2nd successful run exists
  sampleSize:    integer("sample_size").notNull(), // # of listings averaged this run
  type:          text("type").notNull(), // residential | villa | commercial | land | coastal
  source:        text("source").notNull(), // 'property_finder' — leaves room to add another source later
  updatedAt:     timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  areaUnique: unique().on(t.id),
}));

export const insertRealEstatePriceSchema = createInsertSchema(realEstatePricesTable);
export const selectRealEstatePriceSchema = createSelectSchema(realEstatePricesTable);

export type InsertRealEstatePrice = z.infer<typeof insertRealEstatePriceSchema>;
export type DbRealEstatePrice     = typeof realEstatePricesTable.$inferSelect;
