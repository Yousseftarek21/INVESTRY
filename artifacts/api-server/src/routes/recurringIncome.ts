import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, recurringIncomeTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";

const router: IRouter = Router();

// Require a valid Clerk session for all recurring income routes
router.use("/recurring-income", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/recurring-income — fetch all recurring income entries for the current user
router.get("/recurring-income", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select()
      .from(recurringIncomeTable)
      .where(eq(recurringIncomeTable.userId, userId))
      .orderBy(recurringIncomeTable.createdAt);

    res.json(rows.map(r => ({ id: r.id, ...(decryptFromStorage(r.data) as object) })));
  } catch (err) {
    req.log.error({ err }, "GET /recurring-income failed");
    res.status(500).json({ error: "Failed to fetch recurring income" });
  }
});

// POST /api/recurring-income — create a new recurring income entry
router.post("/recurring-income", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  if (!body.id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const { id, ...rest } = body;

  try {
    await db.insert(recurringIncomeTable).values({
      id: id as string,
      userId,
      data: encryptForStorage(rest),
    });

    res.status(201).json({ id, ...rest });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      res.status(409).json({ error: "A recurring income entry with that ID already exists" });
      return;
    }
    req.log.error({ err }, "POST /recurring-income failed");
    res.status(500).json({ error: "Failed to create recurring income entry" });
  }
});

// DELETE /api/recurring-income/:id
router.delete("/recurring-income/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;

  try {
    const deleted = await db
      .delete(recurringIncomeTable)
      .where(and(eq(recurringIncomeTable.id, id), eq(recurringIncomeTable.userId, userId)))
      .returning({ id: recurringIncomeTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ deleted: id });
  } catch (err) {
    req.log.error({ err }, "DELETE /recurring-income/:id failed");
    res.status(500).json({ error: "Failed to delete recurring income entry" });
  }
});

// PUT /api/recurring-income/:id
router.put("/recurring-income/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const { id: _bodyId, ...rest } = body;

  try {
    const updated = await db
      .update(recurringIncomeTable)
      .set({ data: encryptForStorage(rest), updatedAt: new Date() })
      .where(and(eq(recurringIncomeTable.id, id), eq(recurringIncomeTable.userId, userId)))
      .returning({ id: recurringIncomeTable.id });

    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ id, ...rest });
  } catch (err) {
    req.log.error({ err }, "PUT /recurring-income/:id failed");
    res.status(500).json({ error: "Failed to update recurring income entry" });
  }
});

export default router;
