import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, goalsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";

const router: IRouter = Router();

// Require a valid Clerk session for all goals routes
router.use("/goals", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/goals — fetch all goals for the current user
router.get("/goals", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select()
      .from(goalsTable)
      .where(eq(goalsTable.userId, userId))
      .orderBy(goalsTable.createdAt);

    res.json(rows.map(r => ({ id: r.id, ...(decryptFromStorage(r.data) as object) })));
  } catch (err) {
    req.log.error({ err }, "GET /goals failed");
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

// POST /api/goals — create a new goal
router.post("/goals", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  if (!body.id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const { id, ...rest } = body;

  try {
    await db.insert(goalsTable).values({
      id: id as string,
      userId,
      data: encryptForStorage(rest),
    });

    res.status(201).json({ id, ...rest });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      res.status(409).json({ error: "A goal with that ID already exists" });
      return;
    }
    req.log.error({ err }, "POST /goals failed");
    res.status(500).json({ error: "Failed to create goal" });
  }
});

// DELETE /api/goals/:id — delete a goal
router.delete("/goals/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;

  try {
    const deleted = await db
      .delete(goalsTable)
      .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)))
      .returning({ id: goalsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ deleted: id });
  } catch (err) {
    req.log.error({ err }, "DELETE /goals/:id failed");
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

// PUT /api/goals/:id — update a goal
router.put("/goals/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const { id: _bodyId, ...rest } = body;

  try {
    const updated = await db
      .update(goalsTable)
      .set({ data: encryptForStorage(rest), updatedAt: new Date() })
      .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)))
      .returning({ id: goalsTable.id });

    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ id, ...rest });
  } catch (err) {
    req.log.error({ err }, "PUT /goals/:id failed");
    res.status(500).json({ error: "Failed to update goal" });
  }
});

export default router;
