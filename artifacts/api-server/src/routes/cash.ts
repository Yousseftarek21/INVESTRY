import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, cashAccountsTable, cashBalanceUpdatesTable, activityLogTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";
import { cairoDateString } from "../lib/cairoDate";

function generateUpdateId(): string {
  return `cbu_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

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

    res.json(rows.map(r => ({ id: r.id, type: r.type, ...(decryptFromStorage(r.data) as object) })));
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
      data: encryptForStorage(rest),
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

    // Clean up this account's own notification history — otherwise a
    // deleted account's old "New cash account" / "updated" entries keep
    // showing in the bell forever, for something that no longer exists.
    await db
      .delete(activityLogTable)
      .where(and(eq(activityLogTable.userId, userId), eq(activityLogTable.entityId, id)));

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
      .set({ data: encryptForStorage(rest), type: type as string, updatedAt: new Date() })
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

// GET /api/cash-accounts/:id/balance-updates — this account's manual balance
// change history (not a transaction/expense ledger — just delta + resulting
// balance + when), most recent first.
router.get("/cash-accounts/:id/balance-updates", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params;

  try {
    const rows = await db
      .select({
        id: cashBalanceUpdatesTable.id,
        delta: cashBalanceUpdatesTable.delta,
        resultingBalance: cashBalanceUpdatesTable.resultingBalance,
        createdAt: cashBalanceUpdatesTable.createdAt,
      })
      .from(cashBalanceUpdatesTable)
      .where(and(eq(cashBalanceUpdatesTable.userId, userId), eq(cashBalanceUpdatesTable.cashAccountId, id)))
      .orderBy(desc(cashBalanceUpdatesTable.createdAt))
      .limit(20);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "GET /cash-accounts/:id/balance-updates failed");
    res.status(500).json({ error: "Failed to fetch balance updates" });
  }
});

// POST /api/cash-accounts/:id/balance-updates — log a manual balance change.
// The client computes delta/resultingBalance itself (it already has the old
// and new balance at the moment of editing) — this just records it. Only
// verifies the account belongs to this user; doesn't recompute or validate
// the math server-side, same trust boundary as the account's own balance
// field (client-authored, like every other holding/cash field in this app).
router.post("/cash-accounts/:id/balance-updates", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params;

  const body = req.body as Record<string, unknown>;
  const delta = body.delta;
  const resultingBalance = body.resultingBalance;
  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    res.status(400).json({ error: "delta must be a finite number" });
    return;
  }
  if (typeof resultingBalance !== "number" || !Number.isFinite(resultingBalance)) {
    res.status(400).json({ error: "resultingBalance must be a finite number" });
    return;
  }

  try {
    const [account] = await db
      .select({ id: cashAccountsTable.id })
      .from(cashAccountsTable)
      .where(and(eq(cashAccountsTable.id, id), eq(cashAccountsTable.userId, userId)));
    if (!account) { res.status(404).json({ error: "Cash account not found" }); return; }

    const row = {
      id: generateUpdateId(),
      userId,
      cashAccountId: id,
      delta,
      resultingBalance,
    };
    await db.insert(cashBalanceUpdatesTable).values(row);
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "POST /cash-accounts/:id/balance-updates failed");
    res.status(500).json({ error: "Failed to log balance update" });
  }
});

// GET /api/cash-accounts/today-changes — sum of each account's manual
// balance-update deltas for the current Cairo calendar day, keyed by
// cashAccountId. Cash isn't a live market instrument with its own
// start-of-day snapshot, so "today's change" is simply whatever was
// manually added/subtracted today — no baseline value needed the way
// market prices require one.
router.get("/cash-accounts/today-changes", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    // A 2-day lookback comfortably covers the Cairo-vs-UTC offset without
    // scanning the whole table as history accumulates over months.
    const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        cashAccountId: cashBalanceUpdatesTable.cashAccountId,
        delta: cashBalanceUpdatesTable.delta,
        createdAt: cashBalanceUpdatesTable.createdAt,
      })
      .from(cashBalanceUpdatesTable)
      .where(and(eq(cashBalanceUpdatesTable.userId, userId), gte(cashBalanceUpdatesTable.createdAt, since)));

    const today = cairoDateString();
    const totals: Record<string, number> = {};
    for (const r of rows) {
      if (cairoDateString(new Date(r.createdAt)) !== today) continue;
      totals[r.cashAccountId] = (totals[r.cashAccountId] ?? 0) + r.delta;
    }
    res.json(totals);
  } catch (err) {
    req.log.error({ err }, "GET /cash-accounts/today-changes failed");
    res.status(500).json({ error: "Failed to fetch today's changes" });
  }
});

export default router;
