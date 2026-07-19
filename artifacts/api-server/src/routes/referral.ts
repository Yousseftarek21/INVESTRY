import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import crypto from "crypto";

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
      link: `https://investry.app/invite/${code}`,
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

    const now = new Date();
    const base = referrer.proCreditExpiresAt && referrer.proCreditExpiresAt > now ? referrer.proCreditExpiresAt : now;
    const newExpiry = new Date(base);
    newExpiry.setMonth(newExpiry.getMonth() + 1);

    await db.transaction(async (tx) => {
      await tx.update(usersTable).set({ referredByUserId: referrer.id, updatedAt: new Date() }).where(eq(usersTable.id, userId));
      await tx.update(usersTable).set({ proCreditExpiresAt: newExpiry, updatedAt: new Date() }).where(eq(usersTable.id, referrer.id));
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "POST /referral/redeem failed");
    res.status(500).json({ error: "Failed to redeem referral code" });
  }
});

export default router;
