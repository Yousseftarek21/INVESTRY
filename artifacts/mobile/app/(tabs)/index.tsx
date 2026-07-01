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
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.liveDot, { opacity: pulse }]} />;
}

export default function HomeScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { holdings } = useHoldings();
  const { data: prices, isLoading, refetch } = useMarketPrices();

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
        <View style={[styles.livePill, { backgroundColor: colors.green + '15', borderColor: colors.green + '30' }]}>
          <LiveDot />
          <Text style={[styles.liveText, { color: colors.green }]}>{t.live}</Text>
        </View>
      </View>

      {/* Hero Card */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Subtle gold accent line */}
        <View style={[styles.heroAccent, { backgroundColor: colors.primary }]} />

        <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>{t.totalPortfolioValue}</Text>
        <Text style={[styles.heroValue, { color: colors.text }]}>
          {summary.totalValue > 0
            ? summary.totalValue.toLocaleString('en-EG', { maximumFractionDigits: 0 })
            : '0'}
          <Text style={[styles.heroCurrency, { color: colors.mutedForeground }]}> EGP</Text>
        </Text>

        {summary.totalCost > 0 && (
          <View style={[styles.gainRow, { backgroundColor: gainColor + '12', borderColor: gainColor + '25' }]}>
            <Feather name={isGain ? 'trending-up' : 'trending-down'} size={14} color={gainColor} />
            <Text style={[styles.gainAmount, { color: gainColor }]}>
              {isGain ? '+' : ''}{summary.gain.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
            </Text>
            <View style={[styles.gainPctPill, { backgroundColor: gainColor + '20' }]}>
              <Text style={[styles.gainPct, { color: gainColor }]}>
                {isGain ? '+' : ''}{summary.gainPercent.toFixed(2)}%
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />

        {/* Quick stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: colors.primary }]}>
              {prices ? prices.usdToEgp.toFixed(2) : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>USD/EGP</Text>
          </View>
          <View style={[styles.statSep, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: colors.primary }]}>
              {prices ? Math.round(goldPricePerGram(prices, '21k')).toLocaleString() : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Gold 21k/g</Text>
          </View>
          <View style={[styles.statSep, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: colors.silverColor }]}>
              {prices ? silverPricePerGram(prices).toFixed(0) : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Silver/g</Text>
          </View>
        </View>
      </View>

      {/* Allocation */}
      {summary.totalValue > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="pie-chart" size={14} color={colors.mutedForeground} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.allocation}</Text>
          </View>
          <AllocationBar
            segments={[
              { label: t.gold, value: summary.goldValue, color: colors.primary },
              { label: t.silver, value: summary.silverValue, color: colors.silverColor },
              { label: t.egxStock, value: summary.stockValue, color: '#4A9EFF' },
              { label: t.realEstate, value: summary.realEstateValue, color: '#A47FCA' },
            ]}
          />
        </View>
      )}

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

        {topHoldings.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
              <Feather name="briefcase" size={28} color={colors.mutedForeground} />
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
  content: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 },
  appLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#00D4AA' },
  liveText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  heroCard: {
    borderRadius: 24, padding: 22, borderWidth: 1, gap: 12, overflow: 'hidden',
  },
  heroAccent: { position: 'absolute', top: 0, left: 22, right: 22, height: 2, borderRadius: 1, opacity: 0.6 },
  heroLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3, marginTop: 4 },
  heroValue: { fontSize: 42, fontFamily: 'Inter_700Bold', letterSpacing: -1.5, lineHeight: 50 },
  heroCurrency: { fontSize: 20, fontFamily: 'Inter_400Regular', letterSpacing: 0 },
  gainRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1,
  },
  gainAmount: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  gainPctPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  gainPct: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  heroDivider: { height: StyleSheet.hairlineWidth },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  statLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  statSep: { width: StyleSheet.hairlineWidth, height: 40 },
  section: { borderRadius: 20, padding: 18, borderWidth: 1, gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  holdingsSection: { gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeaderLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  countBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  holdingsList: { gap: 8 },
  empty: { borderRadius: 20, padding: 36, borderWidth: 1, alignItems: 'center', gap: 10 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});
