import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, loansTable, usersTable } from "@workspace/db";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";
import { isUserPro } from "../lib/isUserPro";

const router: IRouter = Router();

// Free users can track this many loans; Pro is unlimited.
const FREE_LOAN_LIMIT = 1;

router.use("/loans", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

type Json = Record<string, unknown>;
const KINDS = ["personal", "car", "mortgage", "credit_card", "family", "installment", "other"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isAmount = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const optAmount = (v: unknown) => v === undefined || v === null || isAmount(v);

// Shape checks so the totals the app works out can never be fed a
// non-number or a malformed date.
function validate(b: Json): string | null {
  if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 120) return "name is required";
  if (!KINDS.includes(b.kind as string)) return "kind is invalid";
  if (typeof b.currency !== "string" || !b.currency || b.currency.length > 8) return "currency is required";
  if (!isAmount(b.startBalance)) return "startBalance must be a non-negative number";
  if (!optAmount(b.originalAmount) || !optAmount(b.monthlyPayment) || !optAmount(b.annualRate)) return "amounts must be non-negative numbers";
  if (b.dueDay != null && (!Number.isInteger(b.dueDay) || (b.dueDay as number) < 1 || (b.dueDay as number) > 28)) return "dueDay must be 1-28";
  if (typeof b.startDate !== "string" || !DATE.test(b.startDate)) return "startDate must be YYYY-MM-DD";
  if (b.endDate != null && (typeof b.endDate !== "string" || !DATE.test(b.endDate))) return "endDate must be YYYY-MM-DD";
  if (!Array.isArray(b.payments)) return "payments must be an array";
  for (const p of b.payments as Json[]) {
    if (typeof p?.id !== "string" || !isAmount(p.amount) || typeof p.date !== "string" || !DATE.test(p.date)) return "a payment is malformed";
  }
  return null;
}

router.get("/loans", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await db.select().from(loansTable).where(eq(loansTable.userId, userId)).orderBy(loansTable.createdAt);
    res.json(rows.map(r => ({ id: r.id, ...(decryptFromStorage(r.data) as Json) })));
  } catch (err) {
    req.log.error({ err }, "GET /loans failed");
    res.status(500).json({ error: "Failed to fetch loans" });
  }
});

router.post("/loans", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id, ...rest } = (req.body ?? {}) as Json;
  if (typeof id !== "string" || !id || id.length > 80) { res.status(400).json({ error: "id is required" }); return; }
  const problem = validate(rest);
  if (problem) { res.status(400).json({ error: problem }); return; }
  try {
    if (process.env.BETA_UNLOCK_ALL !== "true") {
      const [user] = await db.select({ plan: usersTable.plan, proCreditExpiresAt: usersTable.proCreditExpiresAt })
        .from(usersTable).where(eq(usersTable.id, userId));
      if (!isUserPro(user)) {
        const existing = await db.select({ id: loansTable.id }).from(loansTable).where(eq(loansTable.userId, userId));
        if (existing.length >= FREE_LOAN_LIMIT) { res.status(403).json({ error: "Free plan loan limit reached" }); return; }
      }
    }
    await db.insert(loansTable).values({ id, userId, data: encryptForStorage(rest) });
    res.status(201).json({ id, ...rest });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") { res.status(409).json({ error: "A loan with that id already exists" }); return; }
    req.log.error({ err }, "POST /loans failed");
    res.status(500).json({ error: "Failed to save loan" });
  }
});

// Editing and recording payments stay open after a plan lapses — only
// adding more loans is limited.
router.put("/loans/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = String(req.params.id);
  const { id: _bodyId, ...rest } = (req.body ?? {}) as Json;
  const problem = validate(rest);
  if (problem) { res.status(400).json({ error: problem }); return; }
  try {
    const updated = await db.update(loansTable)
      .set({ data: encryptForStorage(rest), updatedAt: new Date() })
      .where(and(eq(loansTable.id, id), eq(loansTable.userId, userId)))
      .returning({ id: loansTable.id });
    if (updated.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id, ...rest });
  } catch (err) {
    req.log.error({ err }, "PUT /loans/:id failed");
    res.status(500).json({ error: "Failed to update loan" });
  }
});

router.delete("/loans/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = String(req.params.id);
  try {
    const deleted = await db.delete(loansTable)
      .where(and(eq(loansTable.id, id), eq(loansTable.userId, userId)))
      .returning({ id: loansTable.id });
    if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ deleted: id });
  } catch (err) {
    req.log.error({ err }, "DELETE /loans/:id failed");
    res.status(500).json({ error: "Failed to delete loan" });
  }
});

export default router;
