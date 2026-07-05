import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Animated, LayoutChangeEvent, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useHoldings } from '@/context/HoldingsContext';
import { useCash } from '@/context/CashContext';
import { useMarketPrices, useGoldHistory, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { useSubscription } from '@/context/SubscriptionContext';
import { AllocationBar } from '@/components/AllocationBar';
import { HoldingCard } from '@/components/HoldingCard';
import { PremiumBadge } from '@/components/PremiumBadge';
import { Holding, MarketPrices } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function personalAssetValueEGP(h: Extract<Holding, { type: 'personal_asset' }>, prices?: MarketPrices): number {
  const v = h.currentValue ?? h.purchasePrice;
  if (h.currency === 'USD' && prices) return v * prices.usdToEgp;
  return v;
}

function personalAssetCostEGP(h: Extract<Holding, { type: 'personal_asset' }>, prices?: MarketPrices): number {
  if (h.currency === 'USD' && prices) return h.purchasePrice * prices.usdToEgp;
  return h.purchasePrice;
}

function computeValue(h: Holding, prices?: MarketPrices): number {
  if (!prices) return 0;
  if (h.type === 'gold') return h.grams * goldPricePerGram(prices, h.karat);
  if (h.type === 'silver') return h.grams * silverPricePerGram(prices);
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.currentValue;
  if (h.type === 'personal_asset') return personalAssetValueEGP(h, prices);
  return 0;
}

function computeCost(h: Holding, prices?: MarketPrices): number {
  if (h.type === 'gold') return h.grams * h.purchasePricePerGram;
  if (h.type === 'silver') return h.grams * h.purchasePricePerGram;
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.purchasePrice;
  if (h.type === 'personal_asset') return personalAssetCostEGP(h, prices);
  return 0;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return n.toLocaleString('en-EG', { maximumFractionDigits: 0 });
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

type Pt = { x: number; y: number; value: number };

function buildSmoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t = 0.25;
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

const TIME_FILTERS = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const;
type TimeFilter = typeof TIME_FILTERS[number];

function getApproxDates(range: TimeFilter, count: number): string[] {
  const now = new Date();
  const shift = (days: number) => { const d = new Date(now); d.setDate(d.getDate() - days); return d; };
  const totalDays: Record<TimeFilter, number> = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365, 'ALL': 1825 };
  const days = totalDays[range];
  return Array.from({ length: count }, (_, i) => {
    if (range === '1D') return i === 0 ? 'Yesterday' : 'Today';
    const daysAgo = Math.round((count - 1 - i) * days / Math.max(count - 1, 1));
    const d = shift(daysAgo);
    if (range === '1W') return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (range === '1M' || range === '3M') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });
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

// ─── Refresh button ───────────────────────────────────────────────────────────

function RefreshButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const colors = useColors();
  const spin = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (loading) {
      anim.current = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' })
      );
      anim.current.start();
    } else {
      anim.current?.stop();
      spin.setValue(0);
    }
  }, [loading]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        rfSt.btn,
        { backgroundColor: colors.muted + '60', opacity: pressed ? 0.5 : 1 },
      ]}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Feather name="refresh-cw" size={13} color={loading ? colors.primary : colors.mutedForeground} />
      </Animated.View>
    </Pressable>
  );
}
const rfSt = StyleSheet.create({
  btn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});

// ─── Live chip ────────────────────────────────────────────────────────────────

function LiveChip({ lastUpdated }: { lastUpdated: Date | null }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.2, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: 1,   duration: 900, useNativeDriver: Platform.OS !== 'web' }),
    ])).start();
  }, []);

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <View style={chipSt.col}>
      <View style={[chipSt.pill, { backgroundColor: colors.green + '14', borderColor: colors.green + '30' }]}>
        <Animated.View style={[chipSt.dot, { backgroundColor: colors.green, opacity }]} />
        <Text style={[chipSt.label, { color: colors.green }]}>LIVE</Text>
      </View>
      {timeStr && (
        <Text style={[chipSt.time, { color: colors.mutedForeground }]}>
          Updated {timeStr}
        </Text>
      )}
    </View>
  );
}
const chipSt = StyleSheet.create({
  col:   { alignItems: 'flex-end', gap: 3 },
  pill:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
  time:  { fontSize: 9, fontFamily: 'Inter_400Regular', letterSpacing: 0.1 },
});

// ─── Interactive Chart ────────────────────────────────────────────────────────

function InteractiveChart({ prices, width, height = 78, timeFilter }: {
  prices: number[] | null; width: number; height?: number; timeFilter: TimeFilter;
}) {
  const colors = useColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [touchIdx, setTouchIdx] = useState<number | null>(null);
  const pricesKey = prices ? prices.join(',') : '';

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 600, delay: 80, useNativeDriver: true,
    }).start();
  }, [pricesKey]);

  if (!prices || prices.length < 2 || width < 10) {
    return (
      <View style={{ height: height + 28, alignItems: 'center', justifyContent: 'center' }}>
        {prices !== null && (
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
            Chart unavailable — pull to refresh
          </Text>
        )}
      </View>
    );
  }

  const color = prices[prices.length - 1] >= prices[0] ? colors.green : colors.red;
  const minV = Math.min(...prices);
  const maxV = Math.max(...prices);
  const range = maxV - minV || 1;
  const vPad = 10;

  const pts: Pt[] = prices.map((v, i) => ({
    x: (i / (prices.length - 1)) * width,
    y: vPad + ((maxV - v) / range) * (height - vPad * 2),
    value: v,
  }));

  const linePath = buildSmoothPath(pts);
  const lastPt = pts[pts.length - 1];
  const fillPath = `${linePath} L ${lastPt.x.toFixed(2)},${height} L 0,${height} Z`;
  const dates = getApproxDates(timeFilter, prices.length);
  const activePt = touchIdx !== null ? pts[touchIdx] : null;

  return (
    <View>
      {/* Tooltip row — always reserves 28px so layout doesn't shift */}
      <View style={chartSt.tooltipRow}>
        {activePt !== null && touchIdx !== null ? (
          <View style={chartSt.tooltipInner}>
            <Text style={[chartSt.ttValue, { color: colors.text }]}>
              ${activePt.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
            <View style={[chartSt.ttDot, { backgroundColor: colors.border }]} />
            <Text style={[chartSt.ttDate, { color: colors.mutedForeground }]}>
              {dates[touchIdx]}
            </Text>
          </View>
        ) : null}
      </View>

      {/* SVG chart with fade-in reveal */}
      <View>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="cgfill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0"   stopColor={color} stopOpacity="0.30" />
                <Stop offset="0.55" stopColor={color} stopOpacity="0.08" />
                <Stop offset="1"   stopColor={color} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d={fillPath} fill="url(#cgfill)" />
            <Path
              d={linePath} fill="none"
              stroke={color} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            />
            {activePt !== null && (
              <>
                <Line
                  x1={activePt.x} y1={0}
                  x2={activePt.x} y2={height}
                  stroke={color + '55'} strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <Circle cx={activePt.x} cy={activePt.y} r={9} fill={color + '20'} />
                <Circle cx={activePt.x} cy={activePt.y} r={4} fill={color} />
              </>
            )}
          </Svg>
        </Animated.View>

        {/* Touch overlay — sits on top, captures drags */}
        <View
          style={[StyleSheet.absoluteFill]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderMove={e => {
            const x = Math.max(0, Math.min(width, e.nativeEvent.locationX));
            const idx = Math.round((x / width) * (prices.length - 1));
            setTouchIdx(Math.max(0, Math.min(prices.length - 1, idx)));
          }}
          onResponderRelease={() => setTouchIdx(null)}
          onResponderTerminate={() => setTouchIdx(null)}
        />
      </View>
    </View>
  );
}

const chartSt = StyleSheet.create({
  tooltipRow:   { height: 24, justifyContent: 'center', marginBottom: 4 },
  tooltipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ttValue:      { fontSize: 13, fontFamily: 'Inter_700Bold' },
  ttDot:        { width: 3, height: 3, borderRadius: 1.5 },
  ttDate:       { fontSize: 11, fontFamily: 'Inter_400Regular' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { cashAccounts, totalCash } = useCash();
  const { data: prices, isLoading: pricesLoading, refetch } = useMarketPrices();
  const { plan, isPro } = useSubscription();
  const { impact } = useHaptic();
  const isLoading = pricesLoading || holdingsLoading;

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('1D');
  const [sparkWidth, setSparkWidth] = useState(0);
  const { data: goldHistory } = useGoldHistory(timeFilter);

  // ── Portfolio maths ────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let goldV = 0, silverV = 0, stockV = 0, reV = 0, paV = 0, totalCost = 0;
    let todayGold = 0, todaySilver = 0;
    let goldGrams = 0, silverGrams = 0, stockCount = 0, reCount = 0, paCount = 0;

    for (const h of holdings) {
      const v = computeValue(h, prices);
      const c = computeCost(h, prices);
      totalCost += c;
      if (h.type === 'gold') {
        goldV += v; goldGrams += h.grams;
        todayGold += v * ((prices?.goldChangePercent ?? 0) / 100);
      } else if (h.type === 'silver') {
        silverV += v; silverGrams += h.grams;
        todaySilver += v * ((prices?.silverChangePercent ?? 0) / 100);
      } else if (h.type === 'stock') {
        stockV += v; stockCount++;
      } else if (h.type === 'personal_asset') {
        paV += v; paCount++;
      } else {
        reV += v; reCount++;
      }
    }

    const totalValue = goldV + silverV + stockV + reV + paV;
    const gain = totalValue - totalCost;
    const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    const todayGain = todayGold + todaySilver;
    const todayPct = totalValue > 0 ? (todayGain / totalValue) * 100 : 0;

    return {
      totalValue, totalCost, gain, gainPct, todayGain, todayPct,
      goldV, silverV, stockV, reV, paV,
      goldGrams, silverGrams, stockCount, reCount, paCount,
    };
  }, [holdings, prices]);

  const displayValue = useCounterDisplay(summary.totalValue);

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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandBlock}>
            <Text style={[styles.appLabel, { color: colors.primary }]}>{t.appName}</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={[styles.screenTitle, { color: colors.text }]}>{t.portfolio}</Text>
            {isPro && <PremiumBadge size="sm" />}
          </View>
        </View>
        <View style={styles.headerRight}>
          <LiveChip lastUpdated={prices?.lastUpdated ?? null} />
        </View>
      </View>

      {/* ── Hero Card ───────────────────────────────────────────── */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ExpoLinearGradient
          colors={[colors.primary + '00', colors.primary + 'CC', colors.primary + '00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroAccent}
        />

        <View style={styles.heroBody}>
          {/* Label */}
          <Text style={[styles.heroLabel, { color: colors.mutedForeground, textAlign: 'center' }]}>
            {t.totalPortfolioValue}
          </Text>

          {/* Big value */}
          <View style={[styles.heroValueRow, { justifyContent: 'center' }]}>
            <Text style={[styles.heroValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {displayValue}
            </Text>
            <Text style={[styles.heroCurrency, { color: colors.mutedForeground }]}>EGP</Text>
          </View>

          {/* Invested · Current · Return strip */}
          {summary.totalCost > 0 && (
            <View style={[styles.iStrip, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
              <View style={styles.iCell}>
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>Invested</Text>
                <View style={styles.iCellValueRow}>
                  <Text style={[styles.iCellValue, { color: colors.text }]}>{fmtCompact(summary.totalCost)}</Text>
                  <Text style={[styles.iCellCur, { color: colors.mutedForeground }]}>EGP</Text>
                </View>
              </View>
              <View style={[styles.iDivider, { backgroundColor: colors.border }]} />
              <View style={styles.iCell}>
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>Current</Text>
                <View style={styles.iCellValueRow}>
                  <Text style={[styles.iCellValue, { color: colors.text }]}>{fmtCompact(summary.totalValue)}</Text>
                  <Text style={[styles.iCellCur, { color: colors.mutedForeground }]}>EGP</Text>
                </View>
              </View>
              <View style={[styles.iDivider, { backgroundColor: colors.border }]} />
              <View style={styles.iCell}>
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>Return</Text>
                <View style={styles.iCellValueRow}>
                  <Text style={[styles.iCellValue, { color: gainColor }]}>
                    {isGain ? '+' : ''}{summary.gainPct.toFixed(1)}%
                  </Text>
                  <Text style={[styles.iCellCur, { color: gainColor + 'AA' }]}>
                    {isGain ? '▲' : '▼'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* P/L row */}
          {summary.totalCost > 0 && (
            <View style={styles.plRow}>
              <View style={[styles.plChip, { backgroundColor: todayColor + '0D', borderColor: todayColor + '20' }]}>
                <View style={styles.plTop}>
                  <Feather name={isTodayGain ? 'trending-up' : 'trending-down'} size={10} color={todayColor + 'CC'} />
                  <Text style={[styles.plLabel, { color: colors.mutedForeground }]}>Today</Text>
                  <View style={[styles.plBadge, { backgroundColor: todayColor + '1A' }]}>
                    <Text style={[styles.plBadgeText, { color: todayColor }]}>
                      {isTodayGain ? '+' : ''}{summary.todayPct.toFixed(2)}%
                    </Text>
                  </View>
                </View>
                <Text style={[styles.plValue, { color: todayColor }]} numberOfLines={1} adjustsFontSizeToFit>
                  {isTodayGain ? '+' : '−'}{Math.abs(summary.todayGain).toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
                </Text>
              </View>

              <View style={[styles.plChip, { backgroundColor: gainColor + '0D', borderColor: gainColor + '20' }]}>
                <View style={styles.plTop}>
                  <Feather name={isGain ? 'trending-up' : 'trending-down'} size={10} color={gainColor + 'CC'} />
                  <Text style={[styles.plLabel, { color: colors.mutedForeground }]}>Total P/L</Text>
                  <View style={[styles.plBadge, { backgroundColor: gainColor + '1A' }]}>
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

          {/* Interactive Chart */}
          {hasHoldings && (
            <>
              <View
                style={[styles.chartWrap, { borderTopColor: colors.border }]}
                onLayout={(e: LayoutChangeEvent) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0) setSparkWidth(w);
                }}
              >
                <InteractiveChart
                  prices={goldHistory ?? null}
                  width={sparkWidth}
                  height={78}
                  timeFilter={timeFilter}
                />
              </View>

              {/* Time filters */}
              <View style={styles.timeRow}>
                {TIME_FILTERS.map(f => {
                  const active = f === timeFilter;
                  return (
                    <Pressable
                      key={f}
                      style={({ pressed }) => [
                        styles.timePill,
                        {
                          backgroundColor: active ? colors.primary : colors.muted + '90',
                          borderColor: active ? colors.primary : 'transparent',
                          opacity: pressed ? 0.7 : 1,
                          transform: [{ scale: pressed ? 0.94 : 1 }],
                        },
                      ]}
                      onPress={() => {
                        if (f !== timeFilter) {
                          if (Platform.OS !== 'web') {
                            impact();
                          }
                          setTimeFilter(f);
                        }
                      }}
                    >
                      <Text style={[styles.timePillText, {
                        color: active ? colors.primaryForeground : colors.mutedForeground,
                      }]}>
                        {f}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* Allocation strip */}
        {hasHoldings && summary.totalValue > 0 && (
          <View style={[styles.allocationStrip, { borderTopColor: colors.border }]}>
            <AllocationBar
              segments={[
                {
                  label: t.gold,     value: summary.goldV,   color: colors.primary,
                  icon: 'award',     quantity: summary.goldGrams > 0 ? `${summary.goldGrams.toFixed(1)}g` : undefined,
                },
                {
                  label: t.silver,   value: summary.silverV, color: colors.silverColor,
                  icon: 'disc',      quantity: summary.silverGrams > 0 ? `${summary.silverGrams.toFixed(1)}g` : undefined,
                },
                {
                  label: t.egxStock, value: summary.stockV,  color: '#4A9EFF',
                  icon: 'bar-chart-2', quantity: summary.stockCount > 0 ? `${summary.stockCount} stock${summary.stockCount !== 1 ? 's' : ''}` : undefined,
                },
                {
                  label: t.realEstate, value: summary.reV,  color: '#A47FCA',
                  icon: 'home',      quantity: summary.reCount > 0 ? `${summary.reCount} propert${summary.reCount !== 1 ? 'ies' : 'y'}` : undefined,
                },
                {
                  label: t.personalAsset, value: summary.paV, color: '#E08E45',
                  icon: 'star',      quantity: summary.paCount > 0 ? `${summary.paCount} asset${summary.paCount !== 1 ? 's' : ''}` : undefined,
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* ── Cash Card ───────────────────────────────────────────── */}
      {cashAccounts.length > 0 && (
        <TouchableOpacity
          style={[styles.cashCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/cash-accounts' as any)}
          activeOpacity={0.85}
        >
          <View style={[styles.cashIconWrap, { backgroundColor: colors.green + '1A' }]}>
            <Feather name="dollar-sign" size={20} color={colors.green} />
          </View>
          <View style={styles.cashInfo}>
            <Text style={[styles.cashLabel, { color: colors.mutedForeground }]}>{t.cash}</Text>
            <Text style={[styles.cashValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {totalCash.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}

      {/* ── Top Investments ─────────────────────────────────────── */}
      <View style={styles.holdingsSection}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {topHoldings.length > 0 ? t.topHoldings : t.holdings.toUpperCase()}
          </Text>
          <View style={styles.sectionRowRight}>
            {holdings.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.countText, { color: colors.mutedForeground }]}>{holdings.length}</Text>
              </View>
            )}
            {holdings.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/holdings')}
                hitSlop={8}
                style={styles.manageBtn}
              >
                <Text style={[styles.manageTxt, { color: colors.primary }]}>Manage</Text>
                <Feather name="chevron-right" size={12} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
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
            {topHoldings.map(h => (
              <HoldingCard
                key={h.id}
                holding={h}
                prices={prices}
                onEdit={() => router.push(`/add-investment?holdingId=${h.id}` as any)}
              />
            ))}
            {holdings.length > 5 && (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/holdings')}
                style={[styles.seeAllBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.seeAllTxt, { color: colors.mutedForeground }]}>
                  See all {holdings.length} investments
                </Text>
                <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
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

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  headerLeft:  { gap: 18, alignItems: 'flex-start' },
  headerRight: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingBottom: 4, marginTop: 10 },
  brandBlock:  { gap: 1, alignItems: 'flex-start' },
  appLabel:    { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: 4 },
  screenTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },

  heroCard:   { borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  heroAccent: { height: 1.25 },
  heroBody:   { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24, gap: 16 },

  cashCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18, paddingVertical: 16, marginTop: 14,
  },
  cashIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cashInfo: { flex: 1, gap: 2 },
  cashLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  cashValue: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },

  heroLabel:      { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  heroValueRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  heroValue:      { fontSize: 46, fontFamily: 'Inter_700Bold', letterSpacing: -2, lineHeight: 52 },
  heroCurrency:   { fontSize: 16, fontFamily: 'Inter_400Regular', letterSpacing: 0, paddingBottom: 6 },

  iStrip:         { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: -24, paddingHorizontal: 24 },
  iCell:          { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  iCellLabel:     { fontSize: 10, fontFamily: 'Inter_400Regular', letterSpacing: 0.2 },
  iCellValueRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  iCellValue:     { fontSize: 14, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  iCellCur:       { fontSize: 9, fontFamily: 'Inter_400Regular' },
  iDivider:       { width: StyleSheet.hairlineWidth, marginVertical: 14 },

  plRow:          { flexDirection: 'row', gap: 8 },
  plChip:         { flex: 1, gap: 5, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10 },
  plTop:          { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plLabel:        { flex: 1, fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  plValue:        { fontSize: 13, fontFamily: 'Inter_700Bold', minWidth: 0 },
  plBadge:        { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  plBadgeText:    { fontSize: 9, fontFamily: 'Inter_700Bold' },

  chartWrap:  { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  timeRow:    { flexDirection: 'row', gap: 5 },
  timePill:   { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  timePillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  allocationStrip: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 20, gap: 0 },

  holdingsSection:  { gap: 12 },
  sectionRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel:     { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2, flex: 1 },
  sectionRowRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  countText:        { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  manageBtn:        { flexDirection: 'row', alignItems: 'center', gap: 2 },
  manageTxt:        { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  empty:        { borderRadius: 22, borderWidth: 1, padding: 40, alignItems: 'center', gap: 12, overflow: 'hidden' },
  emptyRing1:   { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 1, top: -60, right: -60 },
  emptyRing2:   { position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 1, top: -120, right: -100 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptySub:     { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },

  holdingsList: { gap: 8 },
  seeAllBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  seeAllTxt:    { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
