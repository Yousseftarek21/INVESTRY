import { Router, type IRouter } from "express";

const router: IRouter = Router();

// GET /api/config — public, non-secret client configuration. The Clerk
// publishable key is designed to be shipped in client bundles (it is not
// a secret), so exposing it here lets native builds (which can't read
// Replit's server-side env vars directly) fetch the exact key/proxy URL
// the currently-running server instance is configured with. This avoids
// dev/production Clerk key mismatches between the mobile app and API.
//
// IMPORTANT: Never derive the proxy URL from req.get("host").
// When the Expo web preview calls this endpoint, the Host header is the
// Expo bundler tunnel domain (*.expo.janeway.replit.dev), which is a
// separate subdomain that does NOT route /api/* to the API server.
// Clerk would then fail to load its script from that domain.
// Instead we read well-known Replit env vars to get the correct host:
//   - REPLIT_DOMAINS  → comma-separated production domains (set at deploy)
//   - REPLIT_DEV_DOMAIN → the workspace dev proxy domain (set in dev)
// Both of those share the same reverse-proxy routing that handles /api/__.
router.get("/config", (req, res) => {
  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? null;

  // The Clerk proxy middleware only runs in production (NODE_ENV === "production").
  // Mirror that exact condition here so we never hand the client a proxy URL
  // that points at a disabled middleware — which causes Clerk JS 404s on web.
  // In dev, returning null lets Clerk load its script from the CDN directly.
  const isProduction = process.env.NODE_ENV === "production";
  const deployedDomain = process.env.REPLIT_DOMAINS?.split(",")[0];

  const clerkProxyUrl =
    isProduction && clerkPublishableKey && deployedDomain
      ? `https://${deployedDomain}/api/__clerk`
      : null;

  res.json({ clerkPublishableKey, clerkProxyUrl });
});

export default router;
