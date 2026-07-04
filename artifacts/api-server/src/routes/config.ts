import { Router, type IRouter } from "express";

const router: IRouter = Router();

// GET /api/config — public, non-secret client configuration. The Clerk
// publishable key is designed to be shipped in client bundles (it is not
// a secret), so exposing it here lets native builds (which can't read
// Replit's server-side env vars directly) fetch the exact key/proxy URL
// the currently-running server instance is configured with. This avoids
// dev/production Clerk key mismatches between the mobile app and API.
router.get("/config", (req, res) => {
  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? null;
  const host = req.get("host");
  const clerkProxyUrl = clerkPublishableKey && host
    ? `${req.protocol}://${host}/api/__clerk`
    : null;

  res.json({ clerkPublishableKey, clerkProxyUrl });
});

export default router;
