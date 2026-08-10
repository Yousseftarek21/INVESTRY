import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backChevron } from '@/utils/rtl';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { fmtCompact } from '@/utils/formatNumber';
import { TIERS, TierId, progressToNext } from '@/utils/portfolioTier';
import { usePortfolioTier } from '@/hooks/usePortfolioTier';
import { tierName } from '@/components/TierCelebration';
import { TIER_GRADIENT, TIER_TEXT, WEALTH_ACCENT_LINE } from '@/components/TierCard';

const TIER_DESC_KEY: Record<TierId, 'tierCoreDesc' | 'tierPlusDesc' | 'tierWealthDesc'> = {
  core: 'tierCoreDesc',
  plus: 'tierPlusDesc',
  wealth: 'tierWealthDesc',
};

function MiniTierCard({ id, current }: { id: TierId; current: boolean }) {
  const t = useT();
  const colors = useColors();
  const onCard = TIER_TEXT[id];

  return (
    <View style={mc.wrap}>
      <LinearGradient
        colors={TIER_GRADIENT[id]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={[mc.card, current && { borderColor: colors.primary, borderWidth: 2 }]}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.32)']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={mc.topRow}>
          <Text style={[mc.issuer, { color: onCard }]}>INVESTRY</Text>
          {current && (
            <View style={[mc.badge, { backgroundColor: colors.primary }]}>
              <Text style={[mc.badgeTxt, { color: colors.primaryForeground }]}>{t.tiersYourTierBadge}</Text>
            </View>
          )}
        </View>

        {id === 'wealth' && (
          <LinearGradient
            colors={WEALTH_ACCENT_LINE}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={mc.accentLine}
          />
        )}

        <Text style={[mc.tierName, { color: onCard }]}>{tierName(id, t)}</Text>
        <Text style={[mc.threshold, { color: onCard + 'CC' }]}>
          {t.tiersFromAmount(`${fmtCompact(TIERS.find(x => x.id === id)!.minEgp)} EGP`)}
        </Text>
      </LinearGradient>

      <Text style={[mc.desc, { color: colors.mutedForeground }]}>{t[TIER_DESC_KEY[id]]}</Text>
    </View>
  );
}
const mc = StyleSheet.create({
  wrap: { gap: 10 },
  card: {
    borderRadius: 20, padding: 18, aspectRatio: 1.85,
    justifyContent: 'space-between', overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  issuer: { fontSize: 11.5, fontFamily: 'Inter_700Bold', letterSpacing: 2.2 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  accentLine: { height: 2, borderRadius: 1, opacity: 0.9 },
  tierName: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: 0.4 },
  threshold: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', marginTop: -6 },
  desc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, paddingHorizontal: 2 },
});

export default function TiersScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  // netWorthEgp of 0 skips resolution entirely (see usePortfolioTier) — this
  // only reads whatever tier is already on record, purely for the "Your
  // tier" badge, without recomputing or risking a duplicate celebration.
  const { tier: currentTier } = usePortfolioTier(0);

  // Optional: the Home avatar passes its already-computed net worth along
  // when it links here (see index.tsx), so the "how far to the next tier"
  // hint below reads the exact same figure the hero card uses instead of a
  // second computation that could quietly drift from it. Settings and the
  // card's own "See all tiers" link don't have that figure in scope, so the
  // hint simply doesn't render for those entry points — the tier cards'
  // "From X EGP" thresholds already carry the same information on their own.
  const { netWorthEgp: netWorthParam } = useLocalSearchParams<{ netWorthEgp?: string }>();
  const netWorthEgp = Number(netWorthParam);
  const progress = Number.isFinite(netWorthEgp) && netWorthEgp > 0
    ? progressToNext(netWorthEgp, currentTier)
    : null;

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.tiersPageTitle}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false}>
          <Text style={[s.intro, { color: colors.mutedForeground }]}>{t.tiersPageIntro}</Text>

          {!!progress && progress.remainingEgp > 0 && (
            <Text style={[s.progressHint, { color: colors.primary }]}>
              {t.tierNextHint(`${fmtCompact(progress.remainingEgp)} EGP`, tierName(progress.next.id, t))}
            </Text>
          )}

          {TIERS.map(tier => (
            <MiniTierCard key={tier.id} id={tier.id} current={currentTier?.id === tier.id} />
          ))}
        </ScrollView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 22 },
  intro: { fontSize: 13.5, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  progressHint: { fontSize: 13.5, fontFamily: 'Inter_700Bold', marginTop: -14 },
});
