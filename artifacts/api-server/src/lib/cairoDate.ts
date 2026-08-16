// ─── The app's trading day ────────────────────────────────────────────────────
// Every "today" figure — cash, USD/EGP, gold, silver, EGX, fixed income, the
// snapshots — measures from this one boundary, so they all reset together.
//
// 22:00 UTC, fixed, rather than Cairo midnight. Cairo midnight is 21:00 UTC in
// summer and 22:00 UTC in winter because Egypt shifts for daylight saving,
// while the metals market this portfolio is mostly priced against rolls at
// 22:00 UTC (verified from TradingView's own bar timestamps). Anchoring to
// Cairo left the two an hour apart every summer: for that hour gold still
// carried yesterday's move while everything else had already zeroed.
//
// Fixed, and not "whatever the metals session is doing", on purpose. Keying
// off the session was tried and reverted: it doesn't roll over a weekend, so
// cash stopped resetting for three days. A fixed hour fires every calendar
// day, weekends included, and can't drift whatever any exchange does.
const TRADING_DAY_BOUNDARY_UTC_HOUR = 22;
// Shifting by (24 - 22) hours lands the boundary on a UTC midnight, so the
// UTC calendar date of the shifted instant *is* the day's label: 22:00 UTC on
// the 15th becomes the 16th, 21:59 on the 15th stays the 15th. Chosen so a
// winter day's key equals its Cairo calendar date — nothing changes meaning
// when Egypt's clocks move.
const TRADING_DAY_SHIFT_MS = (24 - TRADING_DAY_BOUNDARY_UTC_HOUR) * 60 * 60 * 1000;

/** YYYY-MM-DD label of the trading day containing `d`. */
export function tradingDayKey(d: Date = new Date()): string {
  return new Date(d.getTime() + TRADING_DAY_SHIFT_MS).toISOString().slice(0, 10);
}

/** The most recent 22:00 UTC boundary at or before `d`. */
export function tradingDayStart(d: Date = new Date()): Date {
  const shifted = new Date(d.getTime() + TRADING_DAY_SHIFT_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - TRADING_DAY_SHIFT_MS);
}

// ─── Africa/Cairo calendar ────────────────────────────────────────────────────
// Still used for genuinely Egyptian-calendar facts — which weekday it is for
// Egypt's Sun-Thu banking week, and the month-to-date boundary — but no longer
// for any "today" reset. Those all use the trading day above.
export function cairoDateString(d: Date = new Date()): string {
  // en-CA gives YYYY-MM-DD directly.
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}
