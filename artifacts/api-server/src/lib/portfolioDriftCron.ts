import { eq } from "drizzle-orm";
import { db, usersTable, portfolioTargetsTable } from "@workspace/db";
import { computeUserPortfolioAllocation, type AllocationClass } from "./portfolioValue";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";

// Drift moves slowly (it's a function of the user's own trades and
// day-to-day price moves, not a fast-changing number), so this only needs
// to run a few times a day — unlike the ±1% portfolio cron, which re-checks
// every 30 minutes to catch a move as soon as it crosses a milestone.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Real-world rebalancing thresholds (robo-advisors typically use 5-10pp)
// land here — tight enough to be useful, loose enough that ordinary price
// wobble across gold/silver/stocks doesn't fire it every day.
const DRIFT_THRESHOLD_PP = 10;
// Once a class has been flagged, don't say it again for a week even if it's
// still drifted — the user has already seen the alert and can act on it;
// repeating it daily would just be noise.
const RENOTIFY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const CLASS_LABEL: Record<AllocationClass, string> = {
  gold: "gold",
  silver: "silver",
  stock: "stock",
  realEstate: "real estate",
  personalAsset: "personal assets",
  fixedIncome: "fixed income",
  cash: "cash",
};

interface TargetRow {
  userId: string;
  data: unknown;
  lastDriftAlertAt: Date | null;
  pushToken: string | null;
}

function parseTargets(data: unknown): Partial<Record<AllocationClass, number>> {
  if (!data || typeof data !== "object") return {};
  const out: Partial<Record<AllocationClass, number>> = {};
  for (const cls of Object.keys(CLASS_LABEL) as AllocationClass[]) {
    const v = (data as Record<string, unknown>)[cls];
    if (typeof v === "number" && v > 0) out[cls] = v;
  }
  return out;
}

async function checkUser(row: TargetRow): Promise<void> {
  if (!row.pushToken) return;
  if (row.lastDriftAlertAt && Date.now() - row.lastDriftAlertAt.getTime() < RENOTIFY_COOLDOWN_MS) return;

  const targets = parseTargets(row.data);
  const classes = Object.keys(targets) as AllocationClass[];
  if (classes.length === 0) return; // nothing configured to compare against yet

  const { totalValue, byClass } = await computeUserPortfolioAllocation(row.userId);
  if (totalValue <= 0) return;

  let worstClass: AllocationClass | null = null;
  let worstDrift = 0;
  for (const cls of classes) {
    const currentPct = (byClass[cls] / totalValue) * 100;
    const drift = currentPct - (targets[cls] as number);
    if (Math.abs(drift) > Math.abs(worstDrift)) {
      worstDrift = drift;
      worstClass = cls;
    }
  }
  if (!worstClass || Math.abs(worstDrift) < DRIFT_THRESHOLD_PP) return;

  const currentPct = (byClass[worstClass] / totalValue) * 100;
  const targetPct = targets[worstClass] as number;
  const label = CLASS_LABEL[worstClass];
  const dir = worstDrift > 0 ? "above" : "below";

  await db
    .update(portfolioTargetsTable)
    .set({ lastDriftAlertAt: new Date() })
    .where(eq(portfolioTargetsTable.userId, row.userId));

  await sendPushToTokens(
    [row.pushToken],
    "Portfolio drifted from target",
    `Your ${label} allocation is ${currentPct.toFixed(0)}% — ${Math.abs(worstDrift).toFixed(0)}pp ${dir} your ${targetPct.toFixed(0)}% target`,
    { type: "drift_alert" },
  );
}

let running = false;

async function checkAllUsers(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const rows = await db
      .select({
        userId: portfolioTargetsTable.userId,
        data: portfolioTargetsTable.data,
        lastDriftAlertAt: portfolioTargetsTable.lastDriftAlertAt,
        pushToken: usersTable.pushToken,
      })
      .from(portfolioTargetsTable)
      .innerJoin(usersTable, eq(usersTable.id, portfolioTargetsTable.userId))
      .where(eq(portfolioTargetsTable.driftAlertsEnabled, true));

    for (const row of rows) {
      try {
        await checkUser(row);
      } catch (err) {
        logger.warn({ err, userId: row.userId }, "Drift alert check failed for user");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Portfolio drift cron run failed");
  } finally {
    running = false;
  }
}

export function startPortfolioDriftCron(): void {
  checkAllUsers();
  setInterval(checkAllUsers, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Portfolio drift cron started");
}
