import { eq, isNotNull } from "drizzle-orm";
import { db, usersTable, priceAlertsTable } from "@workspace/db";
import { fetchPrices, fetchStocks } from "../routes/markets";
import { goldPricePerGram, silverPricePerGram } from "./portfolioValue";
import { encryptForStorage, decryptFromStorage } from "./encryption";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";

// Checks every user's own custom price alerts (set via the mobile
// price-alerts screen) against live prices and pushes when crossed — this
// is what makes those alerts fire while the app is closed or backgrounded,
// not just while it happens to be open in the foreground.
//
// 30s matches fetchPrices()/fetchStocks()'s own cache TTL (see markets.ts),
// so checking this often costs no extra upstream calls to TradingView/
// Yahoo beyond what's already being made for other routes — polling any
// faster than the cache TTL would start hammering those free endpoints on
// every tick instead of reusing the cached response.
const CHECK_INTERVAL_MS = 30 * 1000;

interface StoredPriceAlert {
  assetKey: string;
  assetLabel: string;
  targetPrice: number;
  direction: "above" | "below";
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
  [key: string]: unknown;
}

async function buildPricesDict(): Promise<Record<string, number>> {
  const [prices, stocks] = await Promise.all([
    fetchPrices(),
    fetchStocks().catch(() => []),
  ]);

  const dict: Record<string, number> = {
    usd_egp: prices.usdToEgp,
    gold_24k: goldPricePerGram(prices.goldUsd, prices.usdToEgp, "24k"),
    gold_22k: goldPricePerGram(prices.goldUsd, prices.usdToEgp, "22k"),
    gold_21k: goldPricePerGram(prices.goldUsd, prices.usdToEgp, "21k"),
    gold_18k: goldPricePerGram(prices.goldUsd, prices.usdToEgp, "18k"),
    silver_gram: silverPricePerGram(prices.silverUsd, prices.usdToEgp),
  };
  for (const s of stocks) dict[`stock_${s.symbol}`] = s.price;
  return dict;
}

let running = false;

async function checkAllAlerts(): Promise<void> {
  if (running) return; // guard against overlap if a prior run is still in flight
  running = true;
  try {
    const [priceDict, alertRows, users] = await Promise.all([
      buildPricesDict(),
      db.select().from(priceAlertsTable),
      db.select({ id: usersTable.id, pushToken: usersTable.pushToken, enabled: usersTable.priceAlertsEnabled }).from(usersTable).where(isNotNull(usersTable.pushToken)),
    ]);

    const tokenByUser = new Map(users.filter(u => u.enabled).map(u => [u.id, u.pushToken as string]));

    for (const row of alertRows) {
      try {
        // Left un-evaluated (not marked triggered) while disabled — a real
        // price cross while the user has this off should still fire once
        // they turn it back on, not get silently swallowed forever.
        if (!tokenByUser.has(row.userId)) continue;

        const alert = decryptFromStorage(row.data) as StoredPriceAlert;
        if (alert.triggered) continue;

        const current = priceDict[alert.assetKey];
        if (current == null) continue;

        const crossed =
          (alert.direction === "above" && current >= alert.targetPrice) ||
          (alert.direction === "below" && current <= alert.targetPrice);
        if (!crossed) continue;

        const token = tokenByUser.get(row.userId);
        if (token) {
          await sendPushToTokens(
            [token],
            alert.assetLabel,
            `${alert.direction === "above" ? "↑" : "↓"} Target ${alert.targetPrice.toLocaleString("en-EG", { maximumFractionDigits: 2 })} EGP reached`,
            { type: "price_alert", assetKey: alert.assetKey },
          );
        }

        await db
          .update(priceAlertsTable)
          .set({
            data: encryptForStorage({ ...alert, triggered: true, triggeredAt: new Date().toISOString() }),
            updatedAt: new Date(),
          })
          .where(eq(priceAlertsTable.id, row.id));
      } catch (err) {
        logger.warn({ err, alertId: row.id }, "Price alert check failed");
      }
    }
  } catch (err) {
    logger.warn({ err }, "User price alert cron run failed");
  } finally {
    running = false;
  }
}

export function startUserPriceAlertCron(): void {
  checkAllAlerts();
  setInterval(checkAllAlerts, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "User price alert cron started");
}
