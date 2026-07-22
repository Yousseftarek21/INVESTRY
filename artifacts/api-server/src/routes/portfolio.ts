import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, portfolioSnapshotsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
        notified: portfolioSnapshotsTable.notified,
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

export default router;
