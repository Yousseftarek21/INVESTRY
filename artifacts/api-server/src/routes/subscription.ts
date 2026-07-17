import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";

const router: IRouter = Router();

// Require a valid Clerk session for this route
router.use("/subscription", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/subscription — every signed-in user gets Pro, unconditionally.
// Stripe/IAP billing has been removed; this is the single source of truth
// the client reads entitlement from everywhere (PremiumGate, analytics,
// holding limits, etc.), so unlocking here unlocks the whole app.
router.get("/subscription", (req, res) => {
  res.json({ plan: "pro", billingPeriod: "monthly", status: "promo", launchAccess: true });
});

export default router;
