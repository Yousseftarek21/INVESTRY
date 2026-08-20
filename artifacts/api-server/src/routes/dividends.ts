import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, dividendsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";

const router: IRouter = Router();

// Require a valid Clerk session for all dividend routes
router.use("/dividends", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/dividends — fetch all logged distributions for the current user
router.get("/dividends", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select()
      .from(dividendsTable)
      .where(eq(dividendsTable.userId, userId))
      .orderBy(dividendsTable.createdAt);

    res.json(rows.map(r => ({ id: r.id, ...(decryptFromStorage(r.data) as object) })));
  } catch (err) {
    req.log.error({ err }, "GET /dividends failed");
    res.status(500).json({ error: "Failed to fetch dividends" });
  }
});

// POST /api/dividends — log a new distribution
router.post("/dividends", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  if (!body.id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const { id, ...rest } = body;

  try {
    await db.insert(dividendsTable).values({
      id: id as string,
      userId,
      data: encryptForStorage(rest),
    });

    res.status(201).json({ id, ...rest });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      res.status(409).json({ error: "A dividend entry with that ID already exists" });
      return;
    }
    req.log.error({ err }, "POST /dividends failed");
    res.status(500).json({ error: "Failed to log dividend" });
  }
});

// DELETE /api/dividends/:id
router.delete("/dividends/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;

  try {
    const deleted = await db
      .delete(dividendsTable)
      .where(and(eq(dividendsTable.id, id), eq(dividendsTable.userId, userId)))
      .returning({ id: dividendsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ deleted: id });
  } catch (err) {
    req.log.error({ err }, "DELETE /dividends/:id failed");
    res.status(500).json({ error: "Failed to delete dividend" });
  }
});

// PUT /api/dividends/:id
router.put("/dividends/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const { id: _bodyId, ...rest } = body;

  try {
    const updated = await db
      .update(dividendsTable)
      .set({ data: encryptForStorage(rest), updatedAt: new Date() })
      .where(and(eq(dividendsTable.id, id), eq(dividendsTable.userId, userId)))
      .returning({ id: dividendsTable.id });

    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ id, ...rest });
  } catch (err) {
    req.log.error({ err }, "PUT /dividends/:id failed");
    res.status(500).json({ error: "Failed to update dividend" });
  }
});

export default router;
