import { Router, type IRouter } from "express";
import { isNotNull, eq, asc } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, usersTable, holdingsTable, portfolioSnapshotsTable, dailyChangeSnapshotsTable } from "@workspace/db";
import { sendPushToTokens } from "../lib/expoPush";
import { backfillDailyChanges } from "../lib/dailyChangeBackfill";

const router: IRouter = Router();

// Manual broadcast tool — not tied to any specific feature launch, unlike
// competitionAnnouncement.ts's one-time self-limiting boot script. Guarded
// by a shared secret (ADMIN_BROADCAST_SECRET) rather than a Clerk session:
// this is an operator action, not a user-facing one, and there's no admin
// role/flag anywhere in usersTable to check against. Set the secret in
// Render's env vars, then call with:
//
//   curl -X POST https://api.investry.app/api/admin/broadcast-push \
//     -H "x-admin-secret: <the secret>" \
//     -H "Content-Type: application/json" \
//     -d '{"title": "...", "body": "..."}'
router.post("/admin/broadcast-push", async (req, res) => {
  const secret = process.env.ADMIN_BROADCAST_SECRET;
  if (!secret) {
    res.status(503).json({ error: "ADMIN_BROADCAST_SECRET is not configured on the server" });
    return;
  }
  if (req.headers["x-admin-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.body === "string" ? body.body.trim() : "";
  if (!title || !message) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }

  try {
    const rows = await db
      .select({ pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(isNotNull(usersTable.pushToken));

    const tokens = rows.map(r => r.pushToken!).filter(Boolean);
    await sendPushToTokens(tokens, title, message, { type: "admin_broadcast" });

    res.json({ success: true, recipientCount: tokens.length });
  } catch (err) {
    req.log.error({ err }, "POST /admin/broadcast-push failed");
    res.status(500).json({ error: "Failed to send broadcast" });
  }
});

// One-time (safely re-runnable) backfill for daily_change_snapshots — see
// dailyChangeBackfill.ts for exactly what it does and doesn't fill in.
// Same secret/curl pattern as broadcast-push above:
//
//   curl -X POST https://api.investry.app/api/admin/backfill-daily-changes \
//     -H "x-admin-secret: <the secret>"
router.post("/admin/backfill-daily-changes", async (req, res) => {
  const secret = process.env.ADMIN_BROADCAST_SECRET;
  if (!secret) {
    res.status(503).json({ error: "ADMIN_BROADCAST_SECRET is not configured on the server" });
    return;
  }
  if (req.headers["x-admin-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await backfillDailyChanges();
    res.json({ success: true, ...result });
  } catch (err) {
    req.log.error({ err }, "POST /admin/backfill-daily-changes failed");
    res.status(500).json({ error: "Backfill failed" });
  }
});

// Diagnostic lookup, for answering "why does my account show X" support
// questions with real data instead of a guess — never exposes decrypted
// holding contents (grams, prices, purchase info), only the metadata this
// whole feature's eligibility rule actually depends on: type and
// created/updated timestamps, plus the already-computed snapshot history.
//
//   curl "https://api.investry.app/api/admin/user-debug?email=<email>" \
//     -H "x-admin-secret: <the secret>"
router.get("/admin/user-debug", async (req, res) => {
  const secret = process.env.ADMIN_BROADCAST_SECRET;
  if (!secret) {
    res.status(503).json({ error: "ADMIN_BROADCAST_SECRET is not configured on the server" });
    return;
  }
  if (req.headers["x-admin-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
  if (!email) {
    res.status(400).json({ error: "email query param is required" });
    return;
  }

  try {
    const { data: clerkUsers } = await clerkClient.users.getUserList({ emailAddress: [email] });
    if (clerkUsers.length === 0) {
      res.status(404).json({ error: "No Clerk user with that email" });
      return;
    }
    const userId = clerkUsers[0].id;

    const [holdings, snapshots, dailyChanges] = await Promise.all([
      db
        .select({ id: holdingsTable.id, type: holdingsTable.type, createdAt: holdingsTable.createdAt, updatedAt: holdingsTable.updatedAt })
        .from(holdingsTable)
        .where(eq(holdingsTable.userId, userId))
        .orderBy(asc(holdingsTable.createdAt)),
      db
        .select({ date: portfolioSnapshotsTable.date, totalValue: portfolioSnapshotsTable.totalValue })
        .from(portfolioSnapshotsTable)
        .where(eq(portfolioSnapshotsTable.userId, userId))
        .orderBy(asc(portfolioSnapshotsTable.date)),
      db
        .select({ date: dailyChangeSnapshotsTable.date, pctReturn: dailyChangeSnapshotsTable.pctReturn })
        .from(dailyChangeSnapshotsTable)
        .where(eq(dailyChangeSnapshotsTable.userId, userId))
        .orderBy(asc(dailyChangeSnapshotsTable.date)),
    ]);

    res.json({ userId, holdings, portfolioSnapshotCount: snapshots.length, portfolioSnapshots: snapshots, dailyChanges });
  } catch (err) {
    req.log.error({ err }, "GET /admin/user-debug failed");
    res.status(500).json({ error: "Lookup failed" });
  }
});

export default router;
