/**
 * SubscriptionContext — real Stripe-backed implementation.
 *
 * In development builds (`__DEV__`) all Pro features stay unlocked locally
 * so the developer never hits the paywall. In production builds, entitlement
 * is sourced from the backend (`GET /api/subscription`), which itself is the
 * authoritative record synced from Stripe via webhooks. AsyncStorage is only
 * used as a display cache — it is never trusted to grant entitlements.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '../utils/api';

// On web this app itself is often embedded in an iframe (e.g. the canvas
// preview). Stripe Checkout refuses to render inside ANY iframe (it sends
// frame-ancestors / X-Frame-Options headers to prevent clickjacking), so
// navigating the iframe's own location to the checkout URL silently fails —
// nothing visibly happens. It must be opened in a real top-level browser tab
// instead.
//
// Opening that tab has its own trap: `window.open` is only exempt from
// popup blockers when called *synchronously* inside the click's call stack.
// Since we need to `await` several requests (token, price lookup, checkout
// session creation) before we know the URL, opening the window after those
// awaits gets silently blocked. The fix is the standard workaround: open a
// blank tab synchronously (before any `await`), then point it at the real
// URL once we have it. `openWebPopup` must be called as the very first line
// of a click handler for this to work.
export function openWebPopup(): Window | null {
  return Platform.OS === 'web' ? window.open('', '_blank') : null;
}

async function openCheckoutUrl(
  url: string,
  redirectUrl: string,
  popup?: Window | null,
): Promise<{ type: 'success' | 'cancel' }> {
  if (Platform.OS === 'web') {
    if (popup && !popup.closed) {
      popup.location.href = url;
    } else {
      // Popup was blocked or unavailable — fall back to a same-tab
      // top-level redirect. If we're inside an iframe this still fails to
      // render Stripe's page, but it's the best available fallback.
      window.location.assign(url);
    }
    return { type: 'success' };
  }
  const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
  return { type: result.type === 'success' ? 'success' : 'cancel' };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'pro';
export type BillingPeriod = 'monthly' | 'annual';

export interface MockProduct {
  identifier: string;
  priceString: string;
  annualPriceString: string;
  price: number;
  annualPrice: number;
  annualSavingsPct: number;
  title: string;
  description: string;
}

export interface SubscriptionContextValue {
  plan: Plan;
  billingPeriod: BillingPeriod;
  isSubscribed: boolean;
  isPro: boolean;
  /**
   * Single source of truth for "Launch Access" mode. Sourced from the
   * backend (`GET /api/subscription`), which itself reads one env flag
   * (`FREE_ACCESS_PLAN`). All UI that needs to know whether purchases are
   * currently disabled (paywalls, upgrade buttons, manage-subscription
   * entry points) must read this flag from here — never re-derive it from
   * `plan` or duplicate the check elsewhere. Flipping the backend flag off
   * restores real Stripe/IAP purchase flows everywhere with no UI changes.
   */
  launchAccess: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  offerings: {
    pro: MockProduct;
  };
  purchase: (period: BillingPeriod, webPopup?: Window | null) => Promise<boolean>;
  restore: () => Promise<void>;
  manageSubscription: (webPopup?: Window | null) => Promise<void>;
  showPaywall: () => void;
  _devSetPlan: (plan: Plan) => void;
}

// ─── Offerings (display copy only — real price IDs come from the backend) ────

const OFFERINGS: SubscriptionContextValue['offerings'] = {
  pro: {
    identifier: 'pro',
    priceString: '49.99 EGP',
    annualPriceString: '399.99 EGP',
    price: 49.99,
    annualPrice: 399.99,
    annualSavingsPct: 33,
    title: 'Investry Pro',
    description: 'Unlimited investments, all tools & analytics, advanced charts, EGX real-time & export',
  },
};

/** Per-user AsyncStorage key — a display cache only, never a trust source. */
function subscriptionKey(userId: string) {
  return `@invstry_subscription_${userId}`;
}

// Historically, development builds force-unlocked Pro locally so the
// developer never hit the paywall. Now that the backend grants free Pro to
// every signed-in user via Launch Access (`FREE_ACCESS_PLAN`), that local
// override is redundant and actively harmful: it sets `plan='pro'` but
// skips the real `/api/subscription` fetch, so `launchAccess` never becomes
// true. That mismatch makes screens like Settings render the real
// "manage subscription" button instead of the non-interactive Launch Access
// badge, which then opens a blank Stripe-portal popup that silently no-ops.
// Keep this flag false so dev/preview always goes through the same fetch as
// production and reflects the real `launchAccess` state.
const DEV_UNLOCKED = false;

interface PriceCatalogEntry {
  priceId: string;
  plan: 'pro';
  billingPeriod: BillingPeriod;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

let _paywallCallback: (() => void) | null = null;
export function _registerPaywallCallback(cb: () => void) {
  _paywallCallback = cb;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = useAuth();
  const [plan, setPlan] = useState<Plan>('free');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [launchAccess, setLaunchAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const loadedUserRef = useRef<string | null>(null);

  const cachePlan = useCallback(async (uid: string, p: Plan, bp: BillingPeriod, la?: boolean) => {
    await AsyncStorage.setItem(subscriptionKey(uid), JSON.stringify({ plan: p, billingPeriod: bp, launchAccess: la ?? false }));
  }, []);

  const fetchSubscription = useCallback(async (uid: string): Promise<{ plan: Plan; billingPeriod: BillingPeriod; launchAccess: boolean } | null> => {
    const token = await getToken();
    if (!token) return null;
    const res = await apiFetch('/api/subscription', token);
    if (!res.ok) throw new Error(`GET /api/subscription failed: ${res.status}`);
    const data = (await res.json()) as { plan: Plan; billingPeriod: BillingPeriod; launchAccess?: boolean };
    return { plan: data.plan, billingPeriod: data.billingPeriod, launchAccess: data.launchAccess ?? false };
  }, [getToken]);

  // `getToken` (and therefore `fetchSubscription`/`cachePlan`, which close
  // over it) gets a new identity from Clerk on many renders. If the sign-in
  // effect below depended on those callbacks directly, each fetch would
  // trigger a state update → re-render → new callback identity → the effect
  // re-running → another fetch, forever (this is what caused the runaway
  // `/api/subscription` polling and the "Maximum call stack size exceeded"
  // crash). Keep the latest versions in refs instead so the effect can call
  // them without depending on their identity.
  const fetchSubscriptionRef = useRef(fetchSubscription);
  fetchSubscriptionRef.current = fetchSubscription;
  const cachePlanRef = useRef(cachePlan);
  cachePlanRef.current = cachePlan;

  // ── React to userId changes (sign-in, sign-out, account switch) ───────────
  useEffect(() => {
    if (!userId) {
      const prevUserId = loadedUserRef.current;
      setPlan('free');
      setBillingPeriod('monthly');
      setLaunchAccess(false);
      setIsLoading(false);
      loadedUserRef.current = null;

      if (prevUserId) {
        AsyncStorage.removeItem(subscriptionKey(prevUserId)).catch(() => null);
      }
      return;
    }

    if (loadedUserRef.current && loadedUserRef.current !== userId) {
      const prevUserId = loadedUserRef.current;
      setPlan('free');
      setBillingPeriod('monthly');
      AsyncStorage.removeItem(subscriptionKey(prevUserId)).catch(() => null);
    }

    loadedUserRef.current = userId;

    if (DEV_UNLOCKED) {
      setPlan('pro');
      setBillingPeriod('monthly');
      setIsLoading(false);
      return;
    }

    const capturedUserId = userId;
    let active = true;

    setIsLoading(true);

    // Show the cached value immediately (fast paint), then reconcile against
    // the authoritative backend record.
    AsyncStorage.getItem(subscriptionKey(capturedUserId))
      .then((v) => {
        if (!active || loadedUserRef.current !== capturedUserId || !v) return;
        try {
          const cached = JSON.parse(v) as { plan: Plan; billingPeriod: BillingPeriod; launchAccess?: boolean };
          setPlan(cached.plan ?? 'free');
          setBillingPeriod(cached.billingPeriod ?? 'monthly');
          // Restore launchAccess from cache so the holding limit isn't enforced
          // while the live fetch is in-flight on cold starts.
          if (cached.launchAccess) setLaunchAccess(true);
        } catch { /* ignore */ }
      })
      .catch(() => null);

    fetchSubscriptionRef.current(capturedUserId)
      .then((data) => {
        if (!active || loadedUserRef.current !== capturedUserId) return;
        const resolvedPlan = data?.plan ?? 'free';
        const resolvedPeriod = data?.billingPeriod ?? 'monthly';
        const resolvedLaunchAccess = data?.launchAccess ?? false;
        setPlan(resolvedPlan);
        setBillingPeriod(resolvedPeriod);
        setLaunchAccess(resolvedLaunchAccess);
        cachePlanRef.current(capturedUserId, resolvedPlan, resolvedPeriod, resolvedLaunchAccess).catch(() => null);
      })
      .catch(() => {
        // Network/backend error: keep whatever was loaded from cache (or free).
      })
      .finally(() => {
        if (active && loadedUserRef.current === capturedUserId) {
          setIsLoading(false);
        }
      });

    return () => { active = false; };
    // Intentionally NOT depending on fetchSubscription/cachePlan: they close
    // over Clerk's `getToken`, which is not referentially stable across
    // renders. Depending on them here caused an infinite fetch loop (see
    // comment above `fetchSubscriptionRef`). We always call the latest
    // version via the refs instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const getPriceId = useCallback(async (period: BillingPeriod): Promise<string> => {
    const token = await getToken();
    if (!token) throw new Error('Not signed in');
    const res = await apiFetch('/api/stripe/prices', token);
    if (!res.ok) throw new Error(`GET /api/stripe/prices failed: ${res.status}`);
    const data = (await res.json()) as { prices: PriceCatalogEntry[] };
    const match = data.prices.find((p) => p.plan === 'pro' && p.billingPeriod === period);
    if (!match) throw new Error(`No Stripe price found for pro/${period}`);
    return match.priceId;
  }, [getToken]);

  const purchase = useCallback(async (
    period: BillingPeriod,
    webPopup?: Window | null,
  ) => {
    if (!userId) throw new Error('Not signed in');

    if (DEV_UNLOCKED) {
      // Dev builds skip real checkout entirely — Pro is always unlocked.
      setPlan('pro');
      setBillingPeriod(period);
      await cachePlan(userId, 'pro', period);
      return true;
    }

    if (launchAccess) {
      // Launch Access is on — everyone already has Pro, purchase UI is
      // replaced with a non-clickable badge, but guard here too in case
      // anything still calls this directly.
      return false;
    }

    setIsPurchasing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');

      const priceId = await getPriceId(period);
      const redirectUrl = Linking.createURL('subscription/checkout-complete');

      const res = await apiFetch('/api/stripe/checkout', token, {
        method: 'POST',
        body: JSON.stringify({
          priceId,
          plan: 'pro',
          billingPeriod: period,
          successUrl: redirectUrl,
          cancelUrl: redirectUrl,
        }),
      });
      if (!res.ok) throw new Error(`POST /api/stripe/checkout failed: ${res.status}`);
      const { url } = (await res.json()) as { url: string };

      const result = await openCheckoutUrl(url, redirectUrl, webPopup);
      if (result.type !== 'success') {
        // User cancelled or dismissed the Checkout sheet — no entitlement change.
        return false;
      }

      // Stripe webhooks are async, so poll briefly for the subscription to
      // land before giving up on refreshing local state.
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise((r) => setTimeout(r, 1500));
        const data = await fetchSubscription(userId).catch(() => null);
        if (data && data.plan !== 'free') {
          setPlan(data.plan);
          setBillingPeriod(data.billingPeriod);
          await cachePlan(userId, data.plan, data.billingPeriod);
          return true;
        }
      }
      // Checkout completed but the webhook hasn't landed the subscription
      // yet — don't claim success prematurely.
      return false;
    } finally {
      setIsPurchasing(false);
    }
  }, [userId, getToken, getPriceId, fetchSubscription, cachePlan, launchAccess]);

  const manageSubscription = useCallback(async (webPopup?: Window | null) => {
    if (!userId || DEV_UNLOCKED || launchAccess) return;
    const token = await getToken();
    if (!token) throw new Error('Not signed in');

    const returnUrl = Linking.createURL('settings');
    const res = await apiFetch('/api/stripe/portal', token, {
      method: 'POST',
      body: JSON.stringify({ returnUrl }),
    });
    if (!res.ok) throw new Error(`POST /api/stripe/portal failed: ${res.status}`);
    const { url } = (await res.json()) as { url: string };

    await openCheckoutUrl(url, returnUrl, webPopup);

    // The user may have downgraded/cancelled in the portal — refresh state.
    const data = await fetchSubscription(userId).catch(() => null);
    if (data) {
      setPlan(data.plan);
      setBillingPeriod(data.billingPeriod);
      await cachePlan(userId, data.plan, data.billingPeriod);
    }
  }, [userId, getToken, fetchSubscription, cachePlan, launchAccess]);

  const restore = useCallback(async () => {
    if (!userId) return;
    setIsRestoring(true);
    try {
      const data = await fetchSubscription(userId).catch(() => null);
      if (data) {
        setPlan(data.plan);
        setBillingPeriod(data.billingPeriod);
        await cachePlan(userId, data.plan, data.billingPeriod);
      }
    } finally {
      setIsRestoring(false);
    }
  }, [userId, fetchSubscription, cachePlan]);

  const showPaywall = useCallback(() => {
    _paywallCallback?.();
  }, []);

  const _devSetPlan = useCallback((p: Plan) => {
    if (!DEV_UNLOCKED || !userId) return;
    setPlan(p);
    cachePlan(userId, p, billingPeriod).catch(() => null);
  }, [userId, billingPeriod, cachePlan]);

  const isPro = plan === 'pro';

  return (
    <SubscriptionContext.Provider value={{
      plan, billingPeriod,
      isSubscribed: isPro,
      isPro,
      launchAccess,
      isLoading, isPurchasing, isRestoring,
      offerings: OFFERINGS,
      purchase, restore, manageSubscription, showPaywall, _devSetPlan,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return ctx;
}
