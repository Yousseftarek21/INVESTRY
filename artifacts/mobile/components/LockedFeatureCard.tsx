import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useSubscription } from '@/context/SubscriptionContext';

interface LockedFeatureCardProps {
  feature: string;
  description: string;
  /** Fills the screen instead of sitting as an inline card — for a screen
   * that's entirely gated (e.g. AI Assistant) rather than one section of one. */
  fullScreen?: boolean;
}

// The one locked-state treatment every gate in the app uses — replaces both
// the old inline "Upgrade to PRO" card style and any one-off per-screen
// lock UI. Always opens the same Paywall modal via showPaywall().
export function LockedFeatureCard({ feature, description, fullScreen }: LockedFeatureCardProps) {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const { showPaywall } = useSubscription();

  const onPress = () => { impact(); showPaywall(); };

  return (
    <View style={[
      s.card,
      fullScreen ? s.cardFullScreen : null,
      { backgroundColor: colors.card, borderColor: colors.border },
    ]}>
      <View style={[s.iconWrap, { backgroundColor: colors.primary + '18' }]}>
        <Feather name="lock" size={20} color={colors.primary} />
      </View>
      <Text style={[s.title, { color: colors.text }]}>{feature}</Text>
      <Text style={[s.desc, { color: colors.mutedForeground }]}>{description}</Text>
      <TouchableOpacity
        style={[s.cta, { backgroundColor: colors.primary }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Feather name="star" size={14} color={colors.primaryForeground} />
        <Text style={[s.ctaText, { color: colors.primaryForeground }]}>
          {t.subUpgradeTo} {t.subComparePro}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    alignItems: 'center', gap: 8,
    borderRadius: 18, borderWidth: 1,
    paddingVertical: 28, paddingHorizontal: 24,
  },
  cardFullScreen: { flex: 1, justifyContent: 'center', borderWidth: 0, backgroundColor: 'transparent' },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  desc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19, marginBottom: 6 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
  },
  ctaText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
