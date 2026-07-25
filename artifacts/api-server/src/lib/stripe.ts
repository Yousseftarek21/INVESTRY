import Stripe from "stripe";

// Constructed lazily, on first actual use — never at module import time.
// Stripe's SDK throws immediately if the key is empty, and this file gets
// imported unconditionally at server startup regardless of whether Stripe
// env vars are configured yet; constructing eagerly took the entire API
// down at boot once already.
let _stripe: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}
