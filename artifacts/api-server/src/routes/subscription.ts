import { Router, type IRouter } from "express";
import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Require a valid Clerk session for this route
router.use("/subscription", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// Permanent free Pro access for the app owner's own accounts and QA/test
// accounts — set DEV_PRO_EMAILS on Render to a comma-separated list.
// `usersTable.email` is never synced from Clerk (nothing writes to it), so
// this looks the email up live from Clerk instead. Runs at most once per
// account: the first match persists `plan: "pro"` to the DB, so every
// later request skips straight past this (plan is already "pro") with no
// repeated Clerk lookups.
async function grantDevProIfListed(userId: string): Promise<void> {
  const allowlist = (process.env.DEV_PRO_EMAILS ?? "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length === 0) return;

  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const emails = clerkUser.emailAddresses.map(e => e.emailAddress.toLowerCase());
    if (!emails.some(e => allowlist.includes(e))) return;

    await db.insert(usersTable).values({ id: userId, plan: "pro" })
      .onConflictDoUpdate({ target: usersTable.id, set: { plan: "pro" } });
  } catch (err) {
    logger.warn({ err, userId }, "DEV_PRO_EMAILS lookup failed");
  }
}

// GET /api/subscription — the single source of truth the client reads
// entitlement from everywhere (PremiumGate, analytics, holding limits,
// etc.). Real subscription state, kept in sync by stripeWebhook.ts and
// revenuecatWebhook.ts — the mobile app never talks to Stripe/RevenueCat's
// backend directly, it only ever reads this.
//
// `betaUnlockAll` is a separate, temporary escape hatch for the beta
// period: it bypasses feature *gates* only. It deliberately does not touch
// `plan` — beta users still genuinely show as Free (no Pro badge, no fake
// entitlement), and real paid test accounts still show their real `plan`
// via the actual Stripe/RevenueCat-synced value. Flip BETA_UNLOCK_ALL off in
// Render's env vars when ready for launch; no code change needed.
router.get("/subscription", async (req, res) => {
  const { userId } = getAuth(req);

  let [user] = await db
    .select({ plan: usersTable.plan, billingPeriod: usersTable.billingPeriod })
    .from(usersTable)
    .where(eq(usersTable.id, userId!));

  if (user?.plan !== "pro") {
    await grantDevProIfListed(userId!);
    [user] = await db
      .select({ plan: usersTable.plan, billingPeriod: usersTable.billingPeriod })
      .from(usersTable)
      .where(eq(usersTable.id, userId!));
  }

  res.json({
    plan: user?.plan === "pro" ? "pro" : "free",
    billingPeriod: user?.billingPeriod ?? "monthly",
    betaUnlockAll: process.env.BETA_UNLOCK_ALL === "true",
  });
});

export default router;
