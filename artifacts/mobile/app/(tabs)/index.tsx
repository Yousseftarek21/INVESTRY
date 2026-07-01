import React, { useMemo, useRef, useEffect } from 'react';
import { Animated, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { AllocationBar } from '@/components/AllocationBar';
import { HoldingCard } from '@/components/HoldingCard';
import { Holding, MarketPrices } from '@/types';

function computeHoldingValue(holding: Holding, prices?: MarketPrices): number {
  if (!prices) return 0;
  if (holding.type === 'gold') return holding.grams * goldPricePerGram(prices, holding.karat);
  if (holding.type === 'silver') return holding.grams * silverPricePerGram(prices);
  if (holding.type === 'stock') return holding.shares * holding.purchasePricePerShare;
  if (holding.type === 'real_estate') return holding.currentValue;
  return 0;
}

function computeHoldingCost(holding: Holding): number {
  if (holding.type === 'gold') return holding.grams * holding.purchasePricePerGram;
  if (holding.type === 'silver') return holding.grams * holding.purchasePricePerGram;
  if (holding.type === 'stock') return holding.shares * holding.purchasePricePerShare;
  if (holding.type === 'real_estate') return holding.purchasePrice;
  return 0;
}

function LiveDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.liveDot, { opacity: pulse }]} />;
}

export default function HomeScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { data: prices, isLoading: pricesLoading, refetch } = useMarketPrices();
  const isLoading = pricesLoading || holdingsLoading;

  const summary = useMemo(() => {
    let goldValue = 0, silverValue = 0, stockValue = 0, realEstateValue = 0, totalCost = 0;
    for (const h of holdings) {
      const v = computeHoldingValue(h, prices);
      const c = computeHoldingCost(h);
      totalCost += c;
      if (h.type === 'gold') goldValue += v;
      else if (h.type === 'silver') silverValue += v;
      else if (h.type === 'stock') stockValue += v;
      else if (h.type === 'real_estate') realEstateValue += v;
    }
    const totalValue = goldValue + silverValue + stockValue + realEstateValue;
    const gain = totalValue - totalCost;
    const gainPercent = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    return { totalValue, totalCost, gain, gainPercent, goldValue, silverValue, stockValue, realEstateValue };
  }, [holdings, prices]);

  const isGain = summary.gain >= 0;
  const gainColor = isGain ? colors.green : colors.red;
  const hasHoldings = holdings.length > 0;

  const topHoldings = useMemo(() => {
    return [...holdings]
      .sort((a, b) => computeHoldingValue(b, prices) - computeHoldingValue(a, prices))
      .slice(0, 5);
  }, [holdings, prices]);

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topInsets + 20, paddingBottom: botInsets + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.appLabel, { color: colors.primary }]}>{t.appName}</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t.portfolio}</Text>
        </View>
        <View style={[styles.livePill, { backgroundColor: colors.green + '18', borderColor: colors.green + '35' }]}>
          <LiveDot />
          <Text style={[styles.liveText, { color: colors.green }]}>{t.live}</Text>
        </View>
      </View>

      {/* Hero Card */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Gold top accent */}
        <View style={[styles.heroAccent, { backgroundColor: colors.primary }]} />

        {/* Decorative glow behind number */}
        <View style={[styles.heroGlow, { backgroundColor: colors.primary + '08' }]} />

        <View style={styles.heroTop}>
          <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>
            {t.totalPortfolioValue}
          </Text>

          <Text style={[styles.heroValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {summary.totalValue > 0
              ? summary.totalValue.toLocaleString('en-EG', { maximumFractionDigits: 0 })
              : '0'}
            <Text style={[styles.heroCurrency, { color: colors.mutedForeground }]}> EGP</Text>
          </Text>

          {summary.totalCost > 0 && (
            <View style={styles.gainRow}>
              <View style={[styles.gainPill, { backgroundColor: gainColor + '15', borderColor: gainColor + '30' }]}>
                <Feather name={isGain ? 'trending-up' : 'trending-down'} size={13} color={gainColor} />
                <Text style={[styles.gainAmount, { color: gainColor }]}>
                  {isGain ? '+' : ''}{summary.gain.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
                </Text>
                <View style={[styles.gainPctBadge, { backgroundColor: gainColor + '25' }]}>
                  <Text style={[styles.gainPct, { color: gainColor }]}>
                    {isGain ? '+' : ''}{summary.gainPercent.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Allocation strip at bottom of hero */}
        {hasHoldings && summary.totalValue > 0 && (
          <View style={[styles.heroAllocation, { borderTopColor: colors.border }]}>
            <AllocationBar
              segments={[
                { label: t.gold,       value: summary.goldValue,       color: colors.primary },
                { label: t.silver,     value: summary.silverValue,     color: colors.silverColor },
                { label: t.egxStock,   value: summary.stockValue,      color: '#4A9EFF' },
                { label: t.realEstate, value: summary.realEstateValue, color: '#A47FCA' },
              ]}
            />
          </View>
        )}
      </View>

      {/* Top Investments */}
      <View style={styles.holdingsSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeaderLabel, { color: colors.mutedForeground }]}>
            {topHoldings.length > 0 ? t.topHoldings : t.holdings.toUpperCase()}
          </Text>
          {topHoldings.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.countText, { color: colors.mutedForeground }]}>{holdings.length}</Text>
            </View>
          )}
        </View>

        {topHoldings.length === 0 && holdingsLoading ? null : topHoldings.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Decorative rings */}
            <View style={[styles.emptyRing2, { borderColor: colors.primary + '10' }]} />
            <View style={[styles.emptyRing1, { borderColor: colors.primary + '20' }]} />
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="briefcase" size={26} color={colors.primary + 'AA'} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noInvestmentsYet}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{t.addFromHoldingsTab}</Text>
          </View>
        ) : (
          <View style={styles.holdingsList}>
            {topHoldings.map(h => (
              <HoldingCard key={h.id} holding={h} prices={prices} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 2 },
  appLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2.5, marginBottom: 4 },
  headerTitle: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: -1.2 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#00D4AA' },
  liveText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },

  heroCard: {
    borderRadius: 26, borderWidth: 1, overflow: 'hidden',
  },
  heroAccent: {
    height: 3, width: '100%', opacity: 0.85,
  },
  heroGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 140, borderRadius: 26,
  },
  heroTop: {
    paddingHorizontal: 22, paddingTop: 20, paddingBottom: 22, gap: 10,
  },
  heroLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  heroValue: { fontSize: 44, fontFamily: 'Inter_700Bold', letterSpacing: -1.5, lineHeight: 52 },
  heroCurrency: { fontSize: 20, fontFamily: 'Inter_400Regular' },

  gainRow: { flexDirection: 'row' },
  gainPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1,
  },
  gainAmount: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  gainPctBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  gainPct: { fontSize: 12, fontFamily: 'Inter_700Bold' },

  heroAllocation: {
    paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth, gap: 14,
  },
  holdingsSection: { gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeaderLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  countBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  holdingsList: { gap: 8 },

  empty: {
    borderRadius: 24, paddingVertical: 52, paddingHorizontal: 24,
    borderWidth: 1, alignItems: 'center', gap: 8, overflow: 'hidden',
  },
  emptyRing1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    borderWidth: 1, top: 14, alignSelf: 'center',
  },
  emptyRing2: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    borderWidth: 1, top: -16, alignSelf: 'center',
  },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});
