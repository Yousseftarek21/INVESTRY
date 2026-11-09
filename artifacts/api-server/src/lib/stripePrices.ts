import type Stripe from "stripe";
import { logger } from "./logger";

// Website checkout charges in Egyptian pounds, at the same prices the app
// shows. The two Prices are found by lookup key and created on first use if
// missing, so test mode and live mode each set themselves up — no price IDs
// to copy between the Stripe dashboard and Render.
export type Period = "monthly" | "annual";

const AMOUNT_EGP: Record<Period, number> = {
  monthly: Number(process.env.STRIPE_EGP_MONTHLY) || 99,
  annual: Number(process.env.STRIPE_EGP_ANNUAL) || 799,
};
const LOOKUP_KEY: Record<Period, string> = {
  monthly: `investry_pro_monthly_egp_${AMOUNT_EGP.monthly}`,
  annual: `investry_pro_annual_egp_${AMOUNT_EGP.annual}`,
};
const PRODUCT_NAME = "INVESTRY Pro";

const cache = new Map<string, string>();

async function findOrCreateProduct(stripe: Stripe): Promise<string> {
  const found = await stripe.products.search({ query: `name:'${PRODUCT_NAME}' AND active:'true'`, limit: 1 }).catch(() => null);
  if (found?.data[0]) return found.data[0].id;
  const product = await stripe.products.create({ name: PRODUCT_NAME, description: "Unlimited investments, AI assistant, alerts and full analytics." });
  return product.id;
}

/** The EGP Price for a plan, created once per Stripe mode if it doesn't exist yet. */
export async function egpPriceId(stripe: Stripe, period: Period): Promise<string> {
  const key = LOOKUP_KEY[period];
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  if (existing.data[0]) {
    cache.set(key, existing.data[0].id);
    return existing.data[0].id;
  }

  const price = await stripe.prices.create({
    product: await findOrCreateProduct(stripe),
    currency: "egp",
    unit_amount: AMOUNT_EGP[period] * 100, // piastres
    recurring: { interval: period === "annual" ? "year" : "month" },
    lookup_key: key,
    nickname: `Pro ${period} (EGP)`,
  });
  logger.info({ period, priceId: price.id }, "Created EGP Stripe price");
  cache.set(key, price.id);
  return price.id;
}

export const EGP_PRICES = AMOUNT_EGP;
