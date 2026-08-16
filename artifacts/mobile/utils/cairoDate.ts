// ─── The app's trading day ────────────────────────────────────────────────────
// Must stay identical to api-server/src/lib/cairoDate.ts — the server sums
// today's cash change and every market percentage against this boundary, so a
// date rendered next to those figures has to agree with it, or the label and
// the number contradict each other on the same screen.
//
// 18:00 America/New_York: the COMEX/CME day start, and the same instant
// TradingView opens its metals bar on (verified against the live feed — see
// the server's copy). Anchored to New York rather than a fixed UTC hour
// because the US shifts for daylight saving, making the real boundary 22:00
// UTC in summer and 23:00 UTC in winter; deriving it from the IANA database
// tracks that on its own, with nothing to adjust by hand.
//
// Every call below is toLocaleDateString/toLocaleTimeString with an explicit
// timeZone, or Date.parse on an ISO-8601 string. Both are dependable on
// Hermes, unlike re-parsing a localized string such as
// `new Date("8/16/2026, 2:17:00 AM")`.
const NY = 'America/New_York';
const ANCHOR_HOUR_NY = 18;
const SHIFT_MS = (24 - ANCHOR_HOUR_NY) * 60 * 60 * 1000;

const pad = (n: number): string => String(n).padStart(2, '0');

function nyDateOf(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: NY });
}

/** Milliseconds to add to a UTC instant to read New York's wall clock. */
function nyOffsetMs(d: Date): number {
  const [h, m, s] = d
    .toLocaleTimeString('en-GB', { timeZone: NY, hour12: false })
    .split(':')
    .map(Number);
  return Date.parse(`${nyDateOf(d)}T${pad(h % 24)}:${pad(m)}:${pad(s)}Z`) - (d.getTime() - d.getMilliseconds());
}

/** The UTC instant at which New York's clock reads `hour`:00 on NY date `nyDate`. */
function nyInstant(nyDate: string, hour: number): Date {
  const wall = Date.parse(`${nyDate}T${pad(hour)}:00:00Z`);
  let t = wall;
  // Second pass is what gets the DST switch days right — the offset at the
  // first guess differs from the offset at the answer.
  for (let i = 0; i < 2; i++) t = wall - nyOffsetMs(new Date(t));
  return new Date(t);
}

/** YYYY-MM-DD label of the trading day containing `d`. */
export function tradingDayKey(d: Date = new Date()): string {
  return nyDateOf(new Date(d.getTime() + SHIFT_MS));
}

/** The instant the trading day containing `d` began (18:00 New York). */
export function tradingDayStart(d: Date = new Date()): Date {
  const key = tradingDayKey(d);
  const prevDay = new Date(Date.parse(`${key}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return nyInstant(prevDay, ANCHOR_HOUR_NY);
}

// Renders the trading day an instant belongs to — so a row's printed date can
// never disagree with the badge that sums it. Formats the key itself at UTC
// noon, far from any boundary, so no timezone can shift the printed date off
// the day it is labelling.
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
  const then = Date.parse(`${tradingDayKey(d)}T00:00:00Z`);
  const today = Date.parse(`${tradingDayKey(now)}T00:00:00Z`);
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
