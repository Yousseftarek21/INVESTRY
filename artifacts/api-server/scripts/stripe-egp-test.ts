// Stripe TEST-MODE check of the website checkout, using the same code the
// server runs (lib/stripePrices.ts). Refuses to run with a live key.
//
//   1. Put a test secret key in artifacts/api-server/.env.stripe-test:
//        STRIPE_SECRET_KEY=sk_test_...
//   2. pnpm --dir artifacts/api-server exec tsx scripts/stripe-egp-test.ts create [monthly|annual]
//      → prints a Checkout URL; pay with Stripe's test card 4242 4242 4242 4242
//   3. pnpm --dir artifacts/api-server exec tsx scripts/stripe-egp-test.ts verify <session id>
//      → checks the subscription is active, in EGP, and tagged with the app account
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { egpPriceId, EGP_PRICES } from "../src/lib/stripePrices";

const envFile = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.stripe-test");
const key = readFileSync(envFile, "utf8").match(/^STRIPE_SECRET_KEY=(\S+)/m)?.[1];
if (!key) throw new Error(`No STRIPE_SECRET_KEY in ${envFile}`);
if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) throw new Error("Not a test key — this script only runs in Stripe test mode.");
const stripe = new Stripe(key);

const TEST_USER = "user_stripe_egp_test";

async function create(period: "monthly" | "annual") {
  const priceId = await egpPriceId(stripe, period);
  const price = await stripe.prices.retrieve(priceId);
  console.log(`price ${priceId}: ${price.unit_amount! / 100} ${price.currency.toUpperCase()} / ${price.recurring?.interval}`);
  // Same options as POST /api/stripe/create-checkout-session.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: "egp-test@investry.app",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { clerkUserId: TEST_USER } },
    success_url: "https://investry.app/?checkout=success",
    cancel_url: "https://investry.app/?checkout=cancelled",
  });
  console.log(`session ${session.id}`);
  console.log(`amount due ${session.amount_total! / 100} ${session.currency?.toUpperCase()}`);
  console.log(`URL ${session.url}`);
}

async function verify(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  const sub = session.subscription as Stripe.Subscription | null;
  const checks: [string, boolean, string][] = [
    ["checkout completed", session.status === "complete", String(session.status)],
    ["paid", session.payment_status === "paid", String(session.payment_status)],
    ["charged in EGP", session.currency === "egp", String(session.currency)],
    ["subscription active", sub?.status === "active", String(sub?.status)],
    ["tagged with the app account", sub?.metadata?.clerkUserId === TEST_USER, String(sub?.metadata?.clerkUserId)],
  ];
  const item = sub?.items.data[0]?.price;
  const expected = item?.recurring?.interval === "year" ? EGP_PRICES.annual : EGP_PRICES.monthly;
  checks.push(["price matches the website", item?.unit_amount === expected * 100, `${(item?.unit_amount ?? 0) / 100} EGP`]);
  // What stripeWebhook.ts would write for this subscription.
  const plan = sub?.status === "active" || sub?.status === "trialing" ? "pro" : "free";
  checks.push(["webhook would set plan = pro", plan === "pro", plan]);
  for (const [name, ok, got] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (${got})`);
  if (sub && process.argv.includes("--cancel")) {
    await stripe.subscriptions.cancel(sub.id);
    console.log("cancelled test subscription");
  }
}

// Read-only look at how the account presents itself on checkout and receipts.
async function account() {
  const acct = await stripe.accounts.retrieve();
  const bp = acct.business_profile ?? {};
  const sd = acct.settings?.dashboard;
  const pay = acct.settings?.payments;
  const brand = acct.settings?.branding;
  console.log(`account        ${acct.id} (${acct.type ?? "standard"})`);
  console.log(`country        ${acct.country}`);
  console.log(`currency       ${acct.default_currency?.toUpperCase()} (payouts)`);
  console.log(`name on checkout  ${bp.name ?? sd?.display_name ?? "(not set)"}`);
  console.log(`dashboard name ${sd?.display_name ?? "(not set)"}`);
  console.log(`website        ${bp.url ?? "(not set)"}`);
  console.log(`support email  ${bp.support_email ?? "(not set)"}`);
  console.log(`card statement ${pay?.statement_descriptor ?? "(not set)"}`);
  console.log(`logo / icon    ${brand?.logo ? "set" : "not set"} / ${brand?.icon ? "set" : "not set"}`);
  console.log(`charges        ${acct.charges_enabled ? "enabled" : "NOT enabled"}, payouts ${acct.payouts_enabled ? "enabled" : "NOT enabled"}`);
  const shopify = [bp.name, sd?.display_name, bp.url, pay?.statement_descriptor].some((v) => /shopify/i.test(String(v ?? "")));
  if (shopify) console.log("NOTE           this account is branded as Shopify — see the steps to rename it");
}

// Pays for a plan with Stripe's built-in test Visa (no checkout page), then
// runs the same checks as verify. Test mode only.
async function pay(period: "monthly" | "annual") {
  const priceId = await egpPriceId(stripe, period);
  const customer = await stripe.customers.create({ email: "egp-test@investry.app", payment_method: "pm_card_visa", invoice_settings: { default_payment_method: "pm_card_visa" } });
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    metadata: { clerkUserId: TEST_USER },
    expand: ["latest_invoice"],
  });
  const inv = sub.latest_invoice as Stripe.Invoice;
  const item = sub.items.data[0]?.price;
  const expected = period === "annual" ? EGP_PRICES.annual : EGP_PRICES.monthly;
  const plan = sub.status === "active" || sub.status === "trialing" ? "pro" : "free";
  const checks: [string, boolean, string][] = [
    ["invoice paid", inv?.status === "paid", String(inv?.status)],
    ["charged in EGP", inv?.currency === "egp", String(inv?.currency)],
    ["amount charged", inv?.amount_paid === expected * 100, `${(inv?.amount_paid ?? 0) / 100} EGP`],
    ["subscription active", sub.status === "active", sub.status],
    ["renews every", item?.recurring?.interval === (period === "annual" ? "year" : "month"), String(item?.recurring?.interval)],
    ["tagged with the app account", sub.metadata?.clerkUserId === TEST_USER, String(sub.metadata?.clerkUserId)],
    ["webhook would set plan = pro", plan === "pro", plan],
  ];
  for (const [name, ok, got] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (${got})`);
  const cancelled = await stripe.subscriptions.cancel(sub.id);
  console.log(`cancelled test subscription → status ${cancelled.status}; webhook would set plan = ${cancelled.status === "active" ? "pro" : "free"}`);
}

const [cmd, arg] = process.argv.slice(2);
(cmd === "account" ? account() : cmd === "pay" ? pay(arg === "annual" ? "annual" : "monthly") : cmd === "create" ? create(arg === "annual" ? "annual" : "monthly") : cmd === "verify" && arg ? verify(arg) : Promise.reject(new Error("usage: account | create [monthly|annual] | verify <session id> [--cancel]")))
  .catch((e) => { console.error(e.message ?? e); process.exit(1); });
