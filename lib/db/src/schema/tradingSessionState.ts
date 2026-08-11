import { pgTable, text, real, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Single row (id: "current"), tracking USD/EGP against the *metals* trading
// session's own boundary instead of Cairo calendar midnight — gold/silver's
// own %-change (from TradingView's xauPrevClose/xagPrevClose) resets on
// TradingView's own session clock, so a USD/EGP change reset on a different
// clock (calendar midnight) made the combined EGP %-change for a gold/silver
// holding silently change composition at a moment neither market actually
// moved. See markets.ts's recordAndGetSessionAlignedUsdToEgp.
//
// metalsPrevCloseMarker is the last-observed TradingView xauPrevClose value
// — not itself meaningful, just a fingerprint: whenever it differs from the
// previous tick's value, TradingView's own session has rolled over, and
// that's this table's only reset trigger.
export const tradingSessionStateTable = pgTable("trading_session_state", {
  id:                       text("id").primaryKey(), // fixed singleton row: "current"
  // doublePrecision, not real: this column is compared with strict !==, and
  // real (32-bit) doesn't round-trip a JS double (64-bit) exactly — storing
  // then reading back a gold price like 4402.86 through a real column can
  // come back as a subtly different double, which would make the !== check
  // spuriously "detect a rollover" on nearly every tick. Every other column
  // here is only ever used in tolerant subtraction/percentage math, where
  // real's precision is fine — this is the one exception.
  metalsPrevCloseMarker:    doublePrecision("metals_prev_close_marker").notNull(),
  sessionStartAt:           timestamp("session_start_at", { withTimezone: true }).notNull(),
  sessionOpenUsdToEgp:      real("session_open_usd_to_egp").notNull(),
  // Null until a 2nd session has ever been observed (brand new deployment) —
  // same "honest 0% until a real prior close exists" pattern as
  // market_close_snapshots.
  prevSessionCloseUsdToEgp: real("prev_session_close_usd_to_egp"),
  currentUsdToEgp:          real("current_usd_to_egp").notNull(),
  updatedAt:                timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertTradingSessionStateSchema = createInsertSchema(tradingSessionStateTable);
export const selectTradingSessionStateSchema = createSelectSchema(tradingSessionStateTable);

export type InsertTradingSessionState = z.infer<typeof insertTradingSessionStateSchema>;
export type DbTradingSessionState     = typeof tradingSessionStateTable.$inferSelect;
