import React from 'react';

interface PremiumGateProps {
  /** Retained so existing call sites compile; no longer rendered anywhere. */
  feature: string;
  description: string;
  children: React.ReactNode;
}

/**
 * Pass-through. The app has no paid tier, so nothing is gated.
 *
 * This used to render a locked card with an "Upgrade to PRO" button and a
 * yearly-price hint whenever the user wasn't subscribed. App Review rejected
 * build 54 under Guideline 3.1.1 because the app presented a Pro plan that
 * could only be bought on investry.app, with no In-App Purchase. A previous
 * attempt only forced `featuresUnlocked` to true, which made this branch
 * unreachable but left the upsell markup — and the PRO badges elsewhere —
 * sitting in the shipped build.
 *
 * Unreachable is not the same as absent: the copy still shipped, and review
 * failed a second time. The gate is now genuinely gone rather than merely
 * bypassed. Props stay so the three call sites in analytics.tsx are untouched.
 * If a paid tier ever returns it must ship alongside StoreKit In-App Purchase,
 * not by restoring this file.
 */
export function PremiumGate({ children }: PremiumGateProps) {
  return <>{children}</>;
}
