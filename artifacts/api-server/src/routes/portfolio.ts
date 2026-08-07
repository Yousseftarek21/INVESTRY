import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, portfolioSnapshotsTable, portfolioTargetsTable } from "@workspace/db";
import { eq, gte } from "drizzle-orm";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";
import { cairoDateString } from "../lib/cairoDate";

const router: IRouter = Router();

// GET /api/portfolio/snapshots — this user's daily portfolio value history,
// written once per day by the portfolio alert cron. Durable, per-account
// history (survives app reinstalls and device changes), unlike the mobile
// client's local AsyncStorage-only snapshot cache which this backs up.
router.get("/portfolio/snapshots", clerkMiddleware(), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select({
        date: portfolioSnapshotsTable.date,
        totalValue: portfolioSnapshotsTable.totalValue,
        lastNotifiedMilestone: portfolioSnapshotsTable.lastNotifiedMilestone,
      })
      .from(portfolioSnapshotsTable)
      .where(eq(portfolioSnapshotsTable.userId, userId))
      .orderBy(portfolioSnapshotsTable.date);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "GET /portfolio/snapshots failed");
    res.status(500).json({ error: "Failed to fetch portfolio snapshots" });
  }
});

const CLASS_KEYS = ["gold", "silver", "stock", "realEstate", "personalAsset", "fixedIncome", "cash"] as const;

function generateTargetId(): string {
  return `pt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// GET /api/portfolio/targets — this user's target allocation percentages,
// used to render the Rebalancing card and to seed the target-allocation
// screen's form. { configured: false } means the user has never set one.
router.get("/portfolio/targets", clerkMiddleware(), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const [row] = await db
      .select()
      .from(portfolioTargetsTable)
      .where(eq(portfolioTargetsTable.userId, userId))
      .limit(1);

    if (!row) { res.json({ configured: false }); return; }

    res.json({
      configured: true,
      targets: decryptFromStorage(row.data),
      driftAlertsEnabled: row.driftAlertsEnabled,
    });
  } catch (err) {
    req.log.error({ err }, "GET /portfolio/targets failed");
    res.status(500).json({ error: "Failed to fetch portfolio targets" });
  }
});

// PUT /api/portfolio/targets — set/replace this user's target allocation.
// Percentages don't need to cover every class (a user who doesn't hold real
// estate can just leave it out) but must each be 0-100 and sum to 100% or
// less. portfolioDriftCron only compares classes actually present here.
router.put("/portfolio/targets", clerkMiddleware(), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  const targets = body.targets as Record<string, unknown> | undefined;
  const driftAlertsEnabled = body.driftAlertsEnabled;

  if (!targets || typeof targets !== "object") {
    res.status(400).json({ error: "targets is required" });
    return;
  }
  if (driftAlertsEnabled !== undefined && typeof driftAlertsEnabled !== "boolean") {
    res.status(400).json({ error: "driftAlertsEnabled must be a boolean" });
    return;
  }

  const clean: Record<string, number> = {};
  let sum = 0;
  for (const key of CLASS_KEYS) {
    const v = targets[key];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) {
      res.status(400).json({ error: `${key} must be a number between 0 and 100` });
      return;
    }
    clean[key] = v;
    sum += v;
  }
  if (Object.keys(clean).length === 0) {
    res.status(400).json({ error: "at least one target is required" });
    return;
  }
  if (sum > 100.5) {
    res.status(400).json({ error: "targets must sum to 100% or less" });
    return;
  }

  try {
    await db
      .insert(portfolioTargetsTable)
      .values({
        id: generateTargetId(),
        userId,
        data: encryptForStorage(clean),
        driftAlertsEnabled: driftAlertsEnabled ?? true,
      })
      .onConflictDoUpdate({
        target: portfolioTargetsTable.userId,
        set: {
          data: encryptForStorage(clean),
          ...(driftAlertsEnabled !== undefined ? { driftAlertsEnabled } : {}),
          updatedAt: new Date(),
        },
      });

    res.json({ success: true, targets: clean });
  } catch (err) {
    req.log.error({ err }, "PUT /portfolio/targets failed");
    res.status(500).json({ error: "Failed to save portfolio targets" });
  }
});

const BENCHMARK_MIN_SAMPLE = 5;
// A month-over-month swing past this is almost certainly a new
// deposit/withdrawal skewing the number, not real investment performance —
// same reasoning as portfolioAlertCron's daily SANITY_MAX_PCT, just widened
// for a monthly window.
const BENCHMARK_SANITY_MAX_PCT = 50;

function monthPctChange(rows: { date: string; totalValue: number }[]): number | null {
  if (rows.length < 2) return null;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].totalValue;
  const last = sorted[sorted.length - 1].totalValue;
  if (first <= 0) return null;
  const pct = ((last - first) / first) * 100;
  if (Math.abs(pct) > BENCHMARK_SANITY_MAX_PCT) return null;
  return pct;
}

// GET /api/portfolio/benchmark — this user's month-to-date portfolio %
// change vs. the average of every other user with enough history this
// month. Built from portfolio_snapshots (already written daily for every
// user by portfolioAlertCron, regardless of push settings). Returns
// { available: false } rather than a number built from too few peers —
// showing "the average user is up 1.8%" from 2 other accounts would be a
// fabricated-looking statistic, not a real one.
router.get("/portfolio/benchmark", clerkMiddleware(), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const now = new Date();
    const startOfMonth = cairoDateString(new Date(now.getFullYear(), now.getMonth(), 1));

    const rows = await db
      .select({
        userId: portfolioSnapshotsTable.userId,
        date: portfolioSnapshotsTable.date,
        totalValue: portfolioSnapshotsTable.totalValue,
      })
      .from(portfolioSnapshotsTable)
      .where(gte(portfolioSnapshotsTable.date, startOfMonth));

    const byUser = new Map<string, { date: string; totalValue: number }[]>();
    for (const r of rows) {
      const list = byUser.get(r.userId) ?? [];
      list.push({ date: r.date, totalValue: r.totalValue });
      byUser.set(r.userId, list);
    }

    const userPctChange = monthPctChange(byUser.get(userId) ?? []);

    const othersPct: number[] = [];
    for (const [uid, list] of byUser) {
      if (uid === userId) continue;
      const pct = monthPctChange(list);
      if (pct !== null) othersPct.push(pct);
    }

    if (userPctChange === null || othersPct.length < BENCHMARK_MIN_SAMPLE) {
      res.json({ available: false });
      return;
    }

    const averagePctChange = othersPct.reduce((a, b) => a + b, 0) / othersPct.length;
    res.json({
      available: true,
      period: "month",
      userPctChange: Math.round(userPctChange * 10) / 10,
      averagePctChange: Math.round(averagePctChange * 10) / 10,
      sampleSize: othersPct.length,
    });
  } catch (err) {
    req.log.error({ err }, "GET /portfolio/benchmark failed");
    res.status(500).json({ error: "Failed to compute portfolio benchmark" });
  }
});

export default router;
