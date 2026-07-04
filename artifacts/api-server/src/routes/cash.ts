import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, cashAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

// Require a valid Clerk session for all cash account routes
router.use("/cash-accounts", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/cash-accounts — fetch all cash accounts for the current user
router.get("/cash-accounts", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select()
      .from(cashAccountsTable)
      .where(eq(cashAccountsTable.userId, userId))
      .orderBy(cashAccountsTable.createdAt);

    res.json(rows.map(r => ({ id: r.id, type: r.type, ...(r.data as object) })));
  } catch (err) {
    req.log.error({ err }, "GET /cash-accounts failed");
    res.status(500).json({ error: "Failed to fetch cash accounts" });
  }
});

// POST /api/cash-accounts — create a new cash account
router.post("/cash-accounts", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  if (!body.id || !body.type) {
    res.status(400).json({ error: "id and type are required" });
    return;
  }

  const { id, type, ...rest } = body;

  try {
    await db.insert(cashAccountsTable).values({
      id: id as string,
      userId,
      type: type as string,
      data: rest,
    });

    res.status(201).json({ id, type, ...rest });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      res.status(409).json({ error: "A cash account with that ID already exists" });
      return;
    }
    req.log.error({ err }, "POST /cash-accounts failed");
    res.status(500).json({ error: "Failed to create cash account" });
  }
});

// DELETE /api/cash-accounts/:id — delete a cash account
router.delete("/cash-accounts/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;

  try {
    const deleted = await db
      .delete(cashAccountsTable)
      .where(and(eq(cashAccountsTable.id, id), eq(cashAccountsTable.userId, userId)))
      .returning({ id: cashAccountsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ deleted: id });
  } catch (err) {
    req.log.error({ err }, "DELETE /cash-accounts/:id failed");
    res.status(500).json({ error: "Failed to delete cash account" });
  }
});

// PUT /api/cash-accounts/:id — update a cash account
router.put("/cash-accounts/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const { type, ...rest } = body;

  try {
    const updated = await db
      .update(cashAccountsTable)
      .set({ data: rest, type: type as string, updatedAt: new Date() })
      .where(and(eq(cashAccountsTable.id, id), eq(cashAccountsTable.userId, userId)))
      .returning({ id: cashAccountsTable.id });

    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ id, type, ...rest });
  } catch (err) {
    req.log.error({ err }, "PUT /cash-accounts/:id failed");
    res.status(500).json({ error: "Failed to update cash account" });
  }
});

export default router;
