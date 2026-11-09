import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { EGP_PRICES, type Period } from "./stripePrices";

// Paymob (Egypt): website checkout in EGP with cards, Meeza, wallets and
// Apple Pay. Pro is sold as one-time passes — 1 month or 1 year — that
// extend users.proCreditExpiresAt, which isUserPro() and the app already
// treat as Pro. Wallets and cash can't auto-renew, so nothing here does.
const BASE = "https://accept.paymob.com";

export const PRO_MONTHS: Record<Period, number> = { monthly: 1, annual: 12 };

// Two ways to open Paymob's payment page: the Intention API + Unified
// Checkout (cards, wallets, Apple Pay on one page), or — when PAYMOB_IFRAME_ID
// is set — the older order + payment key + iFrame flow, for accounts where
// Unified Checkout isn't enabled yet. Both end in the same signed callback.
const useIframe = () => !!(process.env.PAYMOB_IFRAME_ID && process.env.PAYMOB_API_KEY);

export function paymobConfigured(): boolean {
  if (!process.env.PAYMOB_HMAC_SECRET || !integrationIds().length) return false;
  return useIframe() || !!(process.env.PAYMOB_SECRET_KEY && process.env.PAYMOB_PUBLIC_KEY);
}

function integrationIds(): number[] {
  return (process.env.PAYMOB_INTEGRATION_IDS ?? "")
    .split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
}

/** Starts a Paymob checkout and returns the hosted payment page URL. */
export async function createPaymobCheckout(opts: {
  userId: string; period: Period; email?: string; firstName?: string; lastName?: string; websiteUrl: string; apiUrl: string;
}): Promise<string> {
  const amountCents = EGP_PRICES[opts.period] * 100;
  const label = opts.period === "annual" ? "INVESTRY Pro — 1 year" : "INVESTRY Pro — 1 month";
  // Paymob requires billing details; only name/email matter for a digital pass.
  const billing = {
    first_name: opts.firstName || "INVESTRY", last_name: opts.lastName || "User",
    email: opts.email || "billing@investry.app", phone_number: "+200000000000",
    apartment: "NA", floor: "NA", street: "NA", building: "NA", city: "Cairo", country: "EG", state: "NA", postal_code: "NA",
  };
  // Unique per attempt; also carries who paid and for what, read back by the webhook.
  const reference = `${opts.userId}|${opts.period}|${randomBytes(6).toString("hex")}`;

  if (useIframe()) return createIframeCheckout(amountCents, label, billing, reference, opts.apiUrl);

  const res = await fetch(`${BASE}/v1/intention/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}` },
    body: JSON.stringify({
      amount: amountCents,
      currency: "EGP",
      payment_methods: integrationIds(),
      items: [{ name: label, amount: amountCents, description: label, quantity: 1 }],
      billing_data: billing,
      special_reference: reference,
      extras: { clerkUserId: opts.userId, period: opts.period },
      notification_url: `${opts.apiUrl}/api/paymob/webhook`,
      redirection_url: `${opts.websiteUrl}/?checkout=success`,
    }),
  });
  const body = (await res.json().catch(() => null)) as { client_secret?: string; detail?: string } | null;
  if (!res.ok || !body?.client_secret) throw new Error(`Paymob intention failed (${res.status}): ${body?.detail ?? "no client_secret"}`);
  return `${BASE}/unifiedcheckout/?publicKey=${encodeURIComponent(process.env.PAYMOB_PUBLIC_KEY!)}&clientSecret=${encodeURIComponent(body.client_secret)}`;
}

// Older flow: auth token → order (our reference as merchant_order_id) →
// payment key for the integration → Paymob-hosted iFrame page.
async function createIframeCheckout(amountCents: number, label: string, billing: Record<string, string>, reference: string, apiUrl: string): Promise<string> {
  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !json) throw new Error(`Paymob ${path} failed (${res.status}): ${JSON.stringify(json)?.slice(0, 200)}`);
    return json;
  };
  const { token } = await post("/api/auth/tokens", { api_key: process.env.PAYMOB_API_KEY }) as { token: string };
  const order = await post("/api/ecommerce/orders", {
    auth_token: token, delivery_needed: false, amount_cents: amountCents, currency: "EGP",
    merchant_order_id: reference, items: [{ name: label, amount_cents: amountCents, description: label, quantity: 1 }],
  }) as { id: number };
  const key = await post("/api/acceptance/payment_keys", {
    auth_token: token, amount_cents: amountCents, expiration: 3600, order_id: order.id, currency: "EGP",
    integration_id: integrationIds()[0], billing_data: { ...billing, shipping_method: "NA" },
    notification_url: `${apiUrl}/api/paymob/webhook`,
  }) as { token: string };
  return `${BASE}/api/acceptance/iframes/${encodeURIComponent(process.env.PAYMOB_IFRAME_ID!)}?payment_token=${encodeURIComponent(key.token)}`;
}

// The transaction-processed callback's signed fields, in Paymob's order
// (developers.paymob.com → Webhook callbacks and HMAC → Transaction callback).
const HMAC_FIELDS = [
  "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id",
  "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
  "is_voided", "order.id", "owner", "pending", "source_data.pan", "source_data.sub_type", "source_data.type", "success",
];

const pick = (obj: Record<string, unknown>, path: string): unknown =>
  path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), obj);

export function paymobHmac(obj: Record<string, unknown>, secret: string): string {
  const data = HMAC_FIELDS.map((f) => { const v = pick(obj, f); return v === undefined || v === null ? "" : String(v); }).join("");
  return createHmac("sha512", secret).update(data).digest("hex");
}

/** True only if the callback was really signed by Paymob with our HMAC secret. */
export function verifyPaymobHmac(obj: Record<string, unknown>, received: string | undefined): boolean {
  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret || !received) return false;
  const expected = Buffer.from(paymobHmac(obj, secret));
  const got = Buffer.from(received.toLowerCase());
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Who paid and for which plan, from the callback (extras first, then the reference). */
export function paymobBuyer(obj: Record<string, unknown>): { userId: string; period: Period } | null {
  const extra = pick(obj, "payment_key_claims.extra") as { clerkUserId?: string; period?: string } | undefined;
  let userId = extra?.clerkUserId;
  let period = extra?.period;
  if (!userId) {
    const ref = String(pick(obj, "order.merchant_order_id") ?? pick(obj, "special_reference") ?? "");
    [userId, period] = ref.split("|");
  }
  if (!userId) return null;
  return { userId, period: period === "annual" ? "annual" : "monthly" };
}
