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
// Currently just portfolioAlertsEnabled, which gates the daily ±1%
// portfolio-value push (see lib/portfolioAlertCron.ts).
router.put("/push/preferences", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const portfolioAlertsEnabled = (req.body as Record<string, unknown>)?.portfolioAlertsEnabled;
  if (typeof portfolioAlertsEnabled !== "boolean") {
    res.status(400).json({ error: "portfolioAlertsEnabled must be a boolean" });
    return;
  }

  try {
    await db
      .insert(usersTable)
      .values({ id: userId, portfolioAlertsEnabled })
      .onConflictDoUpdate({ target: usersTable.id, set: { portfolioAlertsEnabled, updatedAt: new Date() } });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "PUT /push/preferences failed");
    res.status(500).json({ error: "Failed to save preference" });
  }
});

export default router;
