import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Require a valid Clerk session for this route
router.use("/subscription", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/subscription — the single source of truth the client reads
// entitlement from everywhere (PremiumGate, analytics, holding limits,
// etc.). Real subscription state, kept in sync by stripeWebhook.ts — the
// mobile app never talks to Stripe directly, it only ever reads this.
//
// `betaUnlockAll` is a separate, temporary escape hatch for the beta
// period: it bypasses feature *gates* only. It deliberately does not touch
// `plan` — beta users still genuinely show as Free (no Pro badge, no fake
// entitlement), and real paid test accounts still show their real `plan`
// via the actual Stripe-synced value. Flip BETA_UNLOCK_ALL off in Render's
// env vars when ready for launch; no code change needed.
router.get("/subscription", async (req, res) => {
  const { userId } = getAuth(req);

  const [user] = await db
    .select({ plan: usersTable.plan, billingPeriod: usersTable.billingPeriod })
    .from(usersTable)
    .where(eq(usersTable.id, userId!));

  res.json({
    plan: user?.plan === "pro" ? "pro" : "free",
    billingPeriod: user?.billingPeriod ?? "monthly",
    betaUnlockAll: process.env.BETA_UNLOCK_ALL === "true",
  });
});

export default router;
