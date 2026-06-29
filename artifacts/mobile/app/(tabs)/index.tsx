import React, { useMemo } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
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

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { holdings } = useHoldings();
  const { data: prices, isLoading, refetch } = useMarketPrices();

  const summary = useMemo(() => {
    let goldValue = 0, silverValue = 0, stockValue = 0, realEstateValue = 0;
    let totalCost = 0;
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
      contentContainerStyle={[styles.content, { paddingTop: topInsets + 16, paddingBottom: botInsets + 90 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>استثمارك</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Portfolio</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: colors.green }]} />
      </View>

      {/* Total Value Hero */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>Total Portfolio Value</Text>
        <Text style={[styles.heroValue, { color: colors.text }]}>
          {summary.totalValue.toLocaleString('en-EG', { maximumFractionDigits: 0 })}
          <Text style={[styles.heroUnit, { color: colors.mutedForeground }]}> EGP</Text>
        </Text>
        {summary.totalCost > 0 && (
          <View style={[styles.gainBadge, { backgroundColor: gainColor + '18' }]}>
            <Feather name={isGain ? 'trending-up' : 'trending-down'} size={13} color={gainColor} />
            <Text style={[styles.gainText, { color: gainColor }]}>
              {isGain ? '+' : ''}{summary.gain.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
              {'  '}({isGain ? '+' : ''}{summary.gainPercent.toFixed(2)}%)
            </Text>
          </View>
        )}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: colors.primary }]}>
              {prices ? prices.usdToEgp.toFixed(2) : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>USD/EGP</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: colors.primary }]}>
              {prices ? Math.round(goldPricePerGram(prices, '21k')).toLocaleString() : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Gold 21k/g</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: colors.silverColor }]}>
              {prices ? silverPricePerGram(prices).toFixed(1) : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Silver/g</Text>
          </View>
        </View>
      </View>

      {/* Allocation bar */}
      {summary.totalValue > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Allocation</Text>
          <AllocationBar
            segments={[
              { label: 'Gold', value: summary.goldValue, color: colors.primary },
              { label: 'Silver', value: summary.silverValue, color: colors.silverColor },
              { label: 'Stocks', value: summary.stockValue, color: '#4A9EFF' },
              { label: 'Real Estate', value: summary.realEstateValue, color: '#A47FCA' },
            ]}
          />
        </View>
      )}

      {/* Top Holdings */}
      <View style={styles.holdingsSection}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {holdings.length > 0 ? 'TOP HOLDINGS' : 'HOLDINGS'}
        </Text>
        {topHoldings.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="briefcase" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No investments yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Add your first holding from the Holdings tab
            </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  greeting: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 14 },
  heroCard: { borderRadius: 20, padding: 20, borderWidth: 1, gap: 10 },
  heroLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  heroValue: { fontSize: 38, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  heroUnit: { fontSize: 18, fontFamily: 'Inter_400Regular' },
  gainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  gainText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  divider: { height: 1, marginVertical: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statVal: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, height: 36 },
  section: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 14 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  holdingsSection: { gap: 10 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  holdingsList: { gap: 8 },
  empty: { borderRadius: 16, padding: 32, borderWidth: 1, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
