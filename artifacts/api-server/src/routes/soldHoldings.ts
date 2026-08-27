import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, soldHoldingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { decryptFromStorage } from "../lib/encryption";

const router: IRouter = Router();

router.use("/sold-holdings", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/sold-holdings — this user's realized-sale history, newest first.
// Records are created by POST /api/holdings/:id/sell, which is where a
// holding actually leaves the active holdings table.
//
// DELETE /api/holdings/:id also writes a row here now (isDeletionRecord:
// true) so a deleted gold/silver/stock position still counts toward the
// leaderboard the same way selling it would — see that route's own comment.
// Those rows are filtered out here: they're internal accounting, not a real
// sale, and showing one would mean a fabricated "Sold: ..." transaction for
// something the user only ever deleted, never sold.
router.get("/sold-holdings", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select()
      .from(soldHoldingsTable)
      .where(eq(soldHoldingsTable.userId, userId))
      .orderBy(desc(soldHoldingsTable.createdAt));

    const sold = rows
      .map(r => ({ id: r.id, ...(decryptFromStorage(r.data) as { isDeletionRecord?: boolean }) }))
      .filter(r => !r.isDeletionRecord);
    res.json(sold);
  } catch (err) {
    req.log.error({ err }, "GET /sold-holdings failed");
    res.status(500).json({ error: "Failed to fetch sold holdings" });
  }
});

export default router;
