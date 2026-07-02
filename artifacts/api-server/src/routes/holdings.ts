import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, holdingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

// Require a valid Clerk session for all holdings routes
router.use(clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/holdings — fetch all holdings for the current user
router.get("/holdings", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select()
      .from(holdingsTable)
      .where(eq(holdingsTable.userId, userId))
      .orderBy(holdingsTable.createdAt);

    res.json(rows.map(r => ({ id: r.id, type: r.type, ...(r.data as object) })));
  } catch (err) {
    req.log.error({ err }, "GET /holdings failed");
    res.status(500).json({ error: "Failed to fetch holdings" });
  }
});

// POST /api/holdings — create a new holding
router.post("/holdings", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  if (!body.id || !body.type) {
    res.status(400).json({ error: "id and type are required" });
    return;
  }

  const { id, type, ...rest } = body;

  try {
    await db.insert(holdingsTable).values({
      id: id as string,
      userId,
      type: type as string,
      data: rest,
    });

    res.status(201).json({ id, type, ...rest });
  } catch (err: unknown) {
    // Unique-constraint violation on the primary key — the supplied ID already
    // exists. Return 409 so the caller can regenerate an ID rather than
    // silently overwriting a row that may belong to a different user.
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      res.status(409).json({ error: "A holding with that ID already exists" });
      return;
    }
    req.log.error({ err }, "POST /holdings failed");
    res.status(500).json({ error: "Failed to create holding" });
  }
});

// DELETE /api/holdings/:id — delete a holding
router.delete("/holdings/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;

  try {
    const deleted = await db
      .delete(holdingsTable)
      .where(and(eq(holdingsTable.id, id), eq(holdingsTable.userId, userId)))
      .returning({ id: holdingsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ deleted: id });
  } catch (err) {
    req.log.error({ err }, "DELETE /holdings/:id failed");
    res.status(500).json({ error: "Failed to delete holding" });
  }
});

// PUT /api/holdings/:id — update a holding
router.put("/holdings/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const { type, ...rest } = body;

  try {
    const updated = await db
      .update(holdingsTable)
      .set({ data: rest, type: type as string, updatedAt: new Date() })
      .where(and(eq(holdingsTable.id, id), eq(holdingsTable.userId, userId)))
      .returning({ id: holdingsTable.id });

    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ id, type, ...rest });
  } catch (err) {
    req.log.error({ err }, "PUT /holdings/:id failed");
    res.status(500).json({ error: "Failed to update holding" });
  }
});

export default router;
