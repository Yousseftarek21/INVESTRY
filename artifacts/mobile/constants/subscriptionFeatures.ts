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
//
// Expanded from 8 to every real capability a codebase audit found gated
// (see PLAN.md-era notes / commit message) — the previous list was
// accurate at the category level ("Portfolio Analytics", "Market
// Intelligence") but too vague for a free user to feel what upgrading
// actually changes. Each bullet below now names one real, distinct
// capability instead of an umbrella term.
export function getPaywallHighlights(t: ReturnType<typeof useT>): FeatureRow[] {
  return [
    { icon: 'briefcase', text: t.subUnlimitedInvestments },
    { icon: 'credit-card', text: t.subUnlimitedCash },
    { icon: 'repeat', text: t.subRecurringIncomeFull },
    { icon: 'target', text: t.subUnlimitedGoals },
    { icon: 'bell', text: t.subNotificationsFull },
    { icon: 'sliders', text: t.subNotificationsControl },
    { icon: 'cpu', text: t.subAiAssistantFull },
    { icon: 'dollar-sign', text: t.subLiveRates },
    { icon: 'zap', text: t.subPersonalizedSignals },
    { icon: 'heart', text: t.subHealthScore },
    { icon: 'bar-chart-2', text: t.subFullCharts },
    { icon: 'pie-chart', text: t.subAllocationBreakdown },
    { icon: 'award', text: t.subTopPerformers },
    { icon: 'users', text: t.subBenchmarkCompare },
    { icon: 'tool', text: t.subFixMyPortfolio },
    { icon: 'percent', text: t.subDividendsFull },
    { icon: 'download', text: t.subExportData },
    { icon: 'crosshair', text: t.subTargetAllocation },
  ];
}
