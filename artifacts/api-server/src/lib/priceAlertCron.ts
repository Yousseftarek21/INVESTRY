import { eq, isNotNull } from "drizzle-orm";
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

// Persisted in the DB, not held in memory — an in-memory counter resets to
// 0 on every server restart (deploy, crash, autoscale), which re-fires a
// "duplicate" notification for a milestone that was already sent before
// the restart. This survives restarts, so each milestone notifies once.
async function getState(): Promise<{ lastGoldMilestone: number; lastSilverMilestone: number }> {
  const [row] = await db
    .select({ lastGoldMilestone: metalAlertStateTable.lastGoldMilestone, lastSilverMilestone: metalAlertStateTable.lastSilverMilestone })
    .from(metalAlertStateTable)
    .where(eq(metalAlertStateTable.id, STATE_ID))
    .limit(1);
  if (row) return row;
  await db.insert(metalAlertStateTable).values({ id: STATE_ID }).onConflictDoNothing();
  return { lastGoldMilestone: 0, lastSilverMilestone: 0 };
}

async function getAllPushTokens(): Promise<string[]> {
  const rows = await db
    .select({ pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(isNotNull(usersTable.pushToken));
  return rows.map(r => r.pushToken).filter((t): t is string => !!t);
}

/** Checks one metal against its last-notified milestone, sends a push if a
 *  new one was crossed, and returns the milestone value to persist. */
async function checkMetal(pct: number, label: string, last: number): Promise<number> {
  if (pct === 0) return 0;
  const milestone = Math.floor(Math.abs(pct));
  if (milestone < 1 || milestone <= last) return last;

  const tokens = await getAllPushTokens();
  if (tokens.length > 0) {
    const dir = pct > 0 ? "up" : "down";
    await sendPushToTokens(
      tokens,
      `${label} price alert`,
      `${label} is ${dir} ${Math.abs(pct).toFixed(1)}% today`,
      { type: "price_alert", asset: label.toLowerCase() },
    );
  }
  return milestone;
}

async function checkAndNotify() {
  try {
    const [prices, state] = await Promise.all([fetchPrices(), getState()]);
    const [newGold, newSilver] = await Promise.all([
      checkMetal(prices.goldChangePercent, "Gold", state.lastGoldMilestone),
      checkMetal(prices.silverChangePercent, "Silver", state.lastSilverMilestone),
    ]);

    if (newGold !== state.lastGoldMilestone || newSilver !== state.lastSilverMilestone) {
      await db
        .update(metalAlertStateTable)
        .set({ lastGoldMilestone: newGold, lastSilverMilestone: newSilver, updatedAt: new Date() })
        .where(eq(metalAlertStateTable.id, STATE_ID));
    }
  } catch (err) {
    logger.warn({ err }, "Price alert cron check failed");
  }
}

export function startPriceAlertCron(): void {
  checkAndNotify();
  setInterval(checkAndNotify, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Price alert cron started");
}
