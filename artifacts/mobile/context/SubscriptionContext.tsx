/**
 * SubscriptionContext — Mock implementation, API-compatible with RevenueCat.
 *
 * TO CONNECT REVENUECAT LATER:
 *   1. Install `react-native-purchases` (already done)
 *   2. Replace this file with the RevenueCat version from the skill reference
 *      (lib/revenuecat.tsx template). The hook shape is identical.
 *   3. Set EXPO_PUBLIC_REVENUECAT_* env vars.
 *   4. Remove per-user subscription keys from AsyncStorage.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';

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
  purchase: (plan: 'pro' | 'pro_plus', period: BillingPeriod) => Promise<void>;
  restore: () => Promise<void>;
  showPaywall: (requiredPlan?: 'pro' | 'pro_plus') => void;
  _devSetPlan: (plan: Plan) => void;
}

// ─── Offerings ───────────────────────────────────────────────────────────────

const OFFERINGS: SubscriptionContextValue['offerings'] = {
  pro: {
    identifier: 'investry_pro_monthly',
    priceString: '49.99 EGP',
    annualPriceString: '399.99 EGP',
    price: 49.99,
    annualPrice: 399.99,
    annualSavingsPct: 33,
    title: 'Investry Pro',
    description: 'Unlimited investments, all tools & analytics',
  },
  proPlus: {
    identifier: 'investry_pro_plus_monthly',
    priceString: '69.99 EGP',
    annualPriceString: '559.99 EGP',
    price: 69.99,
    annualPrice: 559.99,
    annualSavingsPct: 33,
    title: 'Investry Pro+',
    description: 'Everything in Pro + advanced charts, EGX real-time & export',
  },
};

/**
 * Returns the per-user AsyncStorage key so that one account's subscription
 * is never inherited by a different account on the same device.
 */
function subscriptionKey(userId: string) {
  return `@invstry_subscription_${userId}`;
}

// ─── Dev unlock ──────────────────────────────────────────────────────────────
// In development builds (__DEV__ === true) all Pro+ features are unlocked
// automatically so the developer never hits the paywall. In production builds
// this constant is false and users see the normal subscription flow.
const DEV_UNLOCKED = __DEV__;

// ─── Context ─────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// Paywall navigation callback — set by the root layout
let _paywallCallback: ((requiredPlan?: 'pro' | 'pro_plus') => void) | null = null;
export function _registerPaywallCallback(cb: (requiredPlan?: 'pro' | 'pro_plus') => void) {
  _paywallCallback = cb;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [plan, setPlan] = useState<Plan>('free');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  // Tracks which userId's entitlement is currently held in memory.
  const loadedUserRef = useRef<string | null>(null);

  // ── React to userId changes (sign-in, sign-out, account switch) ───────────
  useEffect(() => {
    if (!userId) {
      // Signed out: clear the previous user's entitlement from memory AND
      // delete their persisted key so the next user cannot inherit it.
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

    // Account switch without a full sign-out: wipe the previous user's
    // entitlement before loading the new user's data.
    if (loadedUserRef.current && loadedUserRef.current !== userId) {
      const prevUserId = loadedUserRef.current;
      setPlan('free');
      setBillingPeriod('monthly');
      AsyncStorage.removeItem(subscriptionKey(prevUserId)).catch(() => null);
    }

    loadedUserRef.current = userId;

    // Capture which userId this closure is loading for. The staleness guard
    // below prevents a slow AsyncStorage read that resolves after a sign-out
    // or account switch from writing prior-user entitlements into state.
    const capturedUserId = userId;
    let active = true;

    setIsLoading(true);

    AsyncStorage.getItem(subscriptionKey(capturedUserId))
      .then(v => {
        // Guard: bail if the effect was cancelled or the user changed
        if (!active || loadedUserRef.current !== capturedUserId) return;

        if (v) {
          try {
            const saved = JSON.parse(v) as { plan: Plan; billingPeriod: BillingPeriod };
            setPlan(saved.plan ?? 'free');
            setBillingPeriod(saved.billingPeriod ?? 'monthly');
          } catch { /* ignore */ }
        } else {
          // No saved plan for this user — start as free.
          setPlan('free');
          setBillingPeriod('monthly');
        }
      })
      .finally(() => {
        if (active && loadedUserRef.current === capturedUserId) {
          setIsLoading(false);
        }
      });

    return () => { active = false; };
  }, [userId]);

  const savePlan = useCallback(async (p: Plan, bp: BillingPeriod) => {
    if (!userId) return;
    setPlan(p);
    setBillingPeriod(bp);
    await AsyncStorage.setItem(subscriptionKey(userId), JSON.stringify({ plan: p, billingPeriod: bp }));
  }, [userId]);

  const purchase = useCallback(async (targetPlan: 'pro' | 'pro_plus', period: BillingPeriod) => {
    setIsPurchasing(true);
    try {
      // Mock: simulate network delay
      await new Promise(r => setTimeout(r, 800));
      await savePlan(targetPlan, period);
    } finally {
      setIsPurchasing(false);
    }
  }, [savePlan]);

  const restore = useCallback(async () => {
    setIsRestoring(true);
    await new Promise(r => setTimeout(r, 1200));
    setIsRestoring(false);
    // Mock: restore does nothing — real RevenueCat will restore from receipt
  }, []);

  const showPaywall = useCallback((requiredPlan?: 'pro' | 'pro_plus') => {
    _paywallCallback?.(requiredPlan);
  }, []);

  const _devSetPlan = useCallback((p: Plan) => {
    savePlan(p, billingPeriod);
  }, [savePlan, billingPeriod]);

  const effectivePlan: Plan = DEV_UNLOCKED ? 'pro_plus' : plan;
  const isPro = effectivePlan === 'pro' || effectivePlan === 'pro_plus';
  const isProPlus = effectivePlan === 'pro_plus';

  return (
    <SubscriptionContext.Provider value={{
      plan: effectivePlan, billingPeriod,
      isSubscribed: isPro,
      isPro, isProPlus,
      isLoading, isPurchasing, isRestoring,
      offerings: OFFERINGS,
      purchase, restore, showPaywall, _devSetPlan,
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
