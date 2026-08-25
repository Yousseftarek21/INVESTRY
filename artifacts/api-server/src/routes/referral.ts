import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable, holdingsTable, cashAccountsTable } from "@workspace/db";
import { and, eq, count, isNull, isNotNull, gte, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import { fetchIdentities, FALLBACK_NAME } from "../lib/clerkIdentity";
import { utcMonthStart } from "../lib/calendarDate";

const router: IRouter = Router();

// Require a valid Clerk session for all referral routes
router.use("/referral", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// Unambiguous alphabet — no 0/O/1/I/L to avoid misread codes.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

async function ensureUserRow(userId: string): Promise<void> {
  await db.insert(usersTable).values({ id: userId }).onConflictDoNothing();
}

async function getOrCreateReferralCode(userId: string): Promise<string> {
  const [existing] = await db
    .select({ referralCode: usersTable.referralCode })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, userId));
      return code;
    } catch (err: unknown) {
      const isUniqueViolation = (err as { code?: string })?.code === "23505";
      if (!isUniqueViolation) throw err;
      // collision on the unique referral_code — retry with a new code
    }
  }
  throw new Error("Failed to generate a unique referral code");
}

// GET /api/referral — the current user's referral code, share link, and progress
router.get("/referral", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    await ensureUserRow(userId);
    const code = await getOrCreateReferralCode(userId);

    const [{ value: referredCount }] = await db
      .select({ value: count() })
      .from(usersTable)
      .where(eq(usersTable.referredByUserId, userId));

    const [self] = await db
      .select({ proCreditExpiresAt: usersTable.proCreditExpiresAt, referredByUserId: usersTable.referredByUserId })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    res.json({
      code,
      // investry.app has no server behind it yet (no real deep-link/redirect
      // page exists there) — point to the real App Store listing instead so
      // the shared link actually goes somewhere; the code itself is what the
      // friend enters in the app's own redeem field after installing.
      link: `https://apps.apple.com/app/id6787447052`,
      referredCount: Number(referredCount ?? 0),
      proCreditExpiresAt: self?.proCreditExpiresAt ?? null,
      hasRedeemed: Boolean(self?.referredByUserId),
    });
  } catch (err) {
    req.log.error({ err }, "GET /referral failed");
    res.status(500).json({ error: "Failed to load referral info" });
  }
});

// POST /api/referral/redeem — a new user redeems a friend's code, one time only.
// Grants the referrer +1 month of bonus Pro time (stacks on top of any unused credit).
router.post("/referral/redeem", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  const rawCode = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!rawCode) { res.status(400).json({ error: "code is required" }); return; }

  try {
    await ensureUserRow(userId);

    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (me?.referredByUserId) {
      res.status(409).json({ error: "A referral code has already been redeemed on this account" });
      return;
    }

    const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, rawCode));
    if (!referrer) { res.status(404).json({ error: "Invalid referral code" }); return; }
    if (referrer.id === userId) {
      res.status(400).json({ error: "You can't redeem your own referral code" });
      return;
    }

    // Both sides get a free month — the referrer for inviting, and the
    // redeemer for joining, matching what the invite screen promises
    // ("you both get a free month of Pro").
    const now = new Date();
    const referrerBase = referrer.proCreditExpiresAt && referrer.proCreditExpiresAt > now ? referrer.proCreditExpiresAt : now;
    const referrerNewExpiry = new Date(referrerBase);
    referrerNewExpiry.setMonth(referrerNewExpiry.getMonth() + 1);

    const meBase = me?.proCreditExpiresAt && me.proCreditExpiresAt > now ? me.proCreditExpiresAt : now;
    const meNewExpiry = new Date(meBase);
    meNewExpiry.setMonth(meNewExpiry.getMonth() + 1);

    // The "already redeemed?" check above reads the row, but two network
    // round-trips pass before anything is written — so two requests fired
    // together both saw referredByUserId as null, both passed, and both
    // granted a month. Firing the same redeem twice was free credit.
    //
    // The claim is now the guard: isNull() makes the redeemer's UPDATE match
    // only while the row is still unclaimed, so exactly one of any number of
    // racing requests updates a row. The earlier check stays as the fast,
    // friendly path for the ordinary case; this is what actually enforces it.
    const claimed = await db.transaction(async (tx) => {
      const rows = await tx.update(usersTable).set({
        referredByUserId: referrer.id,
        referralRedeemedAt: now,
        proCreditExpiresAt: meNewExpiry,
        updatedAt: new Date(),
      })
        .where(and(eq(usersTable.id, userId), isNull(usersTable.referredByUserId)))
        .returning({ id: usersTable.id });

      // Lost the race — leave the referrer's credit alone and roll back.
      if (rows.length === 0) return false;

      await tx.update(usersTable)
        .set({ proCreditExpiresAt: referrerNewExpiry, updatedAt: new Date() })
        .where(eq(usersTable.id, referrer.id));
      return true;
    });

    if (!claimed) {
      res.status(409).json({ error: "A referral code has already been redeemed on this account" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "POST /referral/redeem failed");
    res.status(500).json({ error: "Failed to redeem referral code" });
  }
});

const REFERRAL_TOP_N = 50;

interface ReferralRanked {
  userId: string; name: string; imageUrl: string | null;
  referredCount: number; rank: number; isMe: boolean;
}

// GET /api/referral/leaderboard?period=month|all — ranks users by how many
// people they've referred, gated by a LIVE "real activity" check: a referred
// user only counts once they have at least one real holding OR one real
// cash account — either is a genuine sign this is a real, used account, not
// just a fake signup redeeming a code for the free Pro month. Re-evaluated
// every request, not a one-time flag set at redemption — a friend who signs
// up today and adds their first holding/cash account next week becomes
// eligible the moment that write happens, no backfill needed, and drops
// back out again if they ever delete their only one. Without this gate a
// cash prize for "most referrals" would immediately incentivize registering
// fake accounts that never touch the app.
//
// period=month uses referralRedeemedAt (NOT createdAt — someone can create
// an account, then redeem a friend's code later, so the two can differ)
// compared against utcMonthStart(), the same true-calendar-month boundary
// the portfolio leaderboard's own "month" period now uses too (see
// calendarDate.ts) — one definition of "what month is it" shared across
// both features, not two that can quietly disagree.
router.get("/referral/leaderboard", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const period = req.query.period === "all" ? "all" : "month";
    const monthStart = utcMonthStart();

    const rows = await db
      .select({ referrerId: usersTable.referredByUserId, referredCount: count() })
      .from(usersTable)
      .where(and(
        isNotNull(usersTable.referredByUserId),
        period === "month" ? gte(usersTable.referralRedeemedAt, monthStart) : undefined,
        sql`(
          EXISTS (SELECT 1 FROM ${holdingsTable} WHERE ${holdingsTable.userId} = ${usersTable.id})
          OR EXISTS (SELECT 1 FROM ${cashAccountsTable} WHERE ${cashAccountsTable.userId} = ${usersTable.id})
        )`,
      ))
      .groupBy(usersTable.referredByUserId)
      .orderBy(desc(count()));

    const withCounts = rows
      .filter((r): r is { referrerId: string; referredCount: number } => r.referrerId != null)
      .map((r, i) => ({ id: r.referrerId, referredCount: r.referredCount, rank: i + 1 }));

    const top = withCounts.slice(0, REFERRAL_TOP_N);
    const meRow = withCounts.find(r => r.id === userId) ?? null;

    // Only fetch identities for ids actually displayed (top N + me, at most
    // 51) — never the full referrer list, which stays well under Clerk's
    // 500-id batch cap regardless of how many total referrers exist.
    const idsToFetch = [...new Set([...top.map(u => u.id), ...(meRow ? [meRow.id] : [])])];
    const identities = await fetchIdentities(idsToFetch);

    const toEntry = (u: { id: string; referredCount: number; rank: number }): ReferralRanked => {
      const identity = identities.get(u.id) ?? { name: FALLBACK_NAME, imageUrl: null };
      return { userId: u.id, name: identity.name, imageUrl: identity.imageUrl, referredCount: u.referredCount, rank: u.rank, isMe: u.id === userId };
    };

    res.json({
      period,
      periodStart: period === "month" ? monthStart.toISOString() : null,
      top: top.map(toEntry),
      me: meRow ? toEntry(meRow) : null,
    });
  } catch (err) {
    req.log.error({ err }, "GET /referral/leaderboard failed");
    res.status(500).json({ error: "Failed to load the referral leaderboard" });
  }
});

export default router;
