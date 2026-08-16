// ─── The app's trading day ────────────────────────────────────────────────────
// Every "today" figure — cash, USD/EGP, gold, silver, EGX, fixed income, the
// snapshots — measures from this one boundary, so they all reset together.
//
// The boundary is 18:00 America/New_York: the COMEX/CME day start, and the
// same instant TradingView opens its metals bar on. Verified against the live
// feed, not assumed — TVC:GOLD reports timezone "America/New_York", and its
// bar sat at 1786658400 = 2026-08-13 22:00 UTC = exactly 18:00 New York.
//
// Anchored to New York rather than a fixed UTC hour because the US shifts for
// daylight saving, so the boundary really is 22:00 UTC in summer and 23:00 UTC
// in winter. Hardcoding either one is wrong for half the year. Deriving it
// from the IANA database means it tracks the switch on its own, in both
// directions, with nothing to adjust by hand — including the two switch days
// themselves, where a naive offset calculation lands an hour out.
//
// Not Cairo midnight, which was the previous anchor: Egypt shifts on different
// dates than the US, so gold spent every summer an hour out of step with cash
// and EGX. And deliberately a daily wall-clock boundary rather than "whatever
// the metals session is doing" — keying off the session was tried and
// reverted, because it doesn't roll over a weekend and cash stopped resetting
// for three days. This fires every calendar day, weekends included.
const NY = "America/New_York";
const ANCHOR_HOUR_NY = 18;
// Shifting by (24 − 18) hours moves the boundary onto a New York midnight, so
// the NY calendar date of the shifted instant *is* the day's label.
const SHIFT_MS = (24 - ANCHOR_HOUR_NY) * 60 * 60 * 1000;

const pad = (n: number): string => String(n).padStart(2, "0");

function nyDateOf(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: NY });
}

/** Milliseconds to add to a UTC instant to read New York's wall clock. */
function nyOffsetMs(d: Date): number {
  const [h, m, s] = d
    .toLocaleTimeString("en-GB", { timeZone: NY, hour12: false })
    .split(":")
    .map(Number);
  return Date.parse(`${nyDateOf(d)}T${pad(h % 24)}:${pad(m)}:${pad(s)}Z`) - (d.getTime() - d.getMilliseconds());
}

/** The UTC instant at which New York's clock reads `hour`:00 on NY date `nyDate`. */
function nyInstant(nyDate: string, hour: number): Date {
  const wall = Date.parse(`${nyDate}T${pad(hour)}:00:00Z`);
  let t = wall;
  // Two passes: the first uses the offset at the guess, the second re-reads it
  // at the corrected instant. That second pass is what gets the DST switch
  // days right, where the offset at the guess differs from the offset at the
  // answer.
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

// ─── Africa/Cairo calendar ────────────────────────────────────────────────────
// Still used for genuinely Egyptian-calendar facts — which weekday it is for
// Egypt's Sun-Thu banking week, and the month-to-date boundary — but no longer
// for any "today" reset. Those all use the trading day above.
export function cairoDateString(d: Date = new Date()): string {
  // en-CA gives YYYY-MM-DD directly.
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}
