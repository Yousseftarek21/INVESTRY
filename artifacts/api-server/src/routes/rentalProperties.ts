import { Router, type IRouter, type Request, type Response } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  rentalRecordsTable,
  rentalUnitsTable,
  rentalBookingsTable,
  rentalLeasesTable,
  rentalExpensesTable,
} from "@workspace/db";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";
import { isUserPro } from "../lib/isUserPro";

const router: IRouter = Router();

router.use("/rental-properties", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

type Json = Record<string, unknown>;
const CHILD_TABLES = {
  bookings: rentalBookingsTable,
  leases: rentalLeasesTable,
  expenses: rentalExpensesTable,
} as const;
type ChildKind = keyof typeof CHILD_TABLES;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: unknown) => typeof v === "string" && DATE.test(v);
const isAmount = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const optAmount = (v: unknown) => v === undefined || v === null || isAmount(v);
const isId = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 80;
const isText = (v: unknown, max = 200) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

// Minimal shape checks — enough that the totals the app computes from these
// records can never be fed a non-number or a malformed date.
function validate(kind: "units" | ChildKind, body: Json): string | null {
  switch (kind) {
    case "units":
      if (!isText(body.name, 120)) return "name is required";
      if (!["short_stay", "long_term", "both"].includes(body.mode as string)) return "mode is invalid";
      if (!isText(body.currency, 8)) return "currency is required";
      if (!optAmount(body.defaultNightlyRate) || !optAmount(body.defaultCleaningFee) || !optAmount(body.defaultMonthlyRent)) return "default rates must be non-negative numbers";
      return null;
    case "bookings":
      if (!isDate(body.checkIn) || !isDate(body.checkOut)) return "checkIn and checkOut must be YYYY-MM-DD";
      if ((body.checkOut as string) < (body.checkIn as string)) return "checkOut is before checkIn";
      if (!isAmount(body.totalAmount)) return "totalAmount must be a non-negative number";
      if (!optAmount(body.platformFee) || !optAmount(body.cleaningFee)) return "fees must be non-negative numbers";
      if (!isText(body.currency, 8)) return "currency is required";
      return null;
    case "leases":
      if (!isText(body.tenantName, 120)) return "tenantName is required";
      if (!isDate(body.startDate)) return "startDate must be YYYY-MM-DD";
      if (body.endDate != null && (!isDate(body.endDate) || (body.endDate as string) < (body.startDate as string))) return "endDate is invalid";
      if (!isAmount(body.monthlyRent)) return "monthlyRent must be a non-negative number";
      if (!Number.isInteger(body.dueDay) || (body.dueDay as number) < 1 || (body.dueDay as number) > 28) return "dueDay must be 1-28";
      if (!Array.isArray(body.payments)) return "payments must be an array";
      for (const p of body.payments as Json[]) {
        if (typeof p?.month !== "string" || !/^\d{4}-\d{2}$/.test(p.month) || !isAmount(p.amount) || !isDate(p.paidDate)) return "a payment is malformed";
      }
      if (!isText(body.currency, 8)) return "currency is required";
      return null;
    case "expenses":
      if (!isDate(body.date)) return "date must be YYYY-MM-DD";
      if (!isAmount(body.amount)) return "amount must be a non-negative number";
      if (!isText(body.category, 40)) return "category is required";
      if (!isText(body.currency, 8)) return "currency is required";
      return null;
  }
}

function decryptRow(r: { id: string; data: unknown }): Json {
  return { id: r.id, ...(decryptFromStorage(r.data) as Json) };
}

// ── Legacy migration ──────────────────────────────────────────────────────────
// The old Rental Tracking stored one flat list of payments (rental_records).
// Each record becomes a booking under a unit grouped by the property it was
// logged against. IDs are derived from the record, so running this again —
// or two devices loading at once — inserts nothing twice. Old records are
// kept untouched for app versions that haven't updated yet.
//
// Every legacy record becomes a booking (dated income for a period), never
// a lease: a lease generates a monthly rent schedule, and inventing one
// from a single logged payment would flag months nobody ever recorded as
// overdue.
async function migrateLegacy(userId: string): Promise<void> {
  const legacy = await db.select().from(rentalRecordsTable).where(eq(rentalRecordsTable.userId, userId));
  if (legacy.length === 0) return;

  const bookingIds = legacy.map((r) => `legacy-${r.id}`);
  const migrated = await db
    .select({ id: rentalBookingsTable.id })
    .from(rentalBookingsTable)
    .where(and(eq(rentalBookingsTable.userId, userId), inArray(rentalBookingsTable.id, bookingIds)));
  const done = new Set(migrated.map((m) => m.id));
  const pending = legacy.filter((r) => !done.has(`legacy-${r.id}`));
  if (pending.length === 0) return;

  const records: Array<Json & { id: string; createdAt: Date }> = pending.map((r) => ({ ...(decryptFromStorage(r.data) as Json), id: r.id, createdAt: r.createdAt }));
  const groups = new Map<string, typeof records>();
  for (const rec of records) {
    const key = typeof rec.holdingId === "string" && rec.holdingId
      ? `holding:${rec.holdingId}`
      : `name:${String(rec.propertyName ?? "").trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), rec]);
  }

  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (const [key, recs] of groups) {
      const unitId = `lu_${createHash("sha1").update(`${userId}|${key}`).digest("hex").slice(0, 20)}`;
      const channels = new Set(recs.map((r) => r.channel));
      const shortStay = [...channels].some((c) => c === "airbnb" || c === "booking_com");
      const longTerm = channels.has("direct_lease");
      const currencyCounts = new Map<string, number>();
      for (const r of recs) {
        const c = typeof r.currency === "string" && r.currency ? r.currency : "EGP";
        currencyCounts.set(c, (currencyCounts.get(c) ?? 0) + 1);
      }
      const currency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "EGP";
      const first = recs[0];
      await tx.insert(rentalUnitsTable).values({
        id: unitId,
        userId,
        data: encryptForStorage({
          name: String(first.propertyName ?? "").trim() || "My unit",
          mode: shortStay && longTerm ? "both" : longTerm ? "long_term" : "short_stay",
          currency,
          holdingId: typeof first.holdingId === "string" && first.holdingId ? first.holdingId : undefined,
          migratedFromLegacy: true,
          createdAt: now,
        }),
      }).onConflictDoNothing();

      for (const r of recs) {
        const platform = r.channel === "airbnb" ? "airbnb"
          : r.channel === "booking_com" ? "booking_com"
          : r.channel === "direct_lease" ? "direct" : "other";
        const checkIn = isDate(r.startDate) ? (r.startDate as string) : (r.createdAt as Date).toISOString().slice(0, 10);
        const checkOut = isDate(r.endDate) && (r.endDate as string) >= checkIn ? (r.endDate as string) : checkIn;
        await tx.insert(rentalBookingsTable).values({
          id: `legacy-${r.id}`,
          userId,
          unitId,
          data: encryptForStorage({
            unitId,
            guestName: typeof r.tenantName === "string" ? r.tenantName : undefined,
            guestInfo: typeof r.tenantInfo === "string" ? r.tenantInfo : undefined,
            checkIn,
            checkOut,
            platform,
            platformOther: platform === "other" && typeof r.channelOther === "string" ? r.channelOther : undefined,
            totalAmount: isAmount(r.amount) ? r.amount : 0,
            currency: typeof r.currency === "string" && r.currency ? r.currency : currency,
            status: "confirmed",
            received: true,
            receivedDate: checkIn,
            paymentMethod: typeof r.paymentMethod === "string" ? r.paymentMethod : undefined,
            // The old flow already deposited into this account at the time.
            cashAccountId: typeof r.cashAccountId === "string" ? r.cashAccountId : undefined,
            notes: typeof r.note === "string" ? r.note : undefined,
            legacyRecordId: r.id,
            createdAt: (r.createdAt as Date).toISOString(),
          }),
        }).onConflictDoNothing();
      }
    }
  });
}

// GET /api/rental-properties — everything at once (units are few; one round
// trip keeps the screens instant).
router.get("/rental-properties", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    try {
      await migrateLegacy(userId);
    } catch (err) {
      // Never block loading the user's data on the one-time migration.
      req.log.error({ err }, "Rental properties: legacy migration failed");
    }
    const [units, bookings, leases, expenses] = await Promise.all([
      db.select().from(rentalUnitsTable).where(eq(rentalUnitsTable.userId, userId)).orderBy(rentalUnitsTable.createdAt),
      db.select().from(rentalBookingsTable).where(eq(rentalBookingsTable.userId, userId)),
      db.select().from(rentalLeasesTable).where(eq(rentalLeasesTable.userId, userId)),
      db.select().from(rentalExpensesTable).where(eq(rentalExpensesTable.userId, userId)),
    ]);
    res.json({
      units: units.map(decryptRow),
      bookings: bookings.map(decryptRow),
      leases: leases.map(decryptRow),
      expenses: expenses.map(decryptRow),
    });
  } catch (err) {
    req.log.error({ err }, "GET /rental-properties failed");
    res.status(500).json({ error: "Failed to load rental properties" });
  }
});

async function userIsPro(userId: string): Promise<boolean> {
  if (process.env.BETA_UNLOCK_ALL === "true") return true;
  const [user] = await db
    .select({ plan: usersTable.plan, proCreditExpiresAt: usersTable.proCreditExpiresAt })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return isUserPro(user);
}

async function ownsUnit(userId: string, unitId: unknown): Promise<boolean> {
  if (!isId(unitId)) return false;
  const [u] = await db
    .select({ id: rentalUnitsTable.id })
    .from(rentalUnitsTable)
    .where(and(eq(rentalUnitsTable.id, unitId as string), eq(rentalUnitsTable.userId, userId)));
  return !!u;
}

function splitBody(req: Request): { id: unknown; rest: Json } {
  const { id, ...rest } = (req.body ?? {}) as Json;
  return { id, rest };
}

// ── Units ─────────────────────────────────────────────────────────────────────
router.post("/rental-properties/units", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id, rest } = splitBody(req);
  if (!isId(id)) { res.status(400).json({ error: "id is required" }); return; }
  const problem = validate("units", rest);
  if (problem) { res.status(400).json({ error: problem }); return; }
  try {
    // Creating units is the Pro feature; a lapsed subscriber can still view,
    // edit and delete what they already recorded.
    if (!(await userIsPro(userId))) { res.status(403).json({ error: "Rental Properties is a Pro feature" }); return; }
    await db.insert(rentalUnitsTable).values({ id: id as string, userId, data: encryptForStorage(rest) });
    res.status(201).json({ id, ...rest });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") { res.status(409).json({ error: "A unit with that id already exists" }); return; }
    req.log.error({ err }, "POST /rental-properties/units failed");
    res.status(500).json({ error: "Failed to save unit" });
  }
});

router.put("/rental-properties/units/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { rest } = splitBody(req);
  const problem = validate("units", rest);
  if (problem) { res.status(400).json({ error: problem }); return; }
  try {
    const updated = await db
      .update(rentalUnitsTable)
      .set({ data: encryptForStorage(rest), updatedAt: new Date() })
      .where(and(eq(rentalUnitsTable.id, req.params.id), eq(rentalUnitsTable.userId, userId)))
      .returning({ id: rentalUnitsTable.id });
    if (updated.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: req.params.id, ...rest });
  } catch (err) {
    req.log.error({ err }, "PUT /rental-properties/units/:id failed");
    res.status(500).json({ error: "Failed to update unit" });
  }
});

// Deleting a unit deletes everything recorded against it.
router.delete("/rental-properties/units/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const unitId = req.params.id;
  try {
    const deleted = await db.transaction(async (tx) => {
      // Migrated bookings point back at the old record they came from; drop
      // those too, or the next load would migrate them straight back.
      const legacy = await tx
        .select({ id: rentalBookingsTable.id })
        .from(rentalBookingsTable)
        .where(and(eq(rentalBookingsTable.unitId, unitId), eq(rentalBookingsTable.userId, userId)));
      const legacyIds = legacy.map((b) => b.id).filter((id) => id.startsWith("legacy-")).map((id) => id.slice("legacy-".length));
      if (legacyIds.length > 0) {
        await tx.delete(rentalRecordsTable).where(and(inArray(rentalRecordsTable.id, legacyIds), eq(rentalRecordsTable.userId, userId)));
      }
      for (const table of Object.values(CHILD_TABLES)) {
        await tx.delete(table).where(and(eq(table.unitId, unitId), eq(table.userId, userId)));
      }
      return tx
        .delete(rentalUnitsTable)
        .where(and(eq(rentalUnitsTable.id, unitId), eq(rentalUnitsTable.userId, userId)))
        .returning({ id: rentalUnitsTable.id });
    });
    if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ deleted: unitId });
  } catch (err) {
    req.log.error({ err }, "DELETE /rental-properties/units/:id failed");
    res.status(500).json({ error: "Failed to delete unit" });
  }
});

// ── Bookings, leases, expenses ───────────────────────────────────────────────
for (const kind of Object.keys(CHILD_TABLES) as ChildKind[]) {
  const table = CHILD_TABLES[kind];

  router.post(`/rental-properties/${kind}`, async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { id, rest } = splitBody(req);
    if (!isId(id)) { res.status(400).json({ error: "id is required" }); return; }
    const problem = validate(kind, rest);
    if (problem) { res.status(400).json({ error: problem }); return; }
    try {
      if (!(await ownsUnit(userId, rest.unitId))) { res.status(400).json({ error: "Unknown unit" }); return; }
      await db.insert(table).values({ id: id as string, userId, unitId: rest.unitId as string, data: encryptForStorage(rest) });
      res.status(201).json({ id, ...rest });
    } catch (err) {
      if ((err as { code?: string }).code === "23505") { res.status(409).json({ error: "That id already exists" }); return; }
      req.log.error({ err, kind }, "POST /rental-properties child failed");
      res.status(500).json({ error: "Failed to save" });
    }
  });

  router.put(`/rental-properties/${kind}/:id`, async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { rest } = splitBody(req);
    const problem = validate(kind, rest);
    if (problem) { res.status(400).json({ error: problem }); return; }
    try {
      if (!(await ownsUnit(userId, rest.unitId))) { res.status(400).json({ error: "Unknown unit" }); return; }
      const updated = await db
        .update(table)
        .set({ unitId: rest.unitId as string, data: encryptForStorage(rest), updatedAt: new Date() })
        .where(and(eq(table.id, String(req.params.id)), eq(table.userId, userId)))
        .returning({ id: table.id });
      if (updated.length === 0) { res.status(404).json({ error: "Not found" }); return; }
      res.json({ id: String(req.params.id), ...rest });
    } catch (err) {
      req.log.error({ err, kind }, "PUT /rental-properties child failed");
      res.status(500).json({ error: "Failed to update" });
    }
  });

  router.delete(`/rental-properties/${kind}/:id`, async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    try {
      const id = String(req.params.id);
      const deleted = await db.transaction(async (tx) => {
        // Same reasoning as the unit delete above.
        if (kind === "bookings" && id.startsWith("legacy-")) {
          await tx.delete(rentalRecordsTable).where(and(eq(rentalRecordsTable.id, id.slice("legacy-".length)), eq(rentalRecordsTable.userId, userId)));
        }
        return tx
          .delete(table)
          .where(and(eq(table.id, id), eq(table.userId, userId)))
          .returning({ id: table.id });
      });
      if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
      res.json({ deleted: id });
    } catch (err) {
      req.log.error({ err, kind }, "DELETE /rental-properties child failed");
      res.status(500).json({ error: "Failed to delete" });
    }
  });
}

export default router;
