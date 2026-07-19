import { isNotNull } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { fetchPrices } from "../routes/markets";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";

// Broadcasts a push to every registered device whenever gold or silver's
// "today" change crosses a new whole-percent milestone (1%, 2%, 3%, ...),
// so users get updated as the move keeps growing rather than just once.
// Resets automatically when the change returns to 0 (metals market closed,
// see isMetalsMarketOpen in markets.ts, or a new session starting fresh).

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let lastGoldMilestone = 0;
let lastSilverMilestone = 0;

async function getAllPushTokens(): Promise<string[]> {
  const rows = await db
    .select({ pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(isNotNull(usersTable.pushToken));
  return rows.map(r => r.pushToken).filter((t): t is string => !!t);
}

async function checkMetal(pct: number, label: string, getLast: () => number, setLast: (v: number) => void) {
  if (pct === 0) {
    setLast(0);
    return;
  }
  const milestone = Math.floor(Math.abs(pct));
  if (milestone < 1 || milestone <= getLast()) return;

  setLast(milestone);
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
    const prices = await fetchPrices();
    await checkMetal(prices.goldChangePercent, "Gold", () => lastGoldMilestone, v => { lastGoldMilestone = v; });
    await checkMetal(prices.silverChangePercent, "Silver", () => lastSilverMilestone, v => { lastSilverMilestone = v; });
  } catch (err) {
    logger.warn({ err }, "Price alert cron check failed");
  }
}

export function startPriceAlertCron(): void {
  checkAndNotify();
  setInterval(checkAndNotify, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Price alert cron started");
}
