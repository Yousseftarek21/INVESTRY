import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Animated, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import Svg, { Polyline, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { DonutChart } from '@/components/DonutChart';
import { HoldingCard } from '@/components/HoldingCard';
import { Holding, MarketPrices } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeHoldingValue(h: Holding, prices?: MarketPrices): number {
  if (!prices) return 0;
  if (h.type === 'gold') return h.grams * goldPricePerGram(prices, h.karat);
  if (h.type === 'silver') return h.grams * silverPricePerGram(prices);
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.currentValue;
  return 0;
}

function computeHoldingCost(h: Holding): number {
  if (h.type === 'gold') return h.grams * h.purchasePricePerGram;
  if (h.type === 'silver') return h.grams * h.purchasePricePerGram;
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.purchasePrice;
  return 0;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
}

function fmtEGP(n: number, signed = false): string {
  const abs = Math.abs(n).toLocaleString('en-EG', { maximumFractionDigits: 0 });
  if (signed) return (n >= 0 ? '+' : '−') + abs;
  return abs;
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function useAnimatedCounter(target: number): string {
  const anim = useRef(new Animated.Value(target)).current;
  const [display, setDisplay] = useState(
    target.toLocaleString('en-EG', { maximumFractionDigits: 0 })
  );
  const prev = useRef(target);

  useEffect(() => {
    const id = anim.addListener(({ value }) => {
      setDisplay(Math.round(value).toLocaleString('en-EG', { maximumFractionDigits: 0 }));
    });
    return () => anim.removeListener(id);
  }, []);

  useEffect(() => {
    if (prev.current === target) return;
    Animated.timing(anim, {
      toValue: target,
      duration: 700,
      useNativeDriver: false,
    }).start(() => { prev.current = target; });
  }, [target]);

  return display;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

const TIME_FILTERS = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const;
type TimeFilter = typeof TIME_FILTERS[number];

function generateSparkline(gainPercent: number, filter: TimeFilter, seed: number): number[] {
  const points = 24;
  const data: number[] = [];
  // Use a deterministic pseudo-random from seed
  let rng = seed || 1;
  const rand = () => { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; };

  // Trend magnitude based on filter
  const multipliers: Record<TimeFilter, number> = {
    '1D': 0.2, '1W': 0.5, '1M': 1.0, '3M': 2.0, '1Y': 4.0, 'ALL': 6.0,
  };
  const m = multipliers[filter];
  const trend = (gainPercent / 100) * m;

  let val = 100;
  for (let i = 0; i < points; i++) {
    val += trend * (i / points) + (rand() - 0.5) * 4;
    data.push(val);
  }
  return data;
}

function Sparkline({
  gainPercent, filter, width, height, seed,
}: {
  gainPercent: number; filter: TimeFilter; width: number; height: number; seed: number;
}) {
  const colors = useColors();
  const data = generateSparkline(gainPercent, filter, seed);
  const isPos = gainPercent >= 0;
  const lineColor = isPos ? colors.green : colors.red;

  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const range = maxV - minV || 1;
  const pad = 4;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + ((maxV - v) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const firstX = 0;
  const lastX = width;
  const firstY = pad + ((maxV - data[0]) / range) * (height - pad * 2);
  const lastY = pad + ((maxV - data[data.length - 1]) / range) * (height - pad * 2);
  const fillPts = `${firstX},${height} ${pts.join(' ')} ${lastX},${height}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="spark_fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lineColor} stopOpacity="0.3" />
          <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Polygon points={fillPts} fill="url(#spark_fill)" />
      <Polyline
        points={pts.join(' ')}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Live Indicator ───────────────────────────────────────────────────────────

function LiveIndicator() {
  const colors = useColors();
  const ring = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ring, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.5, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });

  return (
    <View style={liveSt.wrap}>
      <View style={liveSt.dotContainer}>
        <Animated.View style={[liveSt.ring, { borderColor: colors.green, transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
        <Animated.View style={[liveSt.dot, { backgroundColor: colors.green, opacity: dot }]} />
      </View>
      <Text style={[liveSt.text, { color: colors.green }]}>LIVE</Text>
    </View>
  );
}

const liveSt = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dotContainer: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
});

// ─── Quick Action ─────────────────────────────────────────────────────────────

function QuickAction({
  icon, label, color, onPress,
}: {
  icon: keyof typeof Feather.glyphMap; label: string; color: string; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity style={qaSt.btn} onPress={onPress} activeOpacity={0.75}>
      <View style={[qaSt.iconWrap, { backgroundColor: color + '1A' }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={[qaSt.label, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const qaSt = StyleSheet.create({
  btn: { alignItems: 'center', gap: 7, width: 68 },
  iconWrap: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { data: prices, isLoading: pricesLoading, refetch } = useMarketPrices();
  const isLoading = pricesLoading || holdingsLoading;

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const summary = useMemo(() => {
    let goldValue = 0, silverValue = 0, stockValue = 0, realEstateValue = 0, totalCost = 0;
    let todayGold = 0, todaySilver = 0;

    for (const h of holdings) {
      const v = computeHoldingValue(h, prices);
      const c = computeHoldingCost(h);
      totalCost += c;
      if (h.type === 'gold') {
        goldValue += v;
        // approximate today's change
        todayGold += v * ((prices?.goldChangePercent ?? 0) / 100);
      } else if (h.type === 'silver') {
        silverValue += v;
        todaySilver += v * ((prices?.silverChangePercent ?? 0) / 100);
      } else if (h.type === 'stock') {
        stockValue += v;
      } else if (h.type === 'real_estate') {
        realEstateValue += v;
      }
    }

    const totalValue = goldValue + silverValue + stockValue + realEstateValue;
    const gain = totalValue - totalCost;
    const gainPercent = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    const todayGain = todayGold + todaySilver;
    const todayGainPercent = totalValue > 0 ? (todayGain / totalValue) * 100 : 0;

    return {
      totalValue, totalCost, gain, gainPercent,
      todayGain, todayGainPercent,
      goldValue, silverValue, stockValue, realEstateValue,
    };
  }, [holdings, prices]);

  // Animated display string for portfolio value
  const displayValue = useAnimatedCounter(summary.totalValue);

  // Sparkline seed from holdings (deterministic)
  const sparkSeed = holdings.reduce((s, h) => s + h.id.charCodeAt(0), 1);

  const isGain = summary.gain >= 0;
  const isTodayGain = summary.todayGain >= 0;
  const gainColor = isGain ? colors.green : colors.red;
  const todayColor = isTodayGain ? colors.green : colors.red;
  const hasHoldings = holdings.length > 0;

  // Top holdings, filtered by selected segment
  const visibleHoldings = useMemo(() => {
    const filtered = selectedSegment
      ? holdings.filter(h => h.type === selectedSegment)
      : holdings;
    return [...filtered]
      .sort((a, b) => computeHoldingValue(b, prices) - computeHoldingValue(a, prices))
      .slice(0, 5);
  }, [holdings, prices, selectedSegment]);

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const donutSegments = [
    { key: 'gold', label: t.gold, value: summary.goldValue, color: colors.primary },
    { key: 'silver', label: t.silver, value: summary.silverValue, color: colors.silverColor },
    { key: 'stock', label: t.egxStock, value: summary.stockValue, color: '#4A9EFF' },
    { key: 'real_estate', label: t.realEstate, value: summary.realEstateValue, color: '#A47FCA' },
  ].filter(s => s.value > 0);

  const handleSegmentSelect = (key: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSegment(key);
  };

  const handleTimeFilter = (f: TimeFilter) => {
    Haptics.selectionAsync();
    setTimeFilter(f);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topInsets + 16, paddingBottom: botInsets + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.appLabel, { color: colors.primary }]}>{t.appName}</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t.portfolio}</Text>
        </View>
        <LiveIndicator />
      </View>

      {/* ── Hero Card ───────────────────────────────────────────────────────── */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Gold accent bar */}
        <View style={[styles.heroAccent, { backgroundColor: colors.primary }]} />

        {/* Background glow */}
        <View style={[styles.heroGlow, { backgroundColor: colors.primary + '06' }]} />

        <View style={styles.heroInner}>
          {/* Top row: label + last updated */}
          <View style={styles.heroTopRow}>
            <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>
              {t.totalPortfolioValue}
            </Text>
            {prices && (
              <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>
                {formatTime(prices.lastUpdated)}
              </Text>
            )}
          </View>

          {/* Portfolio value (animated) */}
          <View style={styles.valueRow}>
            <Text
              style={[styles.heroValue, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {displayValue}
            </Text>
            <Text style={[styles.heroCurrency, { color: colors.mutedForeground }]}>EGP</Text>
          </View>

          {/* Today + Total gain row */}
          {summary.totalCost > 0 && (
            <View style={styles.statsRow}>
              {/* Today */}
              <View style={[styles.statChip, { backgroundColor: todayColor + '12', borderColor: todayColor + '28' }]}>
                <Feather name={isTodayGain ? 'sunrise' : 'sunset'} size={11} color={todayColor} />
                <View>
                  <Text style={[styles.statChipLabel, { color: todayColor + 'BB' }]}>Today</Text>
                  <Text style={[styles.statChipValue, { color: todayColor }]}>
                    {fmtEGP(summary.todayGain, true)} EGP
                  </Text>
                </View>
                <View style={[styles.pctBadge, { backgroundColor: todayColor + '22' }]}>
                  <Text style={[styles.pctText, { color: todayColor }]}>
                    {isTodayGain ? '+' : ''}{summary.todayGainPercent.toFixed(2)}%
                  </Text>
                </View>
              </View>

              {/* Total */}
              <View style={[styles.statChip, { backgroundColor: gainColor + '12', borderColor: gainColor + '28' }]}>
                <Feather name={isGain ? 'trending-up' : 'trending-down'} size={11} color={gainColor} />
                <View>
                  <Text style={[styles.statChipLabel, { color: gainColor + 'BB' }]}>Total P/L</Text>
                  <Text style={[styles.statChipValue, { color: gainColor }]}>
                    {fmtEGP(summary.gain, true)} EGP
                  </Text>
                </View>
                <View style={[styles.pctBadge, { backgroundColor: gainColor + '22' }]}>
                  <Text style={[styles.pctText, { color: gainColor }]}>
                    {isGain ? '+' : ''}{summary.gainPercent.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Sparkline + Time Filters */}
          {hasHoldings && (
            <>
              <View style={[styles.sparkWrap, { borderColor: colors.border }]}>
                <Sparkline
                  gainPercent={summary.gainPercent}
                  filter={timeFilter}
                  width={280}
                  height={64}
                  seed={sparkSeed}
                />
              </View>

              {/* Time filter pills */}
              <View style={styles.timeFilters}>
                {TIME_FILTERS.map(f => {
                  const active = timeFilter === f;
                  return (
                    <Pressable
                      key={f}
                      style={[
                        styles.timePill,
                        active
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: 'transparent', borderColor: colors.border },
                      ]}
                      onPress={() => handleTimeFilter(f)}
                    >
                      <Text style={[
                        styles.timePillText,
                        { color: active ? colors.primaryForeground : colors.mutedForeground },
                      ]}>
                        {f}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <View style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <QuickAction
          icon="plus-circle"
          label="Add"
          color={colors.primary}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/add-investment');
          }}
        />
        <QuickAction
          icon="award"
          label="Buy Gold"
          color="#D4AC0D"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(tabs)/markets' as any);
          }}
        />
        <QuickAction
          icon="bar-chart-2"
          label="Markets"
          color="#4A9EFF"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(tabs)/markets' as any);
          }}
        />
        <QuickAction
          icon="briefcase"
          label="Holdings"
          color="#A47FCA"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(tabs)/holdings' as any);
          }}
        />
        <QuickAction
          icon="sliders"
          label="Settings"
          color={colors.mutedForeground}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(tabs)/settings' as any);
          }}
        />
      </View>

      {/* ── Allocation ───────────────────────────────────────────────────────── */}
      {hasHoldings && summary.totalValue > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              PORTFOLIO ALLOCATION
            </Text>
            {selectedSegment && (
              <Pressable onPress={() => handleSegmentSelect(null)}>
                <Text style={[styles.clearFilter, { color: colors.primary }]}>Clear filter</Text>
              </Pressable>
            )}
          </View>
          <DonutChart
            segments={donutSegments}
            selectedKey={selectedSegment}
            onSelect={handleSegmentSelect}
            size={148}
            strokeWidth={20}
          />
        </View>
      )}

      {/* ── Top Investments ─────────────────────────────────────────────────── */}
      <View style={styles.holdingsSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeaderLabel, { color: colors.mutedForeground }]}>
            {selectedSegment
              ? donutSegments.find(s => s.key === selectedSegment)?.label.toUpperCase() + ' HOLDINGS'
              : visibleHoldings.length > 0 ? t.topHoldings : t.holdings.toUpperCase()}
          </Text>
          {holdings.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.countText, { color: colors.mutedForeground }]}>
                {selectedSegment
                  ? holdings.filter(h => h.type === selectedSegment).length
                  : holdings.length}
              </Text>
            </View>
          )}
        </View>

        {visibleHoldings.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyRing2, { borderColor: colors.primary + '10' }]} />
            <View style={[styles.emptyRing1, { borderColor: colors.primary + '20' }]} />
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="briefcase" size={26} color={colors.primary + 'AA'} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noInvestmentsYet}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              {t.addFromHoldingsTab}
            </Text>
          </View>
        ) : (
          <View style={styles.holdingsList}>
            {visibleHoldings.map(h => (
              <HoldingCard key={h.id} holding={h} prices={prices} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 14 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', marginBottom: 2,
  },
  appLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.8, marginBottom: 4 },
  headerTitle: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -1 },

  // Hero card
  heroCard: {
    borderRadius: 24, borderWidth: 1, overflow: 'hidden',
  },
  heroAccent: { height: 2.5, width: '100%', opacity: 0.9 },
  heroGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 180, borderRadius: 24,
  },
  heroInner: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 14 },

  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  lastUpdated: { fontSize: 10, fontFamily: 'Inter_400Regular' },

  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  heroValue: { fontSize: 46, fontFamily: 'Inter_700Bold', letterSpacing: -2, lineHeight: 52, flex: 1 },
  heroCurrency: { fontSize: 18, fontFamily: 'Inter_500Medium', marginBottom: 6 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9,
  },
  statChipLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  statChipValue: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  pctBadge: { marginLeft: 'auto', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  pctText: { fontSize: 10, fontFamily: 'Inter_700Bold' },

  sparkWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14, marginHorizontal: -20, paddingHorizontal: 20,
    overflow: 'hidden',
  },

  timeFilters: { flexDirection: 'row', gap: 6 },
  timePill: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  timePillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // Quick actions
  quickCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 16,
  },

  // Allocation section
  section: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 20, paddingVertical: 18, gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
  clearFilter: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  // Holdings
  holdingsSection: { gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeaderLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  countBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  holdingsList: { gap: 8 },

  // Empty state
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
