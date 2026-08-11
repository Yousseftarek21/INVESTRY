import { eq } from "drizzle-orm";
import { db, tradingSessionStateTable } from "@workspace/db";
import { cairoDateString } from "./cairoDate";
import { logger } from "./logger";

// Singleton row id — there's only ever one "current" trading session tracked.
const SESSION_ROW_ID = "current";

// Keeps USD/EGP's own "today" reference aligned to *metals'* trading session
// instead of Cairo calendar midnight. gold/silver's own %-change comes
// straight from TradingView's xauPrevClose/xagPrevClose, which resets
// whenever TradingView's own session rolls over — not at a fixed local
// clock time. Resetting USD/EGP on a different clock (Cairo midnight) made
// a gold/silver holding's combined EGP %-change silently change composition
// at a moment neither market actually moved (currency snaps to 0% before
// TradingView's own session has rolled, or vice versa).
//
// metalsPrevClose is TradingView's live xauPrevClose for this tick, or null
// if the metals fetch itself failed — same condition markets.ts already
// checks before trusting `metals`. A rollover is detected purely by that
// value changing since the last tick; no assumption about *when* it changes.
export async function recordAndGetSessionAlignedUsdToEgp(
  metalsPrevClose: number | null,
  currentUsdToEgp: number,
): Promise<{ prevClose: number | null }> {
  try {
    const [existing] = await db
      .select()
      .from(tradingSessionStateTable)
      .where(eq(tradingSessionStateTable.id, SESSION_ROW_ID));

    if (metalsPrevClose === null) {
      // Can't tell whether a rollover happened this tick without a live
      // metals read — read-only, don't touch the stored session.
      return { prevClose: existing?.prevSessionCloseUsdToEgp ?? null };
    }

    if (!existing) {
      // Bootstrap: first time this table has ever been written. No prior
      // session to compare against yet, same as a brand-new deployment's
      // market_close_snapshots row.
      await db.insert(tradingSessionStateTable).values({
        id: SESSION_ROW_ID,
        metalsPrevCloseMarker: metalsPrevClose,
        sessionStartAt: new Date(),
        sessionOpenUsdToEgp: currentUsdToEgp,
        prevSessionCloseUsdToEgp: null,
        currentUsdToEgp,
      });
      return { prevClose: null };
    }

    if (existing.metalsPrevCloseMarker !== metalsPrevClose) {
      // TradingView's own session just rolled over — whatever was last live
      // in this row (the just-ended session's final value) becomes the new
      // baseline to diff against.
      await db
        .update(tradingSessionStateTable)
        .set({
          metalsPrevCloseMarker: metalsPrevClose,
          sessionStartAt: new Date(),
          sessionOpenUsdToEgp: currentUsdToEgp,
          prevSessionCloseUsdToEgp: existing.currentUsdToEgp,
          currentUsdToEgp,
          updatedAt: new Date(),
        })
        .where(eq(tradingSessionStateTable.id, SESSION_ROW_ID));
      return { prevClose: existing.currentUsdToEgp };
    }

    // Same session as last tick — keep the live figure current, baseline
    // stays untouched until the next real rollover.
    await db
      .update(tradingSessionStateTable)
      .set({ currentUsdToEgp, updatedAt: new Date() })
      .where(eq(tradingSessionStateTable.id, SESSION_ROW_ID));
    return { prevClose: existing.prevSessionCloseUsdToEgp ?? null };
  } catch (err) {
    logger.warn({ err }, "recordAndGetSessionAlignedUsdToEgp: DB read/write failed");
    return { prevClose: null };
  }
}

// The real UTC instant that is 00:00:00 in Africa/Cairo on the given
// "YYYY-MM-DD" Cairo date. Egypt's UTC offset isn't a stable constant to
// hardcode (it dropped DST in 2014, briefly reinstated it in 2023, then
// dropped it again) — this derives the actual offset from the IANA tz
// database via Intl instead, so it stays correct regardless of policy
// changes. Standard trick: format a UTC-midnight guess as Cairo wall-clock
// time, the gap between the two is the offset at that moment, then apply it.
function cairoMidnightUtc(cairoDate: string): Date {
  const guessUtc = new Date(`${cairoDate}T00:00:00Z`);
  const cairoWallClock = new Date(guessUtc.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const offsetMs = guessUtc.getTime() - cairoWallClock.getTime();
  return new Date(guessUtc.getTime() + offsetMs);
}

// Read-only: when did the *current* metals-aligned session start? Used by
// cash accounts' "today's change" so it resets on the same clock instead of
// Cairo midnight. Falls back to today's real Cairo midnight if no session
// has been recorded yet (brand-new deployment, or metals never successfully
// fetched) — degrades to exactly today's Cairo-midnight behavior rather than
// breaking.
export async function getCurrentTradingSessionStart(): Promise<Date> {
  try {
    const [existing] = await db
      .select({ sessionStartAt: tradingSessionStateTable.sessionStartAt })
      .from(tradingSessionStateTable)
      .where(eq(tradingSessionStateTable.id, SESSION_ROW_ID));
    if (existing) return existing.sessionStartAt;
  } catch (err) {
    logger.warn({ err }, "getCurrentTradingSessionStart: DB read failed, falling back to Cairo midnight");
  }
  return cairoMidnightUtc(cairoDateString());
}
