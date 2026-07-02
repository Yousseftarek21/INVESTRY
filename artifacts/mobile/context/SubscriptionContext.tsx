/**
 * SubscriptionContext — Mock implementation, API-compatible with RevenueCat.
 *
 * TO CONNECT REVENUECAT LATER:
 *   1. Install `react-native-purchases` (already done)
 *   2. Replace this file with the RevenueCat version from the skill reference
 *      (lib/revenuecat.tsx template). The hook shape is identical.
 *   3. Set EXPO_PUBLIC_REVENUECAT_* env vars.
 *   4. Remove SUBSCRIPTION_STORAGE_KEY from AsyncStorage.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    priceString: '249 EGP/شهر',
    annualPriceString: '1,999 EGP/سنة',
    price: 249,
    annualPrice: 1999,
    annualSavingsPct: 33,
    title: 'Investry Pro',
    description: 'Unlimited holdings, all tools & analytics',
  },
  proPlus: {
    identifier: 'investry_pro_plus_monthly',
    priceString: '499 EGP/شهر',
    annualPriceString: '3,999 EGP/سنة',
    price: 499,
    annualPrice: 3999,
    annualSavingsPct: 33,
    title: 'Investry Pro+',
    description: 'Everything in Pro + advanced charts, EGX real-time & export',
  },
};

const STORAGE_KEY = '@invstry_subscription';

// ─── Context ─────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// Paywall navigation callback — set by the root layout
let _paywallCallback: ((requiredPlan?: 'pro' | 'pro_plus') => void) | null = null;
export function _registerPaywallCallback(cb: (requiredPlan?: 'pro' | 'pro_plus') => void) {
  _paywallCallback = cb;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<Plan>('free');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      if (v) {
        try {
          const saved = JSON.parse(v) as { plan: Plan; billingPeriod: BillingPeriod };
          setPlan(saved.plan ?? 'free');
          setBillingPeriod(saved.billingPeriod ?? 'monthly');
        } catch { /* ignore */ }
      }
    }).finally(() => setIsLoading(false));
  }, []);

  const savePlan = useCallback(async (p: Plan, bp: BillingPeriod) => {
    setPlan(p);
    setBillingPeriod(bp);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ plan: p, billingPeriod: bp }));
  }, []);

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

  const isPro = plan === 'pro' || plan === 'pro_plus';
  const isProPlus = plan === 'pro_plus';

  return (
    <SubscriptionContext.Provider value={{
      plan, billingPeriod,
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
