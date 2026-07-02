/**
 * SubscriptionContext — real Stripe-backed implementation.
 *
 * In development builds (`__DEV__`) all Pro+ features stay unlocked locally
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

export type Plan = 'free' | 'pro' | 'pro_plus';
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
  isProPlus: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  offerings: {
    pro: MockProduct;
    proPlus: MockProduct;
  };
  purchase: (plan: 'pro' | 'pro_plus', period: BillingPeriod, webPopup?: Window | null) => Promise<void>;
  restore: () => Promise<void>;
  manageSubscription: (webPopup?: Window | null) => Promise<void>;
  showPaywall: (requiredPlan?: 'pro' | 'pro_plus') => void;
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
    description: 'Unlimited investments, all tools & analytics',
  },
  proPlus: {
    identifier: 'pro_plus',
    priceString: '69.99 EGP',
    annualPriceString: '559.99 EGP',
    price: 69.99,
    annualPrice: 559.99,
    annualSavingsPct: 33,
    title: 'Investry Pro+',
    description: 'Everything in Pro + advanced charts, EGX real-time & export',
  },
};

/** Per-user AsyncStorage key — a display cache only, never a trust source. */
function subscriptionKey(userId: string) {
  return `@invstry_subscription_${userId}`;
}

// In development builds all Pro+ features are unlocked automatically so the
// developer never hits the paywall. In production this is always false.
const DEV_UNLOCKED = __DEV__;

interface PriceCatalogEntry {
  priceId: string;
  plan: 'pro' | 'pro_plus';
  billingPeriod: BillingPeriod;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

let _paywallCallback: ((requiredPlan?: 'pro' | 'pro_plus') => void) | null = null;
export function _registerPaywallCallback(cb: (requiredPlan?: 'pro' | 'pro_plus') => void) {
  _paywallCallback = cb;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = useAuth();
  const [plan, setPlan] = useState<Plan>('free');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const loadedUserRef = useRef<string | null>(null);

  const cachePlan = useCallback(async (uid: string, p: Plan, bp: BillingPeriod) => {
    await AsyncStorage.setItem(subscriptionKey(uid), JSON.stringify({ plan: p, billingPeriod: bp }));
  }, []);

  const fetchSubscription = useCallback(async (uid: string): Promise<{ plan: Plan; billingPeriod: BillingPeriod } | null> => {
    const token = await getToken();
    if (!token) return null;
    const res = await apiFetch('/api/subscription', token);
    if (!res.ok) throw new Error(`GET /api/subscription failed: ${res.status}`);
    const data = (await res.json()) as { plan: Plan; billingPeriod: BillingPeriod };
    return data;
  }, [getToken]);

  // ── React to userId changes (sign-in, sign-out, account switch) ───────────
  useEffect(() => {
    if (!userId) {
      const prevUserId = loadedUserRef.current;
      setPlan('free');
      setBillingPeriod('monthly');
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
      setPlan('pro_plus');
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
          const cached = JSON.parse(v) as { plan: Plan; billingPeriod: BillingPeriod };
          setPlan(cached.plan ?? 'free');
          setBillingPeriod(cached.billingPeriod ?? 'monthly');
        } catch { /* ignore */ }
      })
      .catch(() => null);

    fetchSubscription(capturedUserId)
      .then((data) => {
        if (!active || loadedUserRef.current !== capturedUserId) return;
        const resolvedPlan = data?.plan ?? 'free';
        const resolvedPeriod = data?.billingPeriod ?? 'monthly';
        setPlan(resolvedPlan);
        setBillingPeriod(resolvedPeriod);
        cachePlan(capturedUserId, resolvedPlan, resolvedPeriod).catch(() => null);
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
  }, [userId, fetchSubscription, cachePlan]);

  const getPriceId = useCallback(async (targetPlan: 'pro' | 'pro_plus', period: BillingPeriod): Promise<string> => {
    const token = await getToken();
    if (!token) throw new Error('Not signed in');
    const res = await apiFetch('/api/stripe/prices', token);
    if (!res.ok) throw new Error(`GET /api/stripe/prices failed: ${res.status}`);
    const data = (await res.json()) as { prices: PriceCatalogEntry[] };
    const match = data.prices.find((p) => p.plan === targetPlan && p.billingPeriod === period);
    if (!match) throw new Error(`No Stripe price found for ${targetPlan}/${period}`);
    return match.priceId;
  }, [getToken]);

  const purchase = useCallback(async (
    targetPlan: 'pro' | 'pro_plus',
    period: BillingPeriod,
    webPopup?: Window | null,
  ) => {
    if (!userId) throw new Error('Not signed in');

    if (DEV_UNLOCKED) {
      // Dev builds skip real checkout entirely — Pro+ is always unlocked.
      setPlan(targetPlan);
      setBillingPeriod(period);
      await cachePlan(userId, targetPlan, period);
      return;
    }

    setIsPurchasing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');

      const priceId = await getPriceId(targetPlan, period);
      const redirectUrl = Linking.createURL('subscription/checkout-complete');

      const res = await apiFetch('/api/stripe/checkout', token, {
        method: 'POST',
        body: JSON.stringify({
          priceId,
          plan: targetPlan,
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
        return;
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
          break;
        }
      }
    } finally {
      setIsPurchasing(false);
    }
  }, [userId, getToken, getPriceId, fetchSubscription, cachePlan]);

  const manageSubscription = useCallback(async (webPopup?: Window | null) => {
    if (!userId || DEV_UNLOCKED) return;
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
  }, [userId, getToken, fetchSubscription, cachePlan]);

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

  const showPaywall = useCallback((requiredPlan?: 'pro' | 'pro_plus') => {
    _paywallCallback?.(requiredPlan);
  }, []);

  const _devSetPlan = useCallback((p: Plan) => {
    if (!DEV_UNLOCKED || !userId) return;
    setPlan(p);
    cachePlan(userId, p, billingPeriod).catch(() => null);
  }, [userId, billingPeriod, cachePlan]);

  const isPro = plan === 'pro' || plan === 'pro_plus';
  const isProPlus = plan === 'pro_plus';

  return (
    <SubscriptionContext.Provider value={{
      plan, billingPeriod,
      isSubscribed: isPro,
      isPro, isProPlus,
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
