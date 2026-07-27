/**
 * SubscriptionContext — read-only entitlement check.
 *
 * The app never processes payments and never talks to Stripe. Upgrading,
 * managing, and cancelling a subscription all happen on the website
 * (investry.app), which shares the same Clerk account as this app. Stripe
 * webhooks on the backend keep the database in sync; this context's only
 * job is to ask the backend "what plan is this user on right now" (`GET
 * /api/subscription`) and refresh that on sign-in, app launch, and app
 * foreground — never to grant entitlements on its own. AsyncStorage is only
 * used as a display cache for a fast paint; a live fetch always follows and
 * overwrites it.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '../utils/api';

export type Plan = 'free' | 'pro';
export type BillingPeriod = 'monthly' | 'annual';

export interface SubscriptionContextValue {
  plan: Plan;
  billingPeriod: BillingPeriod;
  isSubscribed: boolean;
  isPro: boolean;
  /**
   * Whether feature *gates* should be bypassed right now — true if the user
   * is genuinely Pro, OR the backend's temporary beta flag is on. Use this
   * for PremiumGate/holding-limit checks. Never use this for anything that
   * displays plan/badge status (that must stay tied to `isPro` alone) — the
   * whole point of the beta flag is that free users keep seeing "Free"
   * while everything still works.
   */
  featuresUnlocked: boolean;
  isLoading: boolean;
  /** Manually re-check entitlement against the backend (e.g. pull-to-refresh). */
  refresh: () => Promise<void>;
  /** Opens the informational "About Pro" sheet — never a purchase flow. */
  showPaywall: () => void;
}

interface SubscriptionData { plan: Plan; billingPeriod: BillingPeriod; betaUnlockAll: boolean }

/** Per-user AsyncStorage key — a display cache only, never a trust source. */
function subscriptionKey(userId: string) {
  return `@invstry_subscription_${userId}`;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

let _paywallCallback: (() => void) | null = null;
export function _registerPaywallCallback(cb: () => void) {
  _paywallCallback = cb;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = useAuth();
  const [plan, setPlan] = useState<Plan>('free');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [betaUnlockAll, setBetaUnlockAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const loadedUserRef = useRef<string | null>(null);

  const cachePlan = useCallback(async (uid: string, data: SubscriptionData) => {
    await AsyncStorage.setItem(subscriptionKey(uid), JSON.stringify(data));
  }, []);

  const fetchSubscription = useCallback(async (uid: string): Promise<SubscriptionData | null> => {
    const token = await getToken();
    if (!token) return null;
    const res = await apiFetch('/api/subscription', token);
    if (!res.ok) throw new Error(`GET /api/subscription failed: ${res.status}`);
    const data = (await res.json()) as SubscriptionData;
    return { plan: data.plan, billingPeriod: data.billingPeriod, betaUnlockAll: data.betaUnlockAll ?? false };
  }, [getToken]);

  // `getToken` (and therefore `fetchSubscription`/`cachePlan`, which close
  // over it) gets a new identity from Clerk on many renders. Kept in refs so
  // effects can call the latest version without depending on their identity
  // — depending on them directly caused a runaway fetch loop previously.
  const fetchSubscriptionRef = useRef(fetchSubscription);
  fetchSubscriptionRef.current = fetchSubscription;
  const cachePlanRef = useRef(cachePlan);
  cachePlanRef.current = cachePlan;

  const runFetch = useCallback((uid: string) => {
    fetchSubscriptionRef.current(uid)
      .then((data) => {
        if (loadedUserRef.current !== uid) return;
        const resolved: SubscriptionData = {
          plan: data?.plan ?? 'free',
          billingPeriod: data?.billingPeriod ?? 'monthly',
          betaUnlockAll: data?.betaUnlockAll ?? false,
        };
        setPlan(resolved.plan);
        setBillingPeriod(resolved.billingPeriod);
        setBetaUnlockAll(resolved.betaUnlockAll);
        cachePlanRef.current(uid, resolved).catch(() => null);
      })
      .catch(() => {
        // Network/backend error: keep whatever was loaded from cache (or free).
      });
  }, []);

  // ── React to userId changes (sign-in, sign-out, account switch) ───────────
  useEffect(() => {
    if (!userId) {
      const prevUserId = loadedUserRef.current;
      setPlan('free');
      setBillingPeriod('monthly');
      setBetaUnlockAll(false);
      setIsLoading(false);
      loadedUserRef.current = null;
      if (prevUserId) AsyncStorage.removeItem(subscriptionKey(prevUserId)).catch(() => null);
      return;
    }

    if (loadedUserRef.current && loadedUserRef.current !== userId) {
      const prevUserId = loadedUserRef.current;
      setPlan('free');
      setBillingPeriod('monthly');
      setBetaUnlockAll(false);
      AsyncStorage.removeItem(subscriptionKey(prevUserId)).catch(() => null);
    }

    loadedUserRef.current = userId;
    const capturedUserId = userId;
    let active = true;

    setIsLoading(true);

    // Show the cached value immediately (fast paint), then reconcile against
    // the authoritative backend record.
    AsyncStorage.getItem(subscriptionKey(capturedUserId))
      .then((v) => {
        if (!active || loadedUserRef.current !== capturedUserId || !v) return;
        try {
          const cached = JSON.parse(v) as Partial<SubscriptionData>;
          setPlan(cached.plan ?? 'free');
          setBillingPeriod(cached.billingPeriod ?? 'monthly');
          setBetaUnlockAll(cached.betaUnlockAll ?? false);
        } catch { /* ignore */ }
      })
      .catch(() => null);

    fetchSubscriptionRef.current(capturedUserId)
      .then((data) => {
        if (!active || loadedUserRef.current !== capturedUserId) return;
        const resolved: SubscriptionData = {
          plan: data?.plan ?? 'free',
          billingPeriod: data?.billingPeriod ?? 'monthly',
          betaUnlockAll: data?.betaUnlockAll ?? false,
        };
        setPlan(resolved.plan);
        setBillingPeriod(resolved.billingPeriod);
        setBetaUnlockAll(resolved.betaUnlockAll);
        cachePlanRef.current(capturedUserId, resolved).catch(() => null);
      })
      .catch(() => {
        // Network/backend error: keep whatever was loaded from cache (or free).
      })
      .finally(() => {
        if (active && loadedUserRef.current === capturedUserId) setIsLoading(false);
      });

    return () => { active = false; };
    // Intentionally NOT depending on fetchSubscription/cachePlan — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Refresh when the app returns to the foreground ────────────────────────
  // A subscription bought or cancelled on the website while this app was
  // merely backgrounded needs to reflect here without a sign-out/sign-in or
  // app restart — this is that mechanism.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && loadedUserRef.current) {
        runFetch(loadedUserRef.current);
      }
    });
    return () => sub.remove();
  }, [runFetch]);

  const refresh = useCallback(async () => {
    if (loadedUserRef.current) runFetch(loadedUserRef.current);
  }, [runFetch]);

  const showPaywall = useCallback(() => {
    _paywallCallback?.();
  }, []);

  const isPro = plan === 'pro';

  // The iOS build has no In-App Purchase — Apple's Guideline 3.1.1 forbids
  // gating paid content behind a subscription that can only be bought
  // elsewhere (this app's Pro plan is Stripe-only, sold on investry.app).
  // Rather than build IAP, iOS just doesn't gate anything: every feature is
  // unlocked for every iOS user, full stop. `isPro`/`plan` still reflect the
  // real backend entitlement for badge/display purposes — only
  // `featuresUnlocked` (what every gate/limit check actually reads) is
  // forced true here.
  const featuresUnlocked = Platform.OS === 'ios' ? true : (isPro || betaUnlockAll);

  return (
    <SubscriptionContext.Provider value={{
      plan, billingPeriod,
      isSubscribed: isPro,
      isPro,
      featuresUnlocked,
      isLoading,
      refresh,
      showPaywall,
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
