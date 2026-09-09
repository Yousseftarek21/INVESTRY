import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, rentalRecordsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";

const router: IRouter = Router();

// Require a valid Clerk session for all rental-record routes
router.use("/rentals", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/rentals — fetch all logged rental payments for the current user
router.get("/rentals", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select()
      .from(rentalRecordsTable)
      .where(eq(rentalRecordsTable.userId, userId))
      .orderBy(rentalRecordsTable.createdAt);

    res.json(rows.map(r => ({ id: r.id, ...(decryptFromStorage(r.data) as object) })));
  } catch (err) {
    req.log.error({ err }, "GET /rentals failed");
    res.status(500).json({ error: "Failed to fetch rental records" });
  }
});

// POST /api/rentals — log a new rental payment
router.post("/rentals", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  if (!body.id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const { id, ...rest } = body;

  try {
    await db.insert(rentalRecordsTable).values({
      id: id as string,
      userId,
      data: encryptForStorage(rest),
    });

    res.status(201).json({ id, ...rest });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      res.status(409).json({ error: "A rental record with that ID already exists" });
      return;
    }
    req.log.error({ err }, "POST /rentals failed");
    res.status(500).json({ error: "Failed to log rental record" });
  }
});

// DELETE /api/rentals/:id
router.delete("/rentals/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;

  try {
    const deleted = await db
      .delete(rentalRecordsTable)
      .where(and(eq(rentalRecordsTable.id, id), eq(rentalRecordsTable.userId, userId)))
      .returning({ id: rentalRecordsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ deleted: id });
  } catch (err) {
    req.log.error({ err }, "DELETE /rentals/:id failed");
    res.status(500).json({ error: "Failed to delete rental record" });
  }
});

// PUT /api/rentals/:id
router.put("/rentals/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const { id: _bodyId, ...rest } = body;

  try {
    const updated = await db
      .update(rentalRecordsTable)
      .set({ data: encryptForStorage(rest), updatedAt: new Date() })
      .where(and(eq(rentalRecordsTable.id, id), eq(rentalRecordsTable.userId, userId)))
      .returning({ id: rentalRecordsTable.id });

    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ id, ...rest });
  } catch (err) {
    req.log.error({ err }, "PUT /rentals/:id failed");
    res.status(500).json({ error: "Failed to update rental record" });
  }
});

export default router;
