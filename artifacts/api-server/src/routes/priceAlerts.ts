import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, priceAlertsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";

const router: IRouter = Router();

// Require a valid Clerk session for all price-alerts routes
router.use("/price-alerts", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/price-alerts — fetch all price alerts for the current user
router.get("/price-alerts", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select()
      .from(priceAlertsTable)
      .where(eq(priceAlertsTable.userId, userId))
      .orderBy(priceAlertsTable.createdAt);

    res.json(rows.map(r => ({ id: r.id, ...(decryptFromStorage(r.data) as object) })));
  } catch (err) {
    req.log.error({ err }, "GET /price-alerts failed");
    res.status(500).json({ error: "Failed to fetch price alerts" });
  }
});

// POST /api/price-alerts — create a new price alert
router.post("/price-alerts", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  if (!body.id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const { id, ...rest } = body;

  try {
    await db.insert(priceAlertsTable).values({
      id: id as string,
      userId,
      data: encryptForStorage(rest),
    });

    res.status(201).json({ id, ...rest });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      res.status(409).json({ error: "A price alert with that ID already exists" });
      return;
    }
    req.log.error({ err }, "POST /price-alerts failed");
    res.status(500).json({ error: "Failed to create price alert" });
  }
});

// DELETE /api/price-alerts/:id — delete a price alert
router.delete("/price-alerts/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;

  try {
    const deleted = await db
      .delete(priceAlertsTable)
      .where(and(eq(priceAlertsTable.id, id), eq(priceAlertsTable.userId, userId)))
      .returning({ id: priceAlertsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ deleted: id });
  } catch (err) {
    req.log.error({ err }, "DELETE /price-alerts/:id failed");
    res.status(500).json({ error: "Failed to delete price alert" });
  }
});

// PUT /api/price-alerts/:id — update a price alert
router.put("/price-alerts/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const { id: _bodyId, ...rest } = body;

  try {
    const updated = await db
      .update(priceAlertsTable)
      .set({ data: encryptForStorage(rest), updatedAt: new Date() })
      .where(and(eq(priceAlertsTable.id, id), eq(priceAlertsTable.userId, userId)))
      .returning({ id: priceAlertsTable.id });

    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ id, ...rest });
  } catch (err) {
    req.log.error({ err }, "PUT /price-alerts/:id failed");
    res.status(500).json({ error: "Failed to update price alert" });
  }
});

export default router;
