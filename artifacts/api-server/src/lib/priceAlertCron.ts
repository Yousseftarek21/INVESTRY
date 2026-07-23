import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db, usersTable, metalAlertStateTable } from "@workspace/db";
import { fetchPrices } from "../routes/markets";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";

// Broadcasts a push to every registered device whenever gold or silver's
// "today" change crosses a new whole-percent milestone (1%, 2%, 3%, ...),
// so users get updated as the move keeps growing rather than just once.
// Resets automatically when the change returns to 0 (metals market closed,
// see isMetalsMarketOpen in markets.ts, or a new session starting fresh).

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const STATE_ID = "singleton";

async function ensureStateRow(): Promise<void> {
  await db.insert(metalAlertStateTable).values({ id: STATE_ID }).onConflictDoNothing();
}

async function getAllPushTokens(): Promise<string[]> {
  const rows = await db
    .select({ pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(isNotNull(usersTable.pushToken));
  return rows.map(r => r.pushToken).filter((t): t is string => !!t);
}

/**
 * Checks one metal against its last-notified milestone and sends a push if
 * a new one was crossed. The advance itself is an atomic conditional
 * UPDATE (only succeeds if the stored value is still below the new
 * milestone) rather than a separate read-then-write — closes a race where
 * two server processes running this check at nearly the same instant
 * (e.g. during a rolling deploy's brief old/new overlap window) could
 * otherwise both read "not yet notified" and both send a push for the
 * same crossing, which is exactly what happened right after the previous
 * fix deployed.
 */
async function checkMetal(
  pct: number,
  label: "Gold" | "Silver",
  column: typeof metalAlertStateTable.lastGoldMilestone | typeof metalAlertStateTable.lastSilverMilestone,
): Promise<void> {
  if (pct === 0) {
    await db.update(metalAlertStateTable).set({ [label === "Gold" ? "lastGoldMilestone" : "lastSilverMilestone"]: 0, updatedAt: new Date() }).where(eq(metalAlertStateTable.id, STATE_ID));
    return;
  }
  const milestone = Math.floor(Math.abs(pct));
  if (milestone < 1) return;

  const setValues = label === "Gold"
    ? { lastGoldMilestone: milestone, updatedAt: new Date() }
    : { lastSilverMilestone: milestone, updatedAt: new Date() };

  const updated = await db
    .update(metalAlertStateTable)
    .set(setValues)
    .where(and(eq(metalAlertStateTable.id, STATE_ID), lt(column, milestone)))
    .returning({ id: metalAlertStateTable.id });

  if (updated.length === 0) return; // another process already advanced this milestone

  const tokens = await getAllPushTokens();
  if (tokens.length === 0) return;
  const dir = pct > 0 ? "up" : "down";
  await sendPushToTokens(
    tokens,
    `${label} price alert`,
    `${label} is ${dir} ${Math.abs(pct).toFixed(1)}% today`,
    { type: "price_alert", asset: label.toLowerCase() },
  );
}

async function checkAndNotify() {
  try {
    await ensureStateRow();
    const prices = await fetchPrices();
    await Promise.all([
      checkMetal(prices.goldChangePercent, "Gold", metalAlertStateTable.lastGoldMilestone),
      checkMetal(prices.silverChangePercent, "Silver", metalAlertStateTable.lastSilverMilestone),
    ]);
  } catch (err) {
    logger.warn({ err }, "Price alert cron check failed");
  }
}

export function startPriceAlertCron(): void {
  checkAndNotify();
  setInterval(checkAndNotify, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Price alert cron started");
}
