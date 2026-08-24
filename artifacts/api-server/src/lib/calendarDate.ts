// A true calendar month boundary for the referral leaderboard's monthly
// prize window — deliberately NOT cairoMonthStart()'s rolling 4-week
// window (see cairoDate.ts), which fits a rolling % return leaderboard,
// not "each calendar month gets its own prize."
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
