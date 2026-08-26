import { Router, type IRouter } from "express";
import { isNotNull, eq, asc } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, usersTable, holdingsTable, portfolioSnapshotsTable, dailyChangeSnapshotsTable } from "@workspace/db";
import { sendPushToTokens } from "../lib/expoPush";
import { backfillDailyChanges, backfillDailyChangesFromSnapshots, resetDailyChangeHistory } from "../lib/dailyChangeBackfill";
import { computeRankedReturns } from "../lib/leaderboardRanking";
import { fetchIdentities } from "../lib/clerkIdentity";

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
// dailyChangeBackfill.ts for exactly what each pass does and doesn't fill
// in. Runs the precise, gaming-proof gold/silver+EGX method FIRST (so it
// always wins), then the broader portfolio_snapshots fallback SECOND, which
// only fills whatever gaps are left over and skips any day whose raw swing
// looks like a composition change rather than real movement (both passes
// already refuse to overwrite an existing day, so running them in the
// other order would be wrong — the weaker source could claim a day first).
// Both are bounded to start from MIN_BACKFILL_DATE (2026-08-01).
//
// Add ?reset=true to wipe every existing row for every user FIRST, then
// rebuild from scratch — use this to fix any earlier/inconsistent data
// (including a bad live-cron reading from before portfolioAlertCron.ts's
// sanity guardrail existed) rather than layering a new backfill on top of
// values that might already be wrong. Today's own row is unaffected either
// way: the live cron rewrites it every 5 minutes regardless of what a
// reset does to it.
//
//   curl -X POST "https://api.investry.app/api/admin/backfill-daily-changes?reset=true" \
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
    const reset = req.query.reset === "true" ? await resetDailyChangeHistory() : null;
    const metals = await backfillDailyChanges();
    const snapshots = await backfillDailyChangesFromSnapshots();
    res.json({
      success: true,
      reset,
      daysWritten: metals.daysWritten + snapshots.daysWritten,
      metals,
      snapshotsFallback: snapshots,
    });
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
  const userIdParam = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
  if (!email && !userIdParam) {
    res.status(400).json({ error: "email or userId query param is required" });
    return;
  }

  try {
    let userId = userIdParam;
    if (!userId) {
      const { data: clerkUsers } = await clerkClient.users.getUserList({ emailAddress: [email] });
      if (clerkUsers.length === 0) {
        res.status(404).json({ error: "No Clerk user with that email" });
        return;
      }
      userId = clerkUsers[0].id;
    }

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

// Diagnostic dump of the full computed leaderboard (id/pctReturn/rank), for
// verifying a reported pattern (e.g. "most users show the same %") against
// real output instead of guessing at the cause.
//
//   curl "https://api.investry.app/api/admin/leaderboard-debug?period=week" \
//     -H "x-admin-secret: <the secret>"
router.get("/admin/leaderboard-debug", async (req, res) => {
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
    const period = req.query.period === "month" ? "month" : "week";
    const ranked = await computeRankedReturns(period);
    res.json({ period, count: ranked.length, ranked });
  } catch (err) {
    req.log.error({ err }, "GET /admin/leaderboard-debug failed");
    res.status(500).json({ error: "Lookup failed" });
  }
});

// Full dump of every user's daily_change_snapshots history, with a display
// name attached (batch Clerk lookup, same helper the leaderboard uses) so
// it's readable without cross-referencing raw ids by hand.
//
//   curl "https://api.investry.app/api/admin/all-daily-changes" \
//     -H "x-admin-secret: <the secret>"
router.get("/admin/all-daily-changes", async (req, res) => {
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
    const rows = await db
      .select({ userId: dailyChangeSnapshotsTable.userId, date: dailyChangeSnapshotsTable.date, pctReturn: dailyChangeSnapshotsTable.pctReturn })
      .from(dailyChangeSnapshotsTable)
      .orderBy(asc(dailyChangeSnapshotsTable.userId), asc(dailyChangeSnapshotsTable.date));

    const userIds = [...new Set(rows.map(r => r.userId))];
    const identities = await fetchIdentities(userIds);

    const byUser = new Map<string, { userId: string; name: string; days: { date: string; pctReturn: number }[] }>();
    for (const r of rows) {
      if (!byUser.has(r.userId)) {
        byUser.set(r.userId, { userId: r.userId, name: identities.get(r.userId)?.name ?? "?", days: [] });
      }
      byUser.get(r.userId)!.days.push({ date: r.date, pctReturn: r.pctReturn });
    }

    res.json({ userCount: byUser.size, rowCount: rows.length, users: [...byUser.values()] });
  } catch (err) {
    req.log.error({ err }, "GET /admin/all-daily-changes failed");
    res.status(500).json({ error: "Lookup failed" });
  }
});

export default router;
