// A "day" in this app always means an Africa/Cairo day. The backend computes
// today's cash change, the market close snapshots and every portfolio
// snapshot on Cairo's clock (api-server/src/lib/cairoDate.ts), so any date
// the UI renders alongside those figures has to agree with them.
//
// Formatting with the device's own timezone instead disagrees by a full day
// for anyone outside Egypt: an update made at 02:00 in Malaysia (UTC+8) is
// still 21:00 the previous evening in Cairo, so the list would file it under
// today while the "today" badge counts it as yesterday — the label and the
// number contradicting each other on the same screen.
//
// Only for dates that sit next to Cairo-based figures. A plain "last updated
// 10:42" recency stamp should stay in the reader's own timezone, since there
// the point is how long ago it was for them, not which Cairo day it fell on.
const CAIRO = 'Africa/Cairo';

// Sortable YYYY-MM-DD, for grouping/comparing days (en-CA gives that format).
export function cairoDayKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: CAIRO });
}

export function cairoDateLabel(
  d: Date,
  options: Intl.DateTimeFormatOptions,
  locale: string = 'en-EG',
): string {
  return d.toLocaleDateString(locale, { ...options, timeZone: CAIRO });
}

export function cairoTimeLabel(
  d: Date,
  options: Intl.DateTimeFormatOptions,
  locale: string = 'en-EG',
): string {
  return d.toLocaleTimeString(locale, { ...options, timeZone: CAIRO });
}

// The instant Cairo's current day began. Used as the "start of today"
// baseline for anything that accrues continuously (fixed income), so it
// ramps up from zero over the day the way a market-priced holding's change
// does, instead of measuring a rolling 24h window that never resets.
//
// Reads Cairo's wall clock and subtracts it, rather than parsing a formatted
// date string back into a Date the way the server's cairoMidnightUtc does:
// `new Date("8/16/2026, 2:17:00 AM")` is implementation-defined and not
// dependable on Hermes. toLocaleTimeString with an explicit timeZone is the
// pattern already proven across this codebase, and the rest is arithmetic.
export function cairoMidnight(now: Date = new Date()): Date {
  const [h, m, s] = now
    .toLocaleTimeString('en-GB', { timeZone: CAIRO, hour12: false })
    .split(':')
    .map(Number);
  // Some engines render midnight as 24:00:00 rather than 00:00:00.
  const elapsedMs = ((((h % 24) * 60 + m) * 60 + s) * 1000) + now.getMilliseconds();
  return new Date(now.getTime() - elapsedMs);
}

// Whole Cairo calendar days between two instants — 0 means "same day", 1
// "yesterday". Deliberately NOT elapsed-milliseconds / 86_400_000: that
// measures a rolling 24h window, so something done at 20:00 yesterday still
// reads as 0 ("today") at 09:00 this morning, which is how "Updated today"
// ended up on an account last touched the day before.
//
// Both keys are Cairo dates re-parsed at UTC midnight, so the subtraction is
// over exact whole days with no DST shift to round off.
export function cairoDaysAgo(d: Date, now: Date = new Date()): number {
  const then = new Date(`${cairoDayKey(d)}T00:00:00Z`).getTime();
  const today = new Date(`${cairoDayKey(now)}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((today - then) / 86_400_000));
}
