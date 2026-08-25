// A true calendar month boundary — the 1st of the current month, resetting
// the moment the next calendar month begins (e.g. August's window ends and
// September's starts fresh on Sep 1). Used by both the referral leaderboard's
// monthly prize window and the portfolio leaderboard's "month" period.
//
// Built with Date.UTC()/getUTCFullYear()/getUTCMonth() explicitly rather
// than the local Date methods (getMonth() etc.), which read the HOST
// machine's timezone — whatever the server's container happens to be
// configured with, not a deliberate choice. Using UTC unconditionally means
// this boundary is the same instant no matter what TZ the process runs in,
// and needs no DST handling the way cairoDate.ts's NY-anchored trading day
// does — a calendar month boundary doesn't shift with DST.
export function utcMonthStart(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

// Same boundary as utcMonthStart, as a YYYY-MM-DD date key — for comparing
// against tradingDayKey()-stamped rows (portfolio_snapshots.date, holdings'
// createdAt) the same way cairoWeekStart's string already is, rather than a
// Date object. The portfolio leaderboard used to build "month" out of a
// rolling 4-week window instead of the calendar month (see cairoDate.ts's
// git history) — deliberately not that: users expect "this month" to mean
// the actual calendar month, start-to-finish, resetting on the 1st, the
// same as the referral prize window already does.
export function utcMonthStartKey(d: Date = new Date()): string {
  return utcMonthStart(d).toISOString().slice(0, 10);
}
