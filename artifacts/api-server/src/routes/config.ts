import { Router, type IRouter } from "express";

const router: IRouter = Router();

// GET /api/config — public, non-secret client configuration. The Clerk
// publishable key is designed to be shipped in client bundles (it is not
// a secret), so exposing it here lets native builds (which can't read the
// server's env vars directly) fetch the exact key/proxy URL the
// currently-running server instance is configured with. This avoids
// dev/production Clerk key mismatches between the mobile app and API.
//
// IMPORTANT: Never derive the proxy URL from req.get("host") — use
// PUBLIC_APP_URL instead, since Expo's web preview and other tunneled
// hosts don't route /api/* to this server.
router.get("/config", (req, res) => {
  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? null;

  // The Clerk proxy middleware only runs in production (NODE_ENV === "production").
  // Mirror that exact condition here so we never hand the client a proxy URL
  // that points at a disabled middleware — which causes Clerk JS 404s on web.
  // In dev, returning null lets Clerk load its script from the CDN directly.
  const isProduction = process.env.NODE_ENV === "production";
  const deployedDomain = process.env.PUBLIC_APP_URL;

  const clerkProxyUrl =
    isProduction && clerkPublishableKey && deployedDomain
      ? `${deployedDomain}/api/__clerk`
      : null;

  res.json({ clerkPublishableKey, clerkProxyUrl });
});

export default router;
