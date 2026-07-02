import { getUncachableStripeClient } from "./stripeClient";

/**
 * Creates the INVESTRY Pro and Pro+ products/prices in Stripe.
 * Idempotent: checks for existing active products by name before creating.
 * Run with: pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */

const PLANS = [
  {
    name: "Investry Pro",
    planKey: "pro",
    description: "Unlimited investments, all tools & analytics",
    monthly: { amount: 4999, interval: "month" as const }, // 49.99 EGP
    annual: { amount: 39999, interval: "year" as const }, // 399.99 EGP
  },
  {
    name: "Investry Pro+",
    planKey: "pro_plus",
    description: "Everything in Pro + advanced charts, EGX real-time & export",
    monthly: { amount: 6999, interval: "month" as const }, // 69.99 EGP
    annual: { amount: 55999, interval: "year" as const }, // 559.99 EGP
  },
];

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `name:'${plan.name}' AND active:'true'`,
    });

    let product = existing.data[0];
    if (product) {
      console.log(`${plan.name} already exists (${product.id}), skipping product creation.`);
      if (product.metadata?.planKey !== plan.planKey) {
        await stripe.products.update(product.id, { metadata: { planKey: plan.planKey } });
      }
    } else {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { planKey: plan.planKey },
      });
      console.log(`Created product: ${product.name} (${product.id})`);
    }

    const existingPrices = await stripe.prices.list({ product: product.id, active: true });

    const existingMonthly = existingPrices.data.find(
      (p) => p.recurring?.interval === "month" && p.unit_amount === plan.monthly.amount,
    );
    const existingAnnual = existingPrices.data.find(
      (p) => p.recurring?.interval === "year" && p.unit_amount === plan.annual.amount,
    );
    const hasMonthly = Boolean(existingMonthly);
    const hasAnnual = Boolean(existingAnnual);

    if (existingMonthly && existingMonthly.metadata?.planKey !== plan.planKey) {
      await stripe.prices.update(existingMonthly.id, {
        metadata: { planKey: plan.planKey, billingPeriod: "monthly" },
      });
      console.log(`  Backfilled metadata on existing monthly price (${existingMonthly.id})`);
    }
    if (existingAnnual && existingAnnual.metadata?.planKey !== plan.planKey) {
      await stripe.prices.update(existingAnnual.id, {
        metadata: { planKey: plan.planKey, billingPeriod: "annual" },
      });
      console.log(`  Backfilled metadata on existing annual price (${existingAnnual.id})`);
    }

    if (!hasMonthly) {
      const monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthly.amount,
        currency: "egp",
        recurring: { interval: plan.monthly.interval },
        nickname: `${plan.name} Monthly`,
        metadata: { planKey: plan.planKey, billingPeriod: "monthly" },
      });
      console.log(`  Created monthly price: ${plan.monthly.amount / 100} EGP/month (${monthlyPrice.id})`);
    } else {
      console.log(`  Monthly price already exists, skipping.`);
    }

    if (!hasAnnual) {
      const annualPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.annual.amount,
        currency: "egp",
        recurring: { interval: plan.annual.interval },
        nickname: `${plan.name} Annual`,
        metadata: { planKey: plan.planKey, billingPeriod: "annual" },
      });
      console.log(`  Created annual price: ${plan.annual.amount / 100} EGP/year (${annualPrice.id})`);
    } else {
      console.log(`  Annual price already exists, skipping.`);
    }
  }

  console.log("Done. Webhooks will sync this data to the database automatically.");
}

createProducts().catch((err) => {
  console.error("Error creating products:", err.message);
  process.exit(1);
});
