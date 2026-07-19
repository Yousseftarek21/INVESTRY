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

export default router;
