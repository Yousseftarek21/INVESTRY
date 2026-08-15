// Africa/Cairo, not UTC — every cron and the portfolio_snapshots.date column
// share this so a "day" always means the same thing across the codebase.
export function cairoDateString(d: Date = new Date()): string {
  // en-CA gives YYYY-MM-DD directly.
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}

// The real UTC instant of 00:00:00 Africa/Cairo for the given Cairo date
// (defaults to today's). Egypt's offset isn't a constant worth hardcoding —
// it dropped DST in 2014, reinstated it in 2023, and is on UTC+3 (EEST) as
// of this writing — so the offset is derived from the IANA tz database via
// Intl at the moment in question.
//
// Both sides of the subtraction are formatted with toLocaleString and parsed
// back, so the host machine's own timezone cancels out. Reading only the
// Cairo side and diffing it against the raw timestamp does NOT work: the
// re-parse silently reinterprets the wall-clock string in the host's local
// zone, so the answer comes out wrong by the host's offset (correct on a UTC
// server, wrong by 8h on a UTC+8 laptop — exactly the kind of bug that only
// shows up somewhere other than where it was written).
export function cairoMidnightUtc(cairoDate: string = cairoDateString()): Date {
  const guessUtc = new Date(`${cairoDate}T00:00:00Z`);
  const asUtc   = new Date(guessUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const asCairo = new Date(guessUtc.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  return new Date(guessUtc.getTime() - (asCairo.getTime() - asUtc.getTime()));
}
