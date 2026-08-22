import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

// Public (not secret) SDK key from RevenueCat's dashboard: Project Settings
// > API Keys > Apple App Store. Safe to ship in the client bundle — same
// trust model as Stripe's publishable key.
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;

// Must match the Entitlement identifier created in the RevenueCat dashboard
// and attached to both the monthly and annual App Store products.
export const REVENUECAT_ENTITLEMENT_ID = 'investry_pro';

// Only iOS uses native IAP — required by App Store Guideline 3.1.1 for any
// app that unlocks paid digital features (see Paywall.tsx's own comment for
// the full history). Android/web keep the existing Stripe website-checkout
// flow, which isn't subject to that rule the same way. Also false whenever
// the API key hasn't been configured yet (RevenueCat/App Store Connect setup
// not done), so the Paywall can fail gracefully instead of crashing on a
// missing key.
export function isIOSIAPAvailable(): boolean {
  return Platform.OS === 'ios' && !!REVENUECAT_API_KEY_IOS;
}

let configuredForUser: string | null = null;

// Called once Clerk resolves the signed-in user (see _layout.tsx). Configures
// the SDK on first call, and re-logs-in on every subsequent user change (e.g.
// switching accounts without a full app restart) so RevenueCat's own
// app_user_id always matches the Clerk id the webhook keys `usersTable` by.
export function syncRevenueCatUser(clerkUserId: string | null): void {
  if (!isIOSIAPAvailable() || !clerkUserId || configuredForUser === clerkUserId) return;
  if (!configuredForUser) {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS!, appUserID: clerkUserId });
  } else {
    Purchases.logIn(clerkUserId).catch(() => null);
  }
  configuredForUser = clerkUserId;
}

export function clearRevenueCatUser(): void {
  if (!isIOSIAPAvailable() || !configuredForUser) return;
  Purchases.logOut().catch(() => null);
  configuredForUser = null;
}
