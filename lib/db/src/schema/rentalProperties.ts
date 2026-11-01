import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

// Rental Properties: units a user rents out, and the bookings (short stays),
// leases (long-term tenants) and expenses recorded against each. Separate
// from real estate *investments* (holdings) — a unit may optionally link to
// one, but neither depends on the other. Same convention as the other
// user-data tables: everything except ids lives in the encrypted `data` blob
// (see lib/encryption.ts); `unit_id` stays plain only so a unit's children
// can be found and deleted with it.

export const rentalUnitsTable = pgTable("rental_units", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index("rental_units_user_idx").on(t.userId),
}));

function childTable<N extends string>(name: N) {
  return pgTable(name, {
    id:        text("id").primaryKey(),
    userId:    text("user_id").notNull(),
    unitId:    text("unit_id").notNull(),
    data:      jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }, (t) => ({
    userIdx: index(`${name}_user_idx`).on(t.userId),
  }));
}

export const rentalBookingsTable = childTable("rental_bookings");
export const rentalLeasesTable = childTable("rental_leases");
export const rentalExpensesTable = childTable("rental_expenses");
