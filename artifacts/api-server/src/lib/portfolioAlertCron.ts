import { and, desc, eq, lt } from "drizzle-orm";
import { db, usersTable, portfolioSnapshotsTable } from "@workspace/db";
import { computeUserPortfolioValue } from "./portfolioValue";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";

// Checked every 30 minutes, but each user is only actually evaluated once
// per Africa/Cairo calendar day — the portfolio_snapshots unique(user_id,
// date) row is what makes every later check that day a cheap no-op, so
// there's no need for this to be scheduled at a precise midnight instant.
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const CHANGE_THRESHOLD_PCT = 1;

function cairoDateString(): string {
  // en-CA gives YYYY-MM-DD directly.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}

function generateId(): string {
  return `snap_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
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
  // `notified` here, which is the atomic gate for the push send below.
  await db
    .insert(portfolioSnapshotsTable)
    .values({ id: generateId(), userId, date: today, totalValue, notified: false })
    .onConflictDoUpdate({
      target: [portfolioSnapshotsTable.userId, portfolioSnapshotsTable.date],
      set: { totalValue },
    });

  if (!pushToken) return;

  const [prior] = await db
    .select({ totalValue: portfolioSnapshotsTable.totalValue })
    .from(portfolioSnapshotsTable)
    .where(and(eq(portfolioSnapshotsTable.userId, userId), lt(portfolioSnapshotsTable.date, today)))
    .orderBy(desc(portfolioSnapshotsTable.date))
    .limit(1);
  if (!prior || prior.totalValue <= 0) return;

  const pctChange = ((totalValue - prior.totalValue) / prior.totalValue) * 100;
  if (Math.abs(pctChange) < CHANGE_THRESHOLD_PCT) return;

  // Atomic compare-and-swap: only the process whose UPDATE actually flips
  // notified false->true sends the push — closes a multi-process race
  // (e.g. a rolling deploy's brief old/new instance overlap) where two
  // processes could otherwise both read "not yet notified" and both send.
  const updated = await db
    .update(portfolioSnapshotsTable)
    .set({ notified: true })
    .where(and(
      eq(portfolioSnapshotsTable.userId, userId),
      eq(portfolioSnapshotsTable.date, today),
      eq(portfolioSnapshotsTable.notified, false),
    ))
    .returning({ id: portfolioSnapshotsTable.id });

  if (updated.length === 0) return; // already notified today (this check or a concurrent one)

  const dir = pctChange > 0 ? "up" : "down";
  await sendPushToTokens(
    [pushToken],
    "Portfolio update",
    `Your portfolio is ${dir} ${Math.abs(pctChange).toFixed(1)}% today`,
    { type: "portfolio_alert" },
  );
}

let running = false;

async function checkAllUsers(): Promise<void> {
  if (running) return; // guard against overlap if a prior run is still in flight
  running = true;
  try {
    const today = cairoDateString();
    const users = await db
      .select({ id: usersTable.id, pushToken: usersTable.pushToken, alertsEnabled: usersTable.portfolioAlertsEnabled })
      .from(usersTable);

    for (const u of users) {
      try {
        await checkUser(u.id, today, u.alertsEnabled ? u.pushToken : null);
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
