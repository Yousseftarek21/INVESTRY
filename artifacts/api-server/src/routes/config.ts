import { Router, type IRouter } from "express";

const router: IRouter = Router();

// GET /api/config — public, non-secret client configuration. The Clerk
// publishable key is designed to be shipped in client bundles (it is not
// a secret), so exposing it here lets native builds (which can't read the
// server's env vars directly) fetch the exact key the currently-running
// server instance is configured with. This avoids dev/production Clerk
// key mismatches between the mobile app and API.
//
// No proxy URL is needed here: the Clerk instance has its own verified
// custom domain (Frontend API), which Clerk's SDKs reach directly using
// the domain encoded in the publishable key. The proxy (still available
// at CLERK_PROXY_PATH for web use if ever needed) was only a workaround
// for instances without a real custom domain.
router.get("/config", (req, res) => {
  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? null;

  res.json({ clerkPublishableKey, clerkProxyUrl: null });
});

export default router;
