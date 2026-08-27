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
// Bumped by hand alongside app.json's own "version" whenever a new native
// build (not an OTA update) actually ships — comparing this against
// Constants.nativeApplicationVersion, which reads the installed binary's own
// Info.plist/AndroidManifest and is NOT affected by an OTA update, is what
// lets the app tell "an old binary" apart from "just hasn't pulled the
// latest JS yet". Constants.expoConfig?.version would be wrong for this: an
// OTA update can freely rewrite that value without the binary itself having
// changed at all.
const LATEST_APP_VERSION = "1.0.4";
// App Store Connect's numeric app id (eas.json's own submit.production.ios.ascAppId)
// and the Android package name (app.json's android.package) — both already
// fixed identifiers elsewhere in this project, not new values invented here.
const IOS_APP_STORE_ID = "6787447052";
const ANDROID_PACKAGE = "com.investry.app";

router.get("/config", (req, res) => {
  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? null;

  res.json({
    clerkPublishableKey,
    clerkProxyUrl: null,
    latestAppVersion: LATEST_APP_VERSION,
    iosAppStoreId: IOS_APP_STORE_ID,
    androidPackage: ANDROID_PACKAGE,
  });
});

export default router;
