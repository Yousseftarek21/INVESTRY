import { Router, type IRouter } from "express";
import { isNotNull, eq, asc, desc } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, usersTable, holdingsTable, cashAccountsTable, soldHoldingsTable, portfolioSnapshotsTable, dailyChangeSnapshotsTable, referralMonthlyWinnersTable } from "@workspace/db";
import { sendPushToTokens } from "../lib/expoPush";
import { backfillDailyChanges, backfillDailyChangesFromSnapshots, resetDailyChangeHistory } from "../lib/dailyChangeBackfill";
import { computeRankedReturns } from "../lib/leaderboardRanking";
import { fetchIdentities } from "../lib/clerkIdentity";
import { decryptFromStorage, encryptForStorage } from "../lib/encryption";
import { computeHoldingValue, costBasisEGP, type StoredHolding } from "../lib/portfolioValue";
import { getCachedPrices, getCachedStocks } from "./markets";

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

// Diagnostic for the referral system — real production proof it's actually
// working end to end (codes generated, redemptions landing, credit granted),
// not just that the code reviews clean.
//
//   curl "https://api.investry.app/api/admin/referral-debug" \
//     -H "x-admin-secret: <the secret>"
router.get("/admin/referral-debug", async (req, res) => {
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
      .select({
        id: usersTable.id,
        referralCode: usersTable.referralCode,
        referredByUserId: usersTable.referredByUserId,
        referralRedeemedAt: usersTable.referralRedeemedAt,
        proCreditExpiresAt: usersTable.proCreditExpiresAt,
      })
      .from(usersTable);

    const withCode = rows.filter(r => r.referralCode != null);
    const redeemed = rows.filter(r => r.referredByUserId != null);
    const withCredit = rows.filter(r => r.proCreditExpiresAt != null && r.proCreditExpiresAt > new Date());

    const byReferrer = new Map<string, number>();
    for (const r of redeemed) {
      if (!r.referredByUserId) continue;
      byReferrer.set(r.referredByUserId, (byReferrer.get(r.referredByUserId) ?? 0) + 1);
    }
    const topReferrers = [...byReferrer.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, referredCount]) => ({ userId, referredCount }));

    const identities = await fetchIdentities(topReferrers.map(r => r.userId));

    res.json({
      totalUsers: rows.length,
      usersWithCode: withCode.length,
      usersWhoRedeemed: redeemed.length,
      usersWithActiveProCredit: withCredit.length,
      topReferrers: topReferrers.map(r => ({ ...r, name: identities.get(r.userId)?.name ?? "?" })),
      // A handful of raw rows (redacted to referral fields only, same
      // metadata-not-content boundary as user-debug) — enough to sanity
      // check codes actually look like codes and timestamps are recent,
      // not to identify who's who beyond what topReferrers already shows.
      sampleRecentRedemptions: redeemed
        .filter(r => r.referralRedeemedAt != null)
        .sort((a, b) => (b.referralRedeemedAt!.getTime()) - (a.referralRedeemedAt!.getTime()))
        .slice(0, 5)
        .map(r => ({ referredByUserId: r.referredByUserId, referralRedeemedAt: r.referralRedeemedAt })),
    });
  } catch (err) {
    req.log.error({ err }, "GET /admin/referral-debug failed");
    res.status(500).json({ error: "Lookup failed" });
  }
});

// Full decrypted view of every user's holdings, cash accounts, and total
// portfolio value — everything Postico/a raw DB browser can't show, because
// holdings.data and cash_accounts.data are AES-256-GCM-encrypted at rest
// (see lib/encryption.ts) with a key that only lives in this server's own
// env, never in the database itself. Same admin-secret gate as every other
// route here, but this one is meaningfully more sensitive than the rest —
// it's every real user's real financial holdings in one response, not
// just metadata or aggregate counts. Treat the URL and the secret with the
// same care as a database credential: this exists for the app's own
// operator, never for sharing the response elsewhere.
//
//   curl "https://api.investry.app/api/admin/all-users-full" \
//     -H "x-admin-secret: <the secret>"
router.get("/admin/all-users-full", async (req, res) => {
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
    const [users, holdingRows, cashRows, prices, egxStocks] = await Promise.all([
      db.select({ id: usersTable.id }).from(usersTable),
      db.select().from(holdingsTable),
      db.select().from(cashAccountsTable),
      getCachedPrices(),
      getCachedStocks().catch(() => []),
    ]);

    const egxPrices: Record<string, number> = {};
    for (const s of egxStocks) egxPrices[s.symbol] = s.price;

    // Real email, not just the display name fetchIdentities gives — this
    // view is for finding a specific person by their actual account, not
    // just showing a leaderboard-style label.
    const clerkUsers = await clerkClient.users.getUserList({ userId: users.map(u => u.id), limit: users.length || 1 });
    const emailById = new Map(clerkUsers.data.map(cu => [cu.id, cu.emailAddresses?.[0]?.emailAddress ?? null]));
    const nameById = new Map(clerkUsers.data.map(cu => [cu.id, [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim() || null]));

    interface HoldingEntry extends StoredHolding {
      currentValueEgp: number;
      amountInvestedEgp: number;
      createdAt: Date;
      updatedAt: Date;
    }
    const holdingsByUser = new Map<string, HoldingEntry[]>();
    for (const row of holdingRows) {
      const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
      const currentValueEgp = computeHoldingValue(holding, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices);
      const amountInvestedEgp = costBasisEGP(holding, prices.usdToEgp);
      const entry: HoldingEntry = { ...holding, currentValueEgp, amountInvestedEgp, createdAt: row.createdAt, updatedAt: row.updatedAt };
      const list = holdingsByUser.get(row.userId) ?? [];
      list.push(entry);
      holdingsByUser.set(row.userId, list);
    }

    const cashByUser = new Map<string, unknown[]>();
    for (const row of cashRows) {
      const account = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object), createdAt: row.createdAt, updatedAt: row.updatedAt };
      const list = cashByUser.get(row.userId) ?? [];
      list.push(account);
      cashByUser.set(row.userId, list);
    }

    const result = users.map(u => {
      const holdings = holdingsByUser.get(u.id) ?? [];
      const totalPortfolioValueEgp = holdings.reduce((sum, h) => sum + h.currentValueEgp, 0);
      const totalAmountInvestedEgp = holdings.reduce((sum, h) => sum + h.amountInvestedEgp, 0);
      return {
        userId: u.id,
        name: nameById.get(u.id) ?? null,
        email: emailById.get(u.id) ?? null,
        totalPortfolioValueEgp,
        totalAmountInvestedEgp,
        holdingsCount: holdings.length,
        holdings,
        cashAccounts: cashByUser.get(u.id) ?? [],
      };
    });

    res.json({ userCount: result.length, users: result });
  } catch (err) {
    req.log.error({ err }, "GET /admin/all-users-full failed");
    res.status(500).json({ error: "Lookup failed" });
  }
});

// One-time (safely re-runnable) migration: renames the persisted
// sold_holdings field from costBasis to amountInvested (matching the
// user-facing costBasisLabel string, "Amount Invested", that's shown
// everywhere in the app — this makes it the field's real name, not just a
// display label). computePeriodPerformance already reads amountInvested
// with a fallback to the old costBasis key, so this migration isn't
// required for correctness — it's for making every existing record
// consistent with new ones instead of leaving old rows on the old name
// forever. Decrypts each row, renames the key if present, re-encrypts, and
// writes back only if something actually changed; already-migrated or
// otherwise-shaped rows are left untouched and don't count as errors.
//
//   curl -X POST "https://api.investry.app/api/admin/migrate-cost-basis-field" \
//     -H "x-admin-secret: <the secret>"
router.post("/admin/migrate-cost-basis-field", async (req, res) => {
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
    const rows = await db.select().from(soldHoldingsTable);
    let migrated = 0;
    for (const row of rows) {
      const data = decryptFromStorage(row.data) as Record<string, unknown>;
      if (!("costBasis" in data)) continue; // already migrated, or never had the field
      const { costBasis, ...rest } = data;
      const renamed = "amountInvested" in rest ? rest : { ...rest, amountInvested: costBasis };
      await db.update(soldHoldingsTable).set({ data: encryptForStorage(renamed) }).where(eq(soldHoldingsTable.id, row.id));
      migrated++;
    }
    res.json({ success: true, totalRows: rows.length, migrated });
  } catch (err) {
    req.log.error({ err }, "POST /admin/migrate-cost-basis-field failed");
    res.status(500).json({ error: "Migration failed" });
  }
});

// Lists every crowned referral-monthly-prize winner (see
// referralMonthlyWinnerCron.ts and referralMonthlyWinnersTable's own
// comment) — the record an operator actually needs to know who to pay each
// month, newest first. A row with an empty userId means no one had a real
// referral that month (the cron still writes a row so it doesn't rescan
// every 6h for the rest of the month).
//
//   curl "https://api.investry.app/api/admin/referral-winners" \
//     -H "x-admin-secret: <the secret>"
router.get("/admin/referral-winners", async (req, res) => {
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
      .select()
      .from(referralMonthlyWinnersTable)
      .orderBy(desc(referralMonthlyWinnersTable.month));

    const ids = rows.filter(r => r.userId).map(r => r.userId);
    const identities = await fetchIdentities(ids);

    res.json(rows.map(r => ({
      month: r.month,
      userId: r.userId || null,
      name: r.userId ? (identities.get(r.userId)?.name ?? "?") : null,
      referredCount: r.referredCount,
      notifiedAt: r.notifiedAt,
      paidAt: r.paidAt,
    })));
  } catch (err) {
    req.log.error({ err }, "GET /admin/referral-winners failed");
    res.status(500).json({ error: "Lookup failed" });
  }
});

// Marks a month's winner as paid — purely a record-keeping flag for the
// operator (prize fulfillment itself is manual/off-app, there's no in-app
// payout), so a repeat check of /admin/referral-winners shows who's already
// been handled.
//
//   curl -X POST "https://api.investry.app/api/admin/referral-winners/2026-08-01/mark-paid" \
//     -H "x-admin-secret: <the secret>"
router.post("/admin/referral-winners/:month/mark-paid", async (req, res) => {
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
    const updated = await db
      .update(referralMonthlyWinnersTable)
      .set({ paidAt: new Date() })
      .where(eq(referralMonthlyWinnersTable.month, req.params.month))
      .returning({ id: referralMonthlyWinnersTable.id });
    if (updated.length === 0) {
      res.status(404).json({ error: "No winner record for that month" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "POST /admin/referral-winners/:month/mark-paid failed");
    res.status(500).json({ error: "Update failed" });
  }
});

export default router;
