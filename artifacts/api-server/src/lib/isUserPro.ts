// Single place "is this user allowed to use Pro features" gets decided,
// server-side. `plan === "pro"` is the real, paid (or comped) subscription,
// written only by revenuecatWebhook.ts / stripeWebhook.ts / the
// DEV_PRO_EMAILS allowlist (routes/subscription.ts) — never touched here.
// `proCreditExpiresAt` is the referral program's "+1 month free Pro"
// reward (routes/referral.ts writes it, stacking on redemption) — it was
// being written correctly but never read anywhere that actually gates a
// feature, so redeeming a referral code has never unlocked anything. This
// is the fix: every server-side Pro check should go through this function
// instead of comparing `plan` directly, so referral credit and a real
// subscription both work the same way, everywhere, from one place.
export function isUserPro(
  user: { plan?: string | null; proCreditExpiresAt?: Date | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.plan === "pro") return true;
  if (user.proCreditExpiresAt && user.proCreditExpiresAt.getTime() > Date.now()) return true;
  return false;
}
