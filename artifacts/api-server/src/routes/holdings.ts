import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, holdingsTable, activityLogTable, soldHoldingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";
import { costBasisEGP, computeHoldingValue, livePricePerUnit, type StoredHolding } from "../lib/portfolioValue";
import { getCachedPrices, getCachedStocks } from "./markets";
import { tradingDayKey } from "../lib/cairoDate";

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

// Deterministic JSON stringify (sorted keys), with undefined/null/""
// keys dropped so all three compare as the same "no value" — used only
// for the no-op-save check below, not for anything persisted. The drop
// matches the identical fix on the mobile client (context/
// HoldingsContext.tsx) for the same real bug: a holding whose optional
// field (e.g. notes) was never set at all (key absent) compares unequal
// against a re-save that always includes it as an explicit "" — a false
// "real change" on every no-op save for such a holding. 0/false are real,
// meaningful values and are deliberately NOT dropped here.
function stableStringify(v: unknown): string {
  return JSON.stringify(v, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value)
        .filter(k => (value as Record<string, unknown>)[k] !== undefined && (value as Record<string, unknown>)[k] !== null && (value as Record<string, unknown>)[k] !== "")
        .sort()
        .reduce((acc, k) => { acc[k] = (value as Record<string, unknown>)[k]; return acc; }, {} as Record<string, unknown>);
    }
    return value;
  });
}

function holdingQuantity(h: StoredHolding): number | null {
  if (h.type === "gold" || h.type === "silver") return Number(h.grams) || 0;
  if (h.type === "stock") return Number(h.shares) || 0;
  return null;
}

// Fetches everything livePricePerUnit needs in one call — shared by the
// stamping logic in POST/PUT below.
async function fetchPriceContext() {
  const [prices, egxStocks] = await Promise.all([
    getCachedPrices(),
    getCachedStocks().catch(() => []),
  ]);
  const egxPrices: Record<string, number> = {};
  for (const s of egxStocks) egxPrices[s.symbol] = s.price;
  return { prices, egxPrices };
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

    res.json(rows.map(r => ({
      id: r.id, type: r.type, ...(decryptFromStorage(r.data) as object),
      // Lets the client tell "touched today" from "untouched" — e.g. so the
      // Home tab's Today's Change badge can exclude a holding that was just
      // added or edited today instead of applying today's real price % to a
      // possibly just-inflated current amount (see HoldingsContext.tsx /
      // index.tsx's touchedToday for the consuming side).
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    })));
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
    // Stamp the live price at this exact moment, server-side, into the
    // holding's own data — never trust a client-supplied value for this
    // field even if one is present in the request body. This is what lets
    // Today's Change and the leaderboard use "real movement since this lot
    // was added" instead of either the whole day's price (unfair — credits
    // movement from before it existed) or zero (uninformative). Silently
    // skipped for types with no live price feed (real_estate,
    // personal_asset, fixed_income) or if the feed is down — never
    // fabricated.
    const holdingForPricing = { id: id as string, type: type as string, ...rest } as StoredHolding;
    const { prices, egxPrices } = await fetchPriceContext();
    const stampedPrice = livePricePerUnit(holdingForPricing, prices, egxPrices);
    const dataToStore = stampedPrice != null ? { ...rest, priceAtCreationEgp: stampedPrice } : rest;

    await db.insert(holdingsTable).values({
      id: id as string,
      userId,
      type: type as string,
      data: encryptForStorage(dataToStore),
    });

    res.status(201).json({ id, type, ...dataToStore });
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

// DELETE /api/holdings/:id — delete a holding. For "this was never real"
// corrections (wrong type, duplicate, fat-finger) — Sell stays the only
// path for an actual realized sale, so DELETE never shows up in the user's
// own Sold Investments history.
//
// For gold/silver/stock specifically, deleting it WOULD otherwise be a real
// leaderboard hole: computePeriodPerformance ratios a still-held position's
// current value against its baseline, so simply making a losing position
// vanish erases that loss from the leaderboard for free — something Sell
// can't do, since a sale's proceeds/cost-basis get counted either way. The
// fix mirrors Sell's own accounting exactly: silently record an implicit
// "sale" at the holding's current market value (isDeletionRecord: true, so
// GET /sold-holdings filters it back out — the user never sees a fake
// transaction) before removing the row. computePeriodPerformance reads
// straight from sold_holdings and doesn't distinguish the two, so a
// deleted position now costs/benefits a user's leaderboard standing exactly
// as much as actually selling it would — closing the free-erasure gap
// without turning genuine mistake-fixing into a fabricated trade.
router.delete("/holdings/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;

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
    const isLeaderboardEligible = holding.type === "gold" || holding.type === "silver" || holding.type === "stock";

    await db.transaction(async (tx) => {
      if (isLeaderboardEligible) {
        const [prices, egxStocks] = await Promise.all([
          getCachedPrices(),
          getCachedStocks().catch(() => []),
        ]);
        const egxPrices: Record<string, number> = {};
        for (const s of egxStocks) egxPrices[s.symbol] = s.price;

        const amountInvested = costBasisEGP(holding, prices.usdToEgp);
        const currentValue = computeHoldingValue(holding, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices);

        await tx.insert(soldHoldingsTable).values({
          id: generateSoldHoldingId(),
          userId,
          data: encryptForStorage({
            originalHoldingId: id,
            type: holding.type,
            label: holdingLabel(holding),
            quantity: holdingQuantity(holding),
            purchaseDate: holding.purchaseDate ?? null,
            holdingCreatedDay: tradingDayKey(row.createdAt),
            // "amountInvested" — matches the user-facing costBasisLabel
            // string ("Amount Invested") everywhere else in the app; this is
            // the field's real persisted name now, not just a display label.
            amountInvested,
            saleProceeds: currentValue,
            saleDate: tradingDayKey(),
            realizedGainLoss: currentValue - amountInvested,
            notes: null,
            isDeletionRecord: true,
          }),
        });
      }

      await tx
        .delete(holdingsTable)
        .where(and(eq(holdingsTable.id, id), eq(holdingsTable.userId, userId)));

      // Clean up this holding's own notification history — otherwise a
      // deleted holding's old "Investment added" / "updated" entries keep
      // showing in the bell forever, for something that no longer exists.
      await tx
        .delete(activityLogTable)
        .where(and(eq(activityLogTable.userId, userId), eq(activityLogTable.entityId, id)));
    });

    res.json({ deleted: id });
  } catch (err) {
    req.log.error({ err }, "DELETE /holdings/:id failed");
    res.status(500).json({ error: "Failed to delete holding" });
  }
});

// POST /api/holdings/:id/sell — record a realized sale (or redemption, for
// fixed_income) against ONE specific holding (one lot, once per-lot tracking
// is in play). Deliberately separate from DELETE: this is for an actual sale
// event with a financial record kept afterward, not for removing a mistaken
// entry — DELETE stays unchanged for that case, both actions live side by
// side on the card.
//
// `quantity` is optional and only meaningful for gold/silver/stock (the
// fungible, quantity-bearing types): omit it, or pass the lot's full
// quantity, to sell the whole lot exactly as before. Pass less than the
// full quantity to PARTIALLY sell this lot — e.g. holding 100g, selling
// 10g — which records a realized sale for just that portion and shrinks
// this same lot in place, rather than forcing an all-or-nothing sale or a
// manual "edit the grams down with no sale record" workaround. The
// remaining portion keeps this lot's own priceAtCreationEgp/
// priceAtLastEditEgp/purchaseDate untouched — it's still the same lot,
// just smaller, not a new one.
router.post("/holdings/:id/sell", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;
  const body = req.body as { saleProceeds?: number; saleDate?: string; notes?: string; quantity?: number };
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
    const fullQuantity = holdingQuantity(holding);
    const isFungible = holding.type === "gold" || holding.type === "silver" || holding.type === "stock";

    let sellQuantity = fullQuantity;
    if (isFungible && body.quantity != null) {
      const requested = Number(body.quantity);
      if (!Number.isFinite(requested) || requested <= 0) {
        res.status(400).json({ error: "quantity must be a positive number" });
        return;
      }
      if (fullQuantity != null && requested > fullQuantity + 1e-9) {
        res.status(400).json({ error: "quantity exceeds this holding's remaining amount" });
        return;
      }
      sellQuantity = requested;
    }

    const isPartial = isFungible && fullQuantity != null && sellQuantity != null && sellQuantity < fullQuantity - 1e-9;
    const portion = isPartial && fullQuantity ? sellQuantity! / fullQuantity : 1;
    const amountInvested = costBasisEGP(holding, prices.usdToEgp) * portion;
    const realizedGainLoss = saleProceeds - amountInvested;

    const soldId = generateSoldHoldingId();
    const soldData = {
      originalHoldingId: id,
      type: holding.type,
      label: holdingLabel(holding),
      quantity: isPartial ? sellQuantity : fullQuantity,
      purchaseDate: holding.purchaseDate ?? null,
      // The trading day this holding was actually added to the app (not the
      // user-entered purchaseDate, which they could backdate) — lets the
      // leaderboard correctly credit a sale's proceeds toward "return on
      // what I already held" only when that's true, instead of either
      // always counting it (letting a same-day add-then-sell inflate a
      // period's return) or never counting it (making a legitimate
      // mid-period sale of a long-held asset look like a big loss, since
      // the holding just vanishes with nothing replacing its value).
      holdingCreatedDay: tradingDayKey(row.createdAt),
      // "amountInvested" — matches the user-facing costBasisLabel string
      // ("Amount Invested") everywhere else in the app; this is the field's
      // real persisted name now, not just a display label.
      amountInvested,
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

      if (isPartial) {
        // Shrink this lot in place instead of deleting it — the remaining
        // quantity is still the same original lot (same price stamps, same
        // purchaseDate), just smaller.
        const remainingQty = fullQuantity! - sellQuantity!;
        const quantityField = holding.type === "stock" ? "shares" : "grams";
        const remainingData = { ...holding, [quantityField]: remainingQty };
        delete (remainingData as Record<string, unknown>).id;
        delete (remainingData as Record<string, unknown>).type;
        await tx
          .update(holdingsTable)
          .set({ data: encryptForStorage(remainingData), updatedAt: new Date() })
          .where(and(eq(holdingsTable.id, id), eq(holdingsTable.userId, userId)));
      } else {
        await tx
          .delete(holdingsTable)
          .where(and(eq(holdingsTable.id, id), eq(holdingsTable.userId, userId)));

        // Same cleanup as DELETE — a sold holding's old "Investment added" /
        // "updated" entries shouldn't keep showing in the bell either.
        await tx
          .delete(activityLogTable)
          .where(and(eq(activityLogTable.userId, userId), eq(activityLogTable.entityId, id)));
      }
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
  // priceAtCreationEgp/priceAtLastEditEgp are never client-supplied, even if
  // present in the body (e.g. round-tripped from a prior GET) — always
  // derived below, either preserved from the existing row or freshly
  // stamped, never trusted from the request.
  const { type, priceAtCreationEgp: _ignoredCreation, priceAtLastEditEgp: _ignoredEdit, ...rest } = body;

  try {
    const [existingRow] = await db
      .select()
      .from(holdingsTable)
      .where(and(eq(holdingsTable.id, id), eq(holdingsTable.userId, userId)));
    if (!existingRow) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const existingHolding = { id: existingRow.id, type: existingRow.type, ...(decryptFromStorage(existingRow.data) as object) } as StoredHolding;

    // A byte-identical re-save (open Edit, change nothing, tap Save) used to
    // still bump updatedAt unconditionally below — harmless-looking, but
    // Today's-change math on the client treats any holding "touched today"
    // as needing a fresh price stamp before it can safely use live %-change
    // (anti-gaming: never let editing a lot fake that day's move). A no-op
    // save has nothing to stamp from, so that holding silently drops out of
    // Today's total for the rest of the day — confirmed live, a real user
    // report, not hypothetical. Skipping the write entirely when nothing
    // actually changed (compared field-by-field, ignoring id/type/the two
    // server-derived stamp fields, which are never client-editable anyway)
    // is the correct fix: no real edit happened, so nothing should look
    // "touched" to that later gate.
    const { id: _exId, type: _exType, priceAtCreationEgp: _exCreation, priceAtLastEditEgp: _exEdit, ...existingRest } =
      existingHolding as unknown as Record<string, unknown>;
    if (type === existingHolding.type && stableStringify(existingRest) === stableStringify(rest)) {
      res.json(existingHolding);
      return;
    }

    const newHolding = { id, type: type as string, ...rest } as StoredHolding;
    const quantityChanged = holdingQuantity(existingHolding) !== holdingQuantity(newHolding);

    let dataToStore: Record<string, unknown> = rest;
    if (quantityChanged) {
      // A real quantity change resets this lot's own tracking reference to
      // right now — see livePricePerUnit's own comment for why this can't
      // be split into "the original portion" vs "the correction" without
      // per-lot infrastructure; treating the whole lot as freshly stamped
      // is the honest, conservative choice, not a fabricated split.
      const { prices, egxPrices } = await fetchPriceContext();
      const stampedPrice = livePricePerUnit(newHolding, prices, egxPrices);
      dataToStore = {
        ...rest,
        priceAtCreationEgp: existingHolding.priceAtCreationEgp,
        ...(stampedPrice != null ? { priceAtLastEditEgp: stampedPrice } : {}),
      };
    } else {
      dataToStore = {
        ...rest,
        priceAtCreationEgp: existingHolding.priceAtCreationEgp,
        priceAtLastEditEgp: existingHolding.priceAtLastEditEgp,
      };
    }

    await db
      .update(holdingsTable)
      .set({ data: encryptForStorage(dataToStore), type: type as string, updatedAt: new Date() })
      .where(and(eq(holdingsTable.id, id), eq(holdingsTable.userId, userId)));

    res.json({ id, type, ...dataToStore });
  } catch (err) {
    req.log.error({ err }, "PUT /holdings/:id failed");
    res.status(500).json({ error: "Failed to update holding" });
  }
});

export default router;
