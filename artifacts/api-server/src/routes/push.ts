import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Require a valid Clerk session
router.use("/push", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// POST /api/push/register — save the current device's Expo push token
router.post("/push/register", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const token = (req.body as Record<string, unknown>)?.token;
  if (typeof token !== "string" || !token.trim()) {
    res.status(400).json({ error: "token is required" });
    return;
  }

  try {
    await db
      .insert(usersTable)
      .values({ id: userId, pushToken: token })
      .onConflictDoUpdate({ target: usersTable.id, set: { pushToken: token, updatedAt: new Date() } });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "POST /push/register failed");
    res.status(500).json({ error: "Failed to save push token" });
  }
});

// PUT /api/push/preferences — toggle server-sent notification categories.
// portfolioAlertsEnabled gates the daily ±1% portfolio-value push (see
// lib/portfolioAlertCron.ts); priceAlertsEnabled gates custom target-price
// pushes (see lib/userPriceAlertCron.ts); activityAlertsEnabled gates the
// "you just added/edited X" push (see routes/activity.ts);
// dailySummaryEnabled/weeklySummaryEnabled gate the morning/weekly recap push
// (see lib/dailySummaryCron.ts). All optional so any one can be updated
// independently.
router.put("/push/preferences", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  const {
    portfolioAlertsEnabled, priceAlertsEnabled, activityAlertsEnabled,
    dailySummaryEnabled, weeklySummaryEnabled,
  } = body;
  const bools = { portfolioAlertsEnabled, priceAlertsEnabled, activityAlertsEnabled, dailySummaryEnabled, weeklySummaryEnabled };
  for (const [key, val] of Object.entries(bools)) {
    if (val !== undefined && typeof val !== "boolean") {
      res.status(400).json({ error: `${key} must be a boolean` });
      return;
    }
  }
  if (Object.values(bools).every(v => v === undefined)) {
    res.status(400).json({ error: "at least one preference is required" });
    return;
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (portfolioAlertsEnabled !== undefined) set.portfolioAlertsEnabled = portfolioAlertsEnabled;
  if (priceAlertsEnabled !== undefined) set.priceAlertsEnabled = priceAlertsEnabled;
  if (activityAlertsEnabled !== undefined) set.activityAlertsEnabled = activityAlertsEnabled;
  if (dailySummaryEnabled !== undefined) set.dailySummaryEnabled = dailySummaryEnabled;
  if (weeklySummaryEnabled !== undefined) set.weeklySummaryEnabled = weeklySummaryEnabled;

  try {
    await db
      .insert(usersTable)
      .values({ id: userId, ...set })
      .onConflictDoUpdate({ target: usersTable.id, set });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "PUT /push/preferences failed");
    res.status(500).json({ error: "Failed to save preference" });
  }
});

export default router;
