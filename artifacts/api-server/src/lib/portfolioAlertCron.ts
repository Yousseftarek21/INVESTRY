import { and, desc, eq, lt, gt, sql } from "drizzle-orm";
import { db, usersTable, portfolioSnapshotsTable, activityLogTable, dailyChangeSnapshotsTable } from "@workspace/db";
import { computeUserPortfolioValue, computePeriodPerformance } from "./portfolioValue";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";
import { tradingDayKey, tradingDayStart, isSaturday } from "./cairoDate";
import { isUserPro } from "./isUserPro";

// Checked every 5 minutes throughout the day — each check compares
// today's live value against yesterday's close and may push again if the
// move has reached a new 1% milestone since the last push (see
// lastNotifiedMilestone below). Can't go faster than ~1 min: the EGP
// conversion rate this depends on (fetchUsdToEgp -> CIB) is rate-limited
// upstream by Incapsula bot-protection, so 5 min leaves a comfortable
// safety margin while cutting the old 30-min worst-case lag 6x. There's no
// live push price feed to react to instantly — every value here is polled.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CHANGE_THRESHOLD_PCT = 1;
// A real diversified portfolio doesn't swing this much in one day — a
// reading past this is almost certainly a data artifact (e.g. a valuation
// formula change comparing against a snapshot taken under the old formula,
// or a holding being added/edited/removed, not real market movement)
// rather than an actual move, so it's safer to skip the push (or, for
// dailyChangeBackfill.ts's snapshot-based history, skip showing that day at
// all) than mislead. Exported so both places share one threshold.
export const SANITY_MAX_PCT = 20;

function generateId(): string {
  return `snap_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function dailyChangeId(userId: string, date: string): string {
  return `dchg_${userId}_${date}`;
}

// Deterministic (not random) so the insert below can upsert onto the same
// row all day — one bell entry per user per day for portfolio moves, not
// one per milestone crossed.
function portfolioActivityId(userId: string, date: string): string {
  return `act_portfolio_${userId}_${date}`;
}

// Snapshot history is written for every user daily regardless of push
// settings — it's what the mobile 1W/1M/etc charts read as durable,
// per-account history (see /api/portfolio/snapshots), independent of
// whether this particular user ever registered for push. Only the push
// *send* below is gated on having a token and alerts being enabled.
//
// Re-checked every tick throughout the day (not just once) against the
// fixed reference of yesterday's close — matching the mobile app's own
// "Today" card, which recomputes live all day against the same start-of-
// day baseline. A move that only crosses ±1% later in the day still gets
// caught, instead of being missed because an early, unrepresentative
// snapshot already used up the day's one check.
async function checkUser(userId: string, today: string, pushToken: string | null): Promise<void> {
  const totalValue = await computeUserPortfolioValue(userId);
  if (totalValue <= 0) return; // nothing to track yet

  // Always refresh today's stored value to the latest — never touches
  // `lastNotifiedMilestone` here, which is the atomic gate for the push
  // send below.
  await db
    .insert(portfolioSnapshotsTable)
    .values({ id: generateId(), userId, date: today, totalValue, lastNotifiedMilestone: 0 })
    .onConflictDoUpdate({
      target: [portfolioSnapshotsTable.userId, portfolioSnapshotsTable.date],
      set: { totalValue },
    });

  // Append this tick to the day's intraday series, so the 1D chart can draw
  // real movement across the whole day rather than a straight line between
  // start-of-day and now. Capped at 288 points (one per 5-minute tick = 24h)
  // so a long day can't grow the row unbounded.
  //
  // Deliberately a separate statement after the upsert above, inside its own
  // try/catch: this is the newest and most intricate piece of SQL here, and a
  // failure in it must never take down the value tracking and push alerts
  // that were working long before it existed.
  try {
    await db.execute(sql`
      UPDATE "portfolio_snapshots"
      SET "intraday" = (
        SELECT jsonb_agg(pt ORDER BY ord)
        FROM (
          SELECT pt, ord
          FROM jsonb_array_elements(
            COALESCE("intraday", '[]'::jsonb) || ${JSON.stringify([{ t: Math.floor(Date.now() / 1000), v: totalValue }])}::jsonb
          ) WITH ORDINALITY AS x(pt, ord)
          ORDER BY ord DESC
          LIMIT 288
        ) recent
      )
      WHERE "user_id" = ${userId} AND "date" = ${today}
    `);
  } catch (err) {
    logger.warn({ err, userId }, "Intraday series append failed — value tracking unaffected");
  }

  // Records today's "Today's Change %" (the same figure the Home tab's
  // badge shows, computed the same gaming-proof way as the leaderboard —
  // see computePeriodPerformance's own comment) so it survives past the
  // day's rollover, when the live badge resets to a fresh 0% for the new
  // day. Continuously overwritten every tick (same pattern as the intraday
  // series above and marketCloseSnapshots.ts) — whatever was last written
  // before the trading day rolls over becomes that day's permanent record.
  // Isolated in its own try/catch for the same reason as the intraday
  // block: a failure here must never take down value tracking or alerts.
  try {
    const yesterday = tradingDayKey(new Date(tradingDayStart().getTime() - 1));
    const { pctReturn: computedPctReturn } = await computePeriodPerformance(userId, yesterday);
    // Every market this app prices is closed the entire span of a Saturday
    // trading day (see isSaturday's own comment) — any nonzero reading here
    // is live-feed jitter, not a real move, so it's overridden to exactly 0
    // rather than trusted. Only overrides a real number; a user with
    // nothing eligible to measure (null) still gets no row at all, same as
    // any other day.
    const pctReturn = computedPctReturn != null && isSaturday(today) ? 0 : computedPctReturn;
    // Hard guardrail, independent of whatever produced the number: a real
    // diversified portfolio doesn't move this much in a day (same
    // SANITY_MAX_PCT threshold already used for push-alert milestones
    // above). Seen live in production: a value that should have been
    // stable around -0.6% briefly read +22%, self-correcting a few
    // minutes later — almost certainly a stale per-instance price cache
    // racing during a rolling deploy (this cron runs independently on
    // every server process), not a real market move. Rather than chase
    // that race to its exact root cause, refuse to ever persist or
    // overwrite a value this implausible — better to skip a tick than
    // show a fabricated-looking number on a screen a user reads as fact.
    if (pctReturn != null && Math.abs(pctReturn) <= SANITY_MAX_PCT) {
      await db
        .insert(dailyChangeSnapshotsTable)
        .values({ id: dailyChangeId(userId, today), userId, date: today, pctReturn })
        .onConflictDoUpdate({
          target: [dailyChangeSnapshotsTable.userId, dailyChangeSnapshotsTable.date],
          set: { pctReturn, updatedAt: new Date() },
        });
    } else if (pctReturn != null) {
      logger.warn({ userId, pctReturn }, "Rejected implausible daily change reading — not persisted");
    }
  } catch (err) {
    logger.warn({ err, userId }, "Daily change snapshot failed — Today's Change history unaffected");
  }

  if (!pushToken) return;

  const [prior] = await db
    .select({ totalValue: portfolioSnapshotsTable.totalValue })
    .from(portfolioSnapshotsTable)
    .where(and(eq(portfolioSnapshotsTable.userId, userId), lt(portfolioSnapshotsTable.date, today)))
    .orderBy(desc(portfolioSnapshotsTable.date))
    .limit(1);
  if (!prior || prior.totalValue <= 0) return;

  const pctChange = ((totalValue - prior.totalValue) / prior.totalValue) * 100;
  if (Math.abs(pctChange) > SANITY_MAX_PCT) {
    logger.warn({ userId, pctChange, totalValue, prior: prior.totalValue }, "Skipping implausible portfolio alert");
    return;
  }

  // Signed whole-percent bucket, e.g. 2.7% -> 2, -1.4% -> -1. Only a new
  // milestone further from zero than the last one notified today triggers
  // a push, so 1%, 2%, 3%... each fire once as they're reached, but
  // wobbling back and forth under an already-hit milestone stays quiet.
  const milestone = Math.trunc(pctChange);
  if (Math.abs(milestone) < CHANGE_THRESHOLD_PCT) return;

  // Atomic compare-and-swap: only the process whose UPDATE actually moves
  // lastNotifiedMilestone further from zero sends the push — closes a
  // multi-process race (e.g. a rolling deploy's brief old/new instance
  // overlap) where two processes could otherwise both read the same stale
  // milestone and both send.
  const updated = await db
    .update(portfolioSnapshotsTable)
    .set({ lastNotifiedMilestone: milestone })
    .where(and(
      eq(portfolioSnapshotsTable.userId, userId),
      eq(portfolioSnapshotsTable.date, today),
      milestone > 0
        ? lt(portfolioSnapshotsTable.lastNotifiedMilestone, milestone)
        : gt(portfolioSnapshotsTable.lastNotifiedMilestone, milestone),
    ))
    .returning({ id: portfolioSnapshotsTable.id });

  if (updated.length === 0) return; // this milestone (or a further one) was already notified today

  const dir = pctChange > 0 ? "up" : "down";
  const title = "Portfolio Update";
  const subtitle = `Your portfolio is ${dir} ${Math.abs(pctChange).toFixed(1)}% today`;

  // A push goes out on every milestone crossed today (1%, then 2%, then
  // 3%...), each with the live cumulative %, same as before. But the bell
  // should only ever show today's *latest* portfolio move, not one row per
  // crossing — so this upserts the same row instead of inserting a new one,
  // and bumps createdAt so it re-sorts to the top as "just happened".
  // portfolio_snapshots itself stays one-row-per-day (it also backs the
  // mobile charts) and is unrelated to this — this write only happens here,
  // only when a push is genuinely sent.
  await db.insert(activityLogTable)
    .values({ id: portfolioActivityId(userId, today), userId, type: "portfolio_alert", title, subtitle })
    .onConflictDoUpdate({
      target: activityLogTable.id,
      set: { title, subtitle, createdAt: new Date() },
    });

  await sendPushToTokens([pushToken], title, subtitle, { type: "portfolio_alert" });
}

let running = false;

async function checkAllUsers(): Promise<void> {
  if (running) return; // guard against overlap if a prior run is still in flight
  running = true;
  try {
    const today = tradingDayKey();
    // Portfolio alert pushes are a Pro feature — betaUnlockAll mirrors the
    // same escape hatch /api/subscription uses.
    const betaUnlockAll = process.env.BETA_UNLOCK_ALL === "true";
    const users = await db
      .select({ id: usersTable.id, pushToken: usersTable.pushToken, alertsEnabled: usersTable.portfolioAlertsEnabled, plan: usersTable.plan, proCreditExpiresAt: usersTable.proCreditExpiresAt })
      .from(usersTable);

    for (const u of users) {
      try {
        const isPro = isUserPro(u) || betaUnlockAll;
        await checkUser(u.id, today, isPro && u.alertsEnabled ? u.pushToken : null);
      } catch (err) {
        logger.warn({ err, userId: u.id }, "Portfolio alert check failed for user");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Portfolio alert cron run failed");
  } finally {
    running = false;
  }
}

export function startPortfolioAlertCron(): void {
  checkAllUsers();
  setInterval(checkAllUsers, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Portfolio alert cron started");
}
