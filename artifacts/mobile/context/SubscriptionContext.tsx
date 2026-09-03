/**
 * SubscriptionContext — real entitlement, gated, purchased via the website.
 *
 * History worth keeping in mind: App Review rejected build 54 under
 * Guideline 3.1.1 for displaying a Pro plan — a "You're on the Pro plan"
 * status, a Free-vs-Pro comparison, PRO badges — that was only purchasable
 * on investry.app, not in the app. A second attempt only unlocked every
 * feature while leaving plan/isPro live "for badge/display purposes", which
 * failed review again for the same reason: Apple objects to *presenting*
 * paid content bought elsewhere, not merely to gating it. Every gate and
 * every plan/isPro reference was removed after that, and this file carried
 * a hardcoded `featuresUnlocked = true` for a while.
 *
 * Gating is deliberately being reinstated now, still via the website's
 * Stripe checkout (no in-app purchase — react-native-purchases stays
 * installed-but-unused, kept on standby for a StoreKit/IAP path later). The
 * risk that reintroduces on iOS re-review has been explicitly discussed and
 * accepted — this file's job is just to gate correctly and reflect the
 * user's real plan, not to relitigate that call.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { apiFetch } from '../utils/api';

export type Plan = 'free' | 'pro';
export type BillingPeriod = 'monthly' | 'annual';

export interface SubscriptionContextValue {
  /** Real entitlement: `plan === 'pro'` or the server's beta-unlock flag. */
  featuresUnlocked: boolean;
  /** The user's current plan, straight from the backend. */
  plan: Plan;
  /** Convenience alias for `plan === 'pro'`. */
  isPro: boolean;
  isLoading: boolean;
  /** Manually re-check entitlement against the backend (e.g. pull-to-refresh). */
  refresh: () => Promise<void>;
  /**
   * Optimistically flips this device to Pro the instant a purchase/restore
   * is confirmed by RevenueCat/StoreKit — never make the user wait on the
   * RevenueCat webhook reaching our server before they see Pro unlock.
   * `refresh()` still runs in the background afterward to reconcile with
   * the real server record once the webhook lands.
   */
  markProLocally: (billingPeriod: BillingPeriod) => void;
  /** Opens the Paywall modal (rendered once in app/_layout.tsx). */
  showPaywall: () => void;
  /**
   * Same as `showPaywall`, for a gate reached from a screen presented via
   * expo-router's `presentation: "modal"` (add-investment, cash-accounts,
   * recurring-income, goals, price-alerts, ai-assistant). Confirmed live
   * (state traced with console logging, not assumed): calling `showPaywall`
   * directly from one of those screens does flip `paywallVisible` to true —
   * the Paywall component re-renders with it — but nothing appears on
   * screen. iOS won't reliably stack a second independent native modal
   * presentation (Paywall's own `<Modal>`, mounted as a root-level sibling
   * in app/_layout.tsx) on top of a screen that's itself already a native
   * modal presentation; the failure is silent, no warning either side. This
   * dismisses every nested modal screen first (some of these, e.g.
   * add-investment, are reached through another modal screen — a single
   * dismiss isn't enough) and opens the paywall once that clears, over
   * whatever's underneath — the one reliable place a second `<Modal>` is
   * confirmed to present correctly.
   */
  showPaywallFromModal: () => void;
  /** Paywall modal's own visibility state — consumed by app/_layout.tsx only. */
  paywallVisible: boolean;
  closePaywall: () => void;
}

interface SubscriptionData { plan: Plan; billingPeriod: BillingPeriod; betaUnlockAll: boolean }

/** Per-user AsyncStorage key — a display cache only, never a trust source. */
function subscriptionKey(userId: string) {
  return `@invstry_subscription_${userId}`;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = useAuth();
  const [plan, setPlan] = useState<Plan>('free');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [betaUnlockAll, setBetaUnlockAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [paywallVisible, setPaywallVisible] = useState(false);
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

  const markProLocally = useCallback((newBillingPeriod: BillingPeriod) => {
    setPlan('pro');
    setBillingPeriod(newBillingPeriod);
    if (loadedUserRef.current) {
      cachePlanRef.current(loadedUserRef.current, { plan: 'pro', billingPeriod: newBillingPeriod, betaUnlockAll })
        .catch(() => null);
    }
  }, [betaUnlockAll]);

  const showPaywall = useCallback(() => setPaywallVisible(true), []);
  // 400ms: comfortably past iOS's own "modal" screen dismiss animation
  // (~350ms) so the previous native presentation has actually finished
  // clearing before Paywall's `<Modal>` tries to present — presenting while
  // a dismiss is still in flight is exactly the kind of overlap that fails
  // silently on iOS. If there's nothing to dismiss (reached some other
  // way), just show it directly.
  //
  // dismissAll(), NOT back()/canGoBack() — a real bug, not just the
  // originally-documented one: add-investment.tsx and cash-accounts.tsx are
  // both reached through add-choose.tsx, itself a `transparentModal`
  // screen, so a single back() from either only pops one level, landing on
  // add-choose — which is STILL a modal presentation. The Paywall's own
  // <Modal> then tries to stack on top of THAT and fails silently, the
  // exact same failure mode this function exists to avoid, just one level
  // deeper than back()/canGoBack() accounts for. Confirmed live (tap-
  // independent diagnostic): the gate fired, back() ran, but the screen
  // landed on add-choose's sheet instead of the paywall appearing.
  // dismissAll() (expo-router: "returns to the first screen in the closest
  // stack", like React Navigation's popToTop) clears every nested modal
  // in one call regardless of depth, so this is correct for both this
  // two-level case and the original one-level screens (recurring-income,
  // goals, price-alerts, dividends, target-allocation) alike — one fix,
  // not a per-screen special case.
  const showPaywallFromModal = useCallback(() => {
    if (router.canDismiss()) {
      router.dismissAll();
      setTimeout(() => setPaywallVisible(true), 400);
    } else {
      setPaywallVisible(true);
    }
  }, []);
  const closePaywall = useCallback(() => setPaywallVisible(false), []);

  const isPro = plan === 'pro';
  const featuresUnlocked = isPro || betaUnlockAll;

  return (
    <SubscriptionContext.Provider value={{
      featuresUnlocked,
      plan,
      isPro,
      isLoading,
      refresh,
      markProLocally,
      showPaywall,
      showPaywallFromModal,
      paywallVisible,
      closePaywall,
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
