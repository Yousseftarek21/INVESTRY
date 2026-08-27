import { Feather } from '@expo/vector-icons';
import { useT } from '@/hooks/useTranslation';

export interface FeatureRow {
  icon: keyof typeof Feather.glyphMap;
  text: string;
}

// Single source for the "highlights" list shown in both Paywall.tsx (selling
// Pro to a Free user) and ManageSubscriptionSheet.tsx (reassuring an
// existing Pro subscriber what they get) — these used to be two hand-copied
// literals that could silently drift out of sync; this is what actually
// kept Recurring Income (a real, fully Pro-gated feature) out of the
// Paywall entirely, since whoever added the gate never updated either copy.
export function getPaywallHighlights(t: ReturnType<typeof useT>): FeatureRow[] {
  return [
    { icon: 'briefcase', text: t.subUnlimitedInvestments },
    { icon: 'credit-card', text: t.subUnlimitedCash },
    { icon: 'repeat', text: t.subRecurringIncomeFull },
    { icon: 'target', text: t.subUnlimitedGoals },
    { icon: 'bell', text: t.subNotificationsFull },
    { icon: 'cpu', text: t.subAiAssistantFull },
    { icon: 'trending-up', text: t.subMarketIntelligence },
    { icon: 'bar-chart-2', text: t.subPortfolioAnalytics },
  ];
}
