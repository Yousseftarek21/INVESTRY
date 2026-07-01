import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Animated, LayoutChangeEvent, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Polyline, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { AllocationBar } from '@/components/AllocationBar';
import { HoldingCard } from '@/components/HoldingCard';
import { Holding, MarketPrices } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeValue(h: Holding, prices?: MarketPrices): number {
  if (!prices) return 0;
  if (h.type === 'gold') return h.grams * goldPricePerGram(prices, h.karat);
  if (h.type === 'silver') return h.grams * silverPricePerGram(prices);
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.currentValue;
  return 0;
}

function computeCost(h: Holding): number {
  if (h.type === 'gold') return h.grams * h.purchasePricePerGram;
  if (h.type === 'silver') return h.grams * h.purchasePricePerGram;
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.purchasePrice;
  return 0;
}

// ─── Animated number display ──────────────────────────────────────────────────

function useCounterDisplay(target: number): string {
  const anim = useRef(new Animated.Value(target)).current;
  const [text, setText] = useState(
    target.toLocaleString('en-EG', { maximumFractionDigits: 0 })
  );
  const prev = useRef(target);

  useEffect(() => {
    const id = anim.addListener(({ value }) =>
      setText(Math.round(value).toLocaleString('en-EG', { maximumFractionDigits: 0 }))
    );
    return () => anim.removeListener(id);
  }, []);

  useEffect(() => {
    if (prev.current === target) return;
    prev.current = target;
    Animated.timing(anim, { toValue: target, duration: 700, useNativeDriver: false }).start();
  }, [target]);

  return text;
}

// ─── Live dot ─────────────────────────────────────────────────────────────────

function LiveDot() {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);
  return (
    <View style={liveSt.row}>
      <Animated.View style={[liveSt.dot, { backgroundColor: colors.green, opacity }]} />
      <Text style={[liveSt.text, { color: colors.green }]}>LIVE</Text>
    </View>
  );
}

const liveSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
});

// ─── Sparkline ────────────────────────────────────────────────────────────────

const TIME_FILTERS = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const;
type TimeFilter = typeof TIME_FILTERS[number];

const TIME_SCALE: Record<TimeFilter, number> = {
  '1D': 0.2, '1W': 0.5, '1M': 1, '3M': 2, '1Y': 4, 'ALL': 6,
};

function buildPoints(gainPct: number, filter: TimeFilter, seed: number, n = 22): number[] {
  const scale = TIME_SCALE[filter];
  let r = (seed || 7) % 99991;
  const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  let v = 100;
  return Array.from({ length: n }, (_, i) => {
    v += (gainPct / 100) * scale * (i / n) + (rand() - 0.47) * 2.5;
    return v;
  });
}

function Sparkline({
  gainPct, filter, seed, width, height = 58,
}: {
  gainPct: number; filter: TimeFilter; seed: number; width: number; height?: number;
}) {
  const colors = useColors();
  if (width < 10) return <View style={{ height }} />;

  const data = buildPoints(gainPct, filter, seed);
  const color = gainPct >= 0 ? colors.green : colors.red;
  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const range = maxV - minV || 1;
  const vPad = 4;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = vPad + ((maxV - v) / range) * (height - vPad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPts = `0,${height} ${pts.join(' ')} ${width},${height}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sfill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.22" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Polygon points={fillPts} fill="url(#sfill)" />
      <Polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { data: prices, isLoading: pricesLoading, refetch } = useMarketPrices();
  const isLoading = pricesLoading || holdingsLoading;

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const [sparkWidth, setSparkWidth] = useState(0);

  // ── Portfolio maths ────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let goldV = 0, silverV = 0, stockV = 0, reV = 0, totalCost = 0;
    let todayGold = 0, todaySilver = 0;

    for (const h of holdings) {
      const v = computeValue(h, prices);
      const c = computeCost(h);
      totalCost += c;
      if (h.type === 'gold') {
        goldV += v;
        todayGold += v * ((prices?.goldChangePercent ?? 0) / 100);
      } else if (h.type === 'silver') {
        silverV += v;
        todaySilver += v * ((prices?.silverChangePercent ?? 0) / 100);
      } else if (h.type === 'stock') {
        stockV += v;
      } else {
        reV += v;
      }
    }

    const totalValue = goldV + silverV + stockV + reV;
    const gain = totalValue - totalCost;
    const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    const todayGain = todayGold + todaySilver;
    const todayPct = totalValue > 0 ? (todayGain / totalValue) * 100 : 0;

    return { totalValue, totalCost, gain, gainPct, todayGain, todayPct, goldV, silverV, stockV, reV };
  }, [holdings, prices]);

  const displayValue = useCounterDisplay(summary.totalValue);
  const sparkSeed = holdings.reduce((s, h) => s + h.id.charCodeAt(0), 1);

  const isGain = summary.gain >= 0;
  const isTodayGain = summary.todayGain >= 0;
  const gainColor = isGain ? colors.green : colors.red;
  const todayColor = isTodayGain ? colors.green : colors.red;
  const hasHoldings = holdings.length > 0;

  const topHoldings = useMemo(
    () => [...holdings].sort((a, b) => computeValue(b, prices) - computeValue(a, prices)).slice(0, 5),
    [holdings, prices]
  );

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const onSparkLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setSparkWidth(w);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.appLabel, { color: colors.primary }]}>{t.appName}</Text>
          <Text style={[styles.screenTitle, { color: colors.text }]}>{t.portfolio}</Text>
        </View>
        <LiveDot />
      </View>

      {/* ── Hero Card ───────────────────────────────────────────── */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Gold top bar */}
        <View style={[styles.heroAccent, { backgroundColor: colors.primary }]} />

        {/* Card body */}
        <View style={styles.heroBody}>

          {/* Label + time */}
          <View style={styles.labelRow}>
            <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>
              {t.totalPortfolioValue}
            </Text>
            {prices && (
              <Text style={[styles.updatedAt, { color: colors.mutedForeground }]}>
                {prices.lastUpdated.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>

          {/* Big value */}
          <View style={styles.valueRow}>
            <Text style={[styles.heroValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {displayValue}
            </Text>
            <Text style={[styles.heroCurrency, { color: colors.mutedForeground }]}>EGP</Text>
          </View>

          {/* P/L row — only when user has cost basis */}
          {summary.totalCost > 0 && (
            <View style={styles.plRow}>
              {/* Today */}
              <View style={[styles.plChip, { backgroundColor: todayColor + '12', borderColor: todayColor + '28' }]}>
                <View style={styles.plTop}>
                  <Feather name={isTodayGain ? 'sunrise' : 'sunset'} size={11} color={todayColor} />
                  <Text style={[styles.plLabel, { color: todayColor + 'CC' }]}>Today</Text>
                  <View style={[styles.plBadge, { backgroundColor: todayColor + '22' }]}>
                    <Text style={[styles.plBadgeText, { color: todayColor }]}>
                      {isTodayGain ? '+' : ''}{summary.todayPct.toFixed(2)}%
                    </Text>
                  </View>
                </View>
                <Text style={[styles.plValue, { color: todayColor }]} numberOfLines={1} adjustsFontSizeToFit>
                  {isTodayGain ? '+' : '−'}{Math.abs(summary.todayGain).toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
                </Text>
              </View>

              {/* Total */}
              <View style={[styles.plChip, { backgroundColor: gainColor + '12', borderColor: gainColor + '28' }]}>
                <View style={styles.plTop}>
                  <Feather name={isGain ? 'trending-up' : 'trending-down'} size={11} color={gainColor} />
                  <Text style={[styles.plLabel, { color: gainColor + 'CC' }]}>Total P/L</Text>
                  <View style={[styles.plBadge, { backgroundColor: gainColor + '22' }]}>
                    <Text style={[styles.plBadgeText, { color: gainColor }]}>
                      {isGain ? '+' : ''}{summary.gainPct.toFixed(2)}%
                    </Text>
                  </View>
                </View>
                <Text style={[styles.plValue, { color: gainColor }]} numberOfLines={1} adjustsFontSizeToFit>
                  {isGain ? '+' : '−'}{Math.abs(summary.gain).toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
                </Text>
              </View>
            </View>
          )}

          {/* Sparkline — only when there are holdings */}
          {hasHoldings && (
            <>
              <View
                style={[styles.sparkWrap, { borderTopColor: colors.border }]}
                onLayout={onSparkLayout}
              >
                <Sparkline
                  gainPct={summary.gainPct}
                  filter={timeFilter}
                  seed={sparkSeed}
                  width={sparkWidth}
                  height={58}
                />
              </View>

              {/* Time filters */}
              <View style={styles.timeRow}>
                {TIME_FILTERS.map(f => {
                  const active = f === timeFilter;
                  return (
                    <Pressable
                      key={f}
                      style={[
                        styles.timePill,
                        {
                          backgroundColor: active ? colors.primary : 'transparent',
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setTimeFilter(f)}
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

        {/* Allocation strip — only when holdings and total > 0 */}
        {hasHoldings && summary.totalValue > 0 && (
          <View style={[styles.allocationStrip, { borderTopColor: colors.border }]}>
            <AllocationBar
              segments={[
                { label: t.gold, value: summary.goldV, color: colors.primary },
                { label: t.silver, value: summary.silverV, color: colors.silverColor },
                { label: t.egxStock, value: summary.stockV, color: '#4A9EFF' },
                { label: t.realEstate, value: summary.reV, color: '#A47FCA' },
              ]}
            />
          </View>
        )}
      </View>

      {/* ── Top Investments ─────────────────────────────────────── */}
      <View style={styles.holdingsSection}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {topHoldings.length > 0 ? t.topHoldings : t.holdings.toUpperCase()}
          </Text>
          {holdings.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.countText, { color: colors.mutedForeground }]}>{holdings.length}</Text>
            </View>
          )}
        </View>

        {topHoldings.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyRing2, { borderColor: colors.primary + '10' }]} />
            <View style={[styles.emptyRing1, { borderColor: colors.primary + '20' }]} />
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="briefcase" size={26} color={colors.primary + 'AA'} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noInvestmentsYet}</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>{t.addFromHoldingsTab}</Text>
          </View>
        ) : (
          <View style={styles.holdingsList}>
            {topHoldings.map(h => <HoldingCard key={h.id} holding={h} prices={prices} />)}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', marginBottom: 2,
  },
  appLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.5, marginBottom: 4 },
  screenTitle: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: -1.2 },

  // Hero card — no overflow:hidden so nothing clips unexpectedly
  heroCard: { borderRadius: 26, borderWidth: 1 },
  heroAccent: { height: 3, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  heroBody: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 22, gap: 14 },

  // Label + updated time
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  updatedAt: { fontSize: 10, fontFamily: 'Inter_400Regular' },

  // Big value
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  heroValue: { flex: 1, fontSize: 44, fontFamily: 'Inter_700Bold', letterSpacing: -1.5, lineHeight: 52 },
  heroCurrency: { fontSize: 18, fontFamily: 'Inter_400Regular', paddingBottom: 5 },

  // P/L chips
  plRow: { flexDirection: 'row', gap: 10 },
  plChip: {
    flex: 1, flexDirection: 'column', gap: 6,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  plTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  plLabel: { flex: 1, fontSize: 10, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  plValue: { fontSize: 15, fontFamily: 'Inter_700Bold', minWidth: 0 },
  plBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  plBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },

  // Sparkline
  sparkWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  timeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  timePill: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  timePillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // Allocation bar
  allocationStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20, gap: 14,
  },

  // Holdings section
  holdingsSection: { gap: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
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
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});
