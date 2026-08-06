import { pgTable, text, integer, real, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One current row per compound, upserted on every scrape — same pattern as
// realEstatePricesTable, one level finer-grained. Separate table rather than
// nullable columns on realEstatePricesTable: many compounds live inside one
// area, and a compound carries an attribute (developer) an area doesn't.
// `id` matches lib/shared-data's RE_COMPOUNDS static list, so a scraped row
// and its curated entry can be matched 1:1. `areaId` is a soft link (no DB
// FK, same loose-coupling as the rest of this schema) to a realEstatePrices
// row, used to power an honest fallback when a compound hasn't been scraped
// yet — see GET /markets/real-estate/compounds.
export const realEstateCompoundPricesTable = pgTable("real_estate_compound_prices", {
  id:            text("id").primaryKey(), // '<developer-slug>-<compound-slug>', e.g. 'hassan-allam-swan-lake'
  name:          text("name").notNull(),
  developer:     text("developer").notNull(),
  governorate:   text("governorate").notNull(),
  areaId:        text("area_id"),
  minPricePerM2: integer("min_price_per_m2").notNull(),
  maxPricePerM2: integer("max_price_per_m2").notNull(),
  avgPricePerM2: integer("avg_price_per_m2").notNull(),
  changePercent: real("change_percent"),
  sampleSize:    integer("sample_size").notNull(),
  type:          text("type").notNull(),
  source:        text("source").notNull(), // 'property_finder'
  updatedAt:     timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  compoundUnique: unique().on(t.id),
}));

export const insertRealEstateCompoundPriceSchema = createInsertSchema(realEstateCompoundPricesTable);
export const selectRealEstateCompoundPriceSchema = createSelectSchema(realEstateCompoundPricesTable);

export type InsertRealEstateCompoundPrice = z.infer<typeof insertRealEstateCompoundPriceSchema>;
export type DbRealEstateCompoundPrice     = typeof realEstateCompoundPricesTable.$inferSelect;
