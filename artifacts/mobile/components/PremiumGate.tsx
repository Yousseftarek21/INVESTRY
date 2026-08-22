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
export function PremiumGate({ feature, description, children }: PremiumGateProps) {
  const { featuresUnlocked } = useSubscription();
  if (featuresUnlocked) return <>{children}</>;
  return <LockedFeatureCard feature={feature} description={description} />;
}
