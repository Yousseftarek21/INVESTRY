// Africa/Cairo, not UTC — every cron and the portfolio_snapshots.date column
// share this so a "day" always means the same thing across the codebase.
export function cairoDateString(d: Date = new Date()): string {
  // en-CA gives YYYY-MM-DD directly.
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}
