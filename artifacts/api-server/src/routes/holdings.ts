import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, holdingsTable, activityLogTable, soldHoldingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";
import { costBasisEGP, type StoredHolding } from "../lib/portfolioValue";
import { getCachedPrices } from "./markets";

function generateSoldHoldingId(): string {
  return `sld_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// A holding's display label for the sold-history record, denormalized so it
// still reads correctly after the original holding row is gone — same
// reasoning as Dividend.symbol/companyName (see types/index.ts on mobile).
function holdingLabel(h: StoredHolding): string {
  switch (h.type) {
    case "gold": return `Gold (${h.karat ?? "24k"})`;
    case "silver": return "Silver";
    case "stock": return String(h.companyName ?? h.symbol ?? "Stock");
    case "real_estate": return String(h.propertyName ?? "Real estate");
    case "personal_asset": return String(h.name ?? "Personal asset");
    case "fixed_income": return String(h.label ?? h.institution ?? "Fixed income");
    default: return String(h.type);
  }
}

function holdingQuantity(h: StoredHolding): number | null {
  if (h.type === "gold" || h.type === "silver") return Number(h.grams) || 0;
  if (h.type === "stock") return Number(h.shares) || 0;
  return null;
}

const router: IRouter = Router();

// Require a valid Clerk session for all holdings routes
router.use("/holdings", clerkMiddleware(), (req, res, next) => {
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

    res.json(rows.map(r => ({ id: r.id, type: r.type, ...(decryptFromStorage(r.data) as object) })));
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
      data: encryptForStorage(rest),
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

    // Clean up this holding's own notification history — otherwise a
    // deleted holding's old "Investment added" / "updated" entries keep
    // showing in the bell forever, for something that no longer exists.
    await db
      .delete(activityLogTable)
      .where(and(eq(activityLogTable.userId, userId), eq(activityLogTable.entityId, id)));

    res.json({ deleted: id });
  } catch (err) {
    req.log.error({ err }, "DELETE /holdings/:id failed");
    res.status(500).json({ error: "Failed to delete holding" });
  }
});

// POST /api/holdings/:id/sell — record a realized sale (or redemption, for
// fixed_income) and remove the holding from the active list. Deliberately
// separate from DELETE: this is for an actual sale event with a financial
// record kept afterward, not for removing a mistaken entry — DELETE stays
// unchanged for that case, both actions live side by side on the card.
router.post("/holdings/:id/sell", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;
  const body = req.body as { saleProceeds?: number; saleDate?: string; notes?: string };
  const saleProceeds = Number(body.saleProceeds);
  if (!Number.isFinite(saleProceeds) || saleProceeds < 0) {
    res.status(400).json({ error: "saleProceeds must be a non-negative number" });
    return;
  }
  if (!body.saleDate) {
    res.status(400).json({ error: "saleDate is required" });
    return;
  }

  try {
    const [row] = await db
      .select()
      .from(holdingsTable)
      .where(and(eq(holdingsTable.id, id), eq(holdingsTable.userId, userId)));

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
    const prices = await getCachedPrices();
    const costBasis = costBasisEGP(holding, prices.usdToEgp);
    const realizedGainLoss = saleProceeds - costBasis;

    const soldId = generateSoldHoldingId();
    const soldData = {
      originalHoldingId: id,
      type: holding.type,
      label: holdingLabel(holding),
      quantity: holdingQuantity(holding),
      purchaseDate: holding.purchaseDate ?? null,
      costBasis,
      saleProceeds,
      saleDate: body.saleDate,
      realizedGainLoss,
      notes: body.notes ?? null,
    };

    await db.transaction(async (tx) => {
      await tx.insert(soldHoldingsTable).values({
        id: soldId,
        userId,
        data: encryptForStorage(soldData),
      });

      await tx
        .delete(holdingsTable)
        .where(and(eq(holdingsTable.id, id), eq(holdingsTable.userId, userId)));

      // Same cleanup as DELETE — a sold holding's old "Investment added" /
      // "updated" entries shouldn't keep showing in the bell either.
      await tx
        .delete(activityLogTable)
        .where(and(eq(activityLogTable.userId, userId), eq(activityLogTable.entityId, id)));
    });

    res.status(201).json({ id: soldId, ...soldData });
  } catch (err) {
    req.log.error({ err }, "POST /holdings/:id/sell failed");
    res.status(500).json({ error: "Failed to record sale" });
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
      .set({ data: encryptForStorage(rest), type: type as string, updatedAt: new Date() })
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
