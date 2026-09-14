import React from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { LockedFeatureCard } from '@/components/LockedFeatureCard';

interface PremiumGateProps {
  feature: string;
  description: string;
  children: React.ReactNode;
}

// Renders children when the user's entitlement is real (paid via the
// website's Stripe checkout — see SubscriptionContext's own history note),
// otherwise the shared LockedFeatureCard prompt. See SubscriptionContext.tsx
// for why this was a pass-through for a while and why it's real again now.
//
// Waits on `isLoading` before deciding — entitlement defaults to `false`
// until it resolves, so gating on `featuresUnlocked` alone flashes the
// locked card at a real Pro subscriber for the brief window right after
// launch/sign-in before their (usually cached, near-instant) entitlement
// has loaded. Renders nothing rather than the card during that window.
export function PremiumGate({ feature, description, children }: PremiumGateProps) {
  const { featuresUnlocked, isLoading } = useSubscription();
  if (isLoading) return null;
  if (featuresUnlocked) return <>{children}</>;
  return <LockedFeatureCard feature={feature} description={description} />;
}
