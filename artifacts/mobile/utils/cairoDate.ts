// ─── The app's trading day ────────────────────────────────────────────────────
// Must stay identical to api-server/src/lib/cairoDate.ts — the server sums
// today's cash change and every market percentage against this boundary, so a
// date rendered next to those figures has to agree with them or the label and
// the number contradict each other on the same screen.
//
// 22:00 UTC, fixed. See the server's copy for why that hour rather than Cairo
// midnight: Egypt shifts for daylight saving, the metals market doesn't, and
// anchoring to Cairo left gold an hour out of step with everything else all
// summer.
//
// Deliberately arithmetic plus toISOString, with no locale parsing: this runs
// on Hermes, where `new Date("8/16/2026, 2:17:00 AM")` is not dependable.
const TRADING_DAY_SHIFT_MS = 2 * 60 * 60 * 1000; // 24:00 − 22:00

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

// Renders the trading day an instant belongs to — so a row's printed date can
// never disagree with the badge that sums it. Formats the key itself at UTC
// noon, far from any boundary, so no timezone can shift the printed date off
// the day it is labelling. ISO-8601 parsing is well-defined everywhere,
// unlike re-parsing a localized string.
export function tradingDayLabel(
  d: Date,
  options: Intl.DateTimeFormatOptions,
  locale: string = 'en-EG',
): string {
  return new Date(`${tradingDayKey(d)}T12:00:00Z`)
    .toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
}

// Whole trading days between two instants — 0 is "today", 1 "yesterday".
// Deliberately NOT elapsed-ms / 86_400_000: that measures a rolling 24h
// window, so something done at 20:00 yesterday still reads as 0 ("today") at
// 09:00 this morning, which is how "Updated today" ended up on an account
// last touched the day before.
export function tradingDaysAgo(d: Date, now: Date = new Date()): number {
  const then = new Date(`${tradingDayKey(d)}T00:00:00Z`).getTime();
  const today = new Date(`${tradingDayKey(now)}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((today - then) / 86_400_000));
}

// ─── Africa/Cairo formatting ──────────────────────────────────────────────────
// Renders the clock time of an instant in Egypt's timezone, for display next
// to trading-day dates. Which *day* something belongs to is the trading day
// above; this is only how the time of day is spelled out.
//
// A plain "last updated 10:42" recency stamp should stay in the reader's own
// timezone instead, since there the point is how long ago it was for them.
export function cairoTimeLabel(
  d: Date,
  options: Intl.DateTimeFormatOptions,
  locale: string = 'en-EG',
): string {
  return d.toLocaleTimeString(locale, { ...options, timeZone: 'Africa/Cairo' });
}
