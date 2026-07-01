import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Animated, LayoutChangeEvent, Platform, Pressable, RefreshControl,
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

function fmtEGP(n: number, signed = false): string {
  const abs = Math.abs(n).toLocaleString('en-EG', { maximumFractionDigits: 0 });
  if (!signed) return abs;
  return (n >= 0 ? '+' : '−') + abs;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
}

// ─── Animated value counter ───────────────────────────────────────────────────

function useCounterDisplay(target: number): string {
  const anim = useRef(new Animated.Value(target)).current;
  const [text, setText] = useState(target.toLocaleString('en-EG', { maximumFractionDigits: 0 }));
  const prev = useRef(target);

  useEffect(() => {
    const id = anim.addListener(({ value }) => {
      setText(Math.round(value).toLocaleString('en-EG', { maximumFractionDigits: 0 }));
    });
    return () => anim.removeListener(id);
  }, []);

  useEffect(() => {
    if (prev.current === target) return;
    Animated.timing(anim, { toValue: target, duration: 700, useNativeDriver: false }).start();
    prev.current = target;
  }, [target]);

  return text;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

const TIME_FILTERS = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const;
type TimeFilter = typeof TIME_FILTERS[number];

function buildSparkPoints(gainPct: number, filter: TimeFilter, seed: number): number[] {
  const n = 20;
  const magnitudes: Record<TimeFilter, number> = {
    '1D': 0.15, '1W': 0.4, '1M': 0.9, '3M': 2, '1Y': 4, 'ALL': 6,
  };
  const mag = magnitudes[filter];
  let rng = (seed || 1) % 99991;
  const rand = () => { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; };
  let v = 100;
  return Array.from({ length: n }, (_, i) => {
    v += (gainPct / 100) * mag * (i / n) + (rand() - 0.48) * 3;
    return v;
  });
}

function Sparkline({
  gainPct, filter, seed, width, height,
}: {
  gainPct: number; filter: TimeFilter; seed: number; width: number; height: number;
}) {
  const colors = useColors();
  if (width < 10) return null;
  const data = buildSparkPoints(gainPct, filter, seed);
  const color = gainPct >= 0 ? colors.green : colors.red;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + ((max - v) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPts = `0,${height} ${pts.join(' ')} ${width},${height}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0.01" />
        </LinearGradient>
      </Defs>
      <Polygon points={fillPts} fill="url(#sg)" />
      <Polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Live dot ─────────────────────────────────────────────────────────────────

function LiveDot() {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);
  return (
    <View style={liveSt.row}>
      <Animated.View style={[liveSt.dot, { backgroundColor: colors.green, opacity: pulse }]} />
      <Text style={[liveSt.label, { color: colors.green }]}>LIVE</Text>
    </View>
  );
}

const liveSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
});

// ─── Quick action button ──────────────────────────────────────────────────────

function QA({ icon, label, color, onPress }: {
  icon: keyof typeof Feather.glyphMap; label: string; color: string; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity style={qaSt.wrap} onPress={onPress} activeOpacity={0.72}>
      <View style={[qaSt.circle, { backgroundColor: color + '1C' }]}>
        <Feather name={icon} size={19} color={color} />
      </View>
      <Text style={[qaSt.label, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const qaSt = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, flex: 1 },
  circle: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ icon, label, value, pct, color }: {
  icon: keyof typeof Feather.glyphMap; label: string; value: string; pct: string; color: string;
}) {
  return (
    <View style={[chipSt.wrap, { backgroundColor: color + '10', borderColor: color + '28' }]}>
      <Feather name={icon} size={12} color={color} />
      <View style={chipSt.body}>
        <Text style={[chipSt.label, { color: color + 'AA' }]}>{label}</Text>
        <Text style={[chipSt.value, { color }]} numberOfLines={1}>{value}</Text>
      </View>
      <View style={[chipSt.badge, { backgroundColor: color + '22' }]}>
        <Text style={[chipSt.badgeText, { color }]}>{pct}</Text>
      </View>
    </View>
  );
}

const chipSt = StyleSheet.create({
  wrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1, padding: 10,
  },
  body: { flex: 1, minWidth: 0 },
  label: { fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  value: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  badge: { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3, flexShrink: 0 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
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
  const [selectedSeg, setSelectedSeg] = useState<string | null>(null);
  const [sparkWidth, setSparkWidth] = useState(0);

  const summary = useMemo(() => {
    let goldV = 0, silverV = 0, stockV = 0, reV = 0, cost = 0;
    let todayG = 0, todayS = 0;
    for (const h of holdings) {
      const v = computeValue(h, prices);
      const c = computeCost(h);
      cost += c;
      if (h.type === 'gold') { goldV += v; todayG += v * ((prices?.goldChangePercent ?? 0) / 100); }
      else if (h.type === 'silver') { silverV += v; todayS += v * ((prices?.silverChangePercent ?? 0) / 100); }
      else if (h.type === 'stock') stockV += v;
      else reV += v;
    }
    const total = goldV + silverV + stockV + reV;
    const gain = total - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    const todayGain = todayG + todayS;
    const todayPct = total > 0 ? (todayGain / total) * 100 : 0;
    return { total, cost, gain, gainPct, todayGain, todayPct, goldV, silverV, stockV, reV };
  }, [holdings, prices]);

  const displayValue = useCounterDisplay(summary.total);
  const sparkSeed = holdings.reduce((s, h) => s + h.id.charCodeAt(0), 1);

  const isGain = summary.gain >= 0;
  const isTodayGain = summary.todayGain >= 0;
  const gainColor = isGain ? colors.green : colors.red;
  const todayColor = isTodayGain ? colors.green : colors.red;
  const hasHoldings = holdings.length > 0;

  const donutSegs = useMemo(() => [
    { key: 'gold', label: t.gold, value: summary.goldV, color: colors.primary },
    { key: 'silver', label: t.silver, value: summary.silverV, color: colors.silverColor },
    { key: 'stock', label: t.egxStock, value: summary.stockV, color: '#4A9EFF' },
    { key: 'real_estate', label: t.realEstate, value: summary.reV, color: '#A47FCA' },
  ].filter(s => s.value > 0), [summary, colors, t]);

  const visibleHoldings = useMemo(() => {
    const src = selectedSeg ? holdings.filter(h => h.type === selectedSeg) : holdings;
    return [...src].sort((a, b) => computeValue(b, prices) - computeValue(a, prices)).slice(0, 6);
  }, [holdings, prices, selectedSeg]);

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const onSparkLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setSparkWidth(w);
  };

  const handleSeg = (key: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSeg(key);
  };

  const handleTime = (f: TimeFilter) => {
    Haptics.selectionAsync();
    setTimeFilter(f);
  };

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: topInsets + 16, paddingBottom: botInsets + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={[s.appLabel, { color: colors.primary }]}>{t.appName}</Text>
          <Text style={[s.screenTitle, { color: colors.text }]}>{t.portfolio}</Text>
        </View>
        <LiveDot />
      </View>

      {/* ── Hero Card ── */}
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Gold top accent */}
        <View style={[s.accent, { backgroundColor: colors.primary }]} />

        <View style={s.heroBody}>
          {/* Label + last updated */}
          <View style={s.heroTopRow}>
            <Text style={[s.heroLabel, { color: colors.mutedForeground }]}>{t.totalPortfolioValue}</Text>
            {prices && (
              <Text style={[s.lastUpdated, { color: colors.mutedForeground }]}>
                {fmtTime(prices.lastUpdated)}
              </Text>
            )}
          </View>

          {/* Big number */}
          <View style={s.valueRow}>
            <Text style={[s.heroNum, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {displayValue}
            </Text>
            <Text style={[s.heroCur, { color: colors.mutedForeground }]}>EGP</Text>
          </View>

          {/* P/L chips */}
          {summary.cost > 0 && (
            <View style={s.chipsRow}>
              <StatChip
                icon={isTodayGain ? 'sunrise' : 'sunset'}
                label="Today"
                value={fmtEGP(summary.todayGain, true) + ' EGP'}
                pct={(isTodayGain ? '+' : '') + summary.todayPct.toFixed(2) + '%'}
                color={todayColor}
              />
              <StatChip
                icon={isGain ? 'trending-up' : 'trending-down'}
                label="Total P/L"
                value={fmtEGP(summary.gain, true) + ' EGP'}
                pct={(isGain ? '+' : '') + summary.gainPct.toFixed(2) + '%'}
                color={gainColor}
              />
            </View>
          )}

          {/* Sparkline */}
          {hasHoldings && (
            <>
              <View
                style={[s.sparkContainer, { borderTopColor: colors.border }]}
                onLayout={onSparkLayout}
              >
                {sparkWidth > 0 && (
                  <Sparkline
                    gainPct={summary.gainPct}
                    filter={timeFilter}
                    seed={sparkSeed}
                    width={sparkWidth}
                    height={60}
                  />
                )}
              </View>

              {/* Time filter row */}
              <View style={s.timeRow}>
                {TIME_FILTERS.map(f => {
                  const active = timeFilter === f;
                  return (
                    <Pressable
                      key={f}
                      style={[
                        s.timePill,
                        {
                          backgroundColor: active ? colors.primary : 'transparent',
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => handleTime(f)}
                    >
                      <Text style={[
                        s.timePillText,
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

      {/* ── Quick Actions ── */}
      <View style={[s.card, s.qaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <QA icon="plus-circle" label="Add" color={colors.primary}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/add-investment'); }} />
        <QA icon="award" label="Gold" color="#D4AC0D"
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/markets' as any); }} />
        <QA icon="bar-chart-2" label="Markets" color="#4A9EFF"
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/markets' as any); }} />
        <QA icon="briefcase" label="Holdings" color="#A47FCA"
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/holdings' as any); }} />
        <QA icon="settings" label="Settings" color={colors.mutedForeground}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/settings' as any); }} />
      </View>

      {/* ── Allocation ── */}
      {hasHoldings && summary.total > 0 && donutSegs.length > 0 && (
        <View style={[s.card, s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>ALLOCATION</Text>
            {selectedSeg && (
              <TouchableOpacity onPress={() => handleSeg(null)}>
                <Text style={[s.clearBtn, { color: colors.primary }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <DonutChart
            segments={donutSegs}
            selectedKey={selectedSeg}
            onSelect={handleSeg}
            size={144}
            strokeWidth={19}
          />
        </View>
      )}

      {/* ── Top Investments ── */}
      <View style={s.holdingsSection}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
            {selectedSeg
              ? (donutSegs.find(d => d.key === selectedSeg)?.label ?? '').toUpperCase() + ' HOLDINGS'
              : visibleHoldings.length > 0 ? t.topHoldings : t.holdings.toUpperCase()}
          </Text>
          {holdings.length > 0 && (
            <View style={[s.badge, { backgroundColor: colors.muted }]}>
              <Text style={[s.badgeText, { color: colors.mutedForeground }]}>
                {selectedSeg ? holdings.filter(h => h.type === selectedSeg).length : holdings.length}
              </Text>
            </View>
          )}
        </View>

        {visibleHoldings.length === 0 ? (
          <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name="briefcase" size={26} color={colors.primary + 'AA'} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.text }]}>{t.noInvestmentsYet}</Text>
            <Text style={[s.emptySub, { color: colors.mutedForeground }]}>{t.addFromHoldingsTab}</Text>
          </View>
        ) : (
          <View style={s.holdingsList}>
            {visibleHoldings.map(h => <HoldingCard key={h.id} holding={h} prices={prices} />)}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', paddingHorizontal: 2, marginBottom: 4,
  },
  appLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.5, marginBottom: 4 },
  screenTitle: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -1 },

  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  accent: { height: 3, width: '100%' },
  heroBody: { padding: 18, gap: 14 },

  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  lastUpdated: { fontSize: 10, fontFamily: 'Inter_400Regular' },

  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  heroNum: { flex: 1, fontSize: 44, fontFamily: 'Inter_700Bold', letterSpacing: -2, lineHeight: 50 },
  heroCur: { fontSize: 17, fontFamily: 'Inter_500Medium', paddingBottom: 4 },

  chipsRow: { flexDirection: 'row', gap: 10 },

  sparkContainer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, minHeight: 60 },
  timeRow: { flexDirection: 'row', gap: 6 },
  timePill: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  timePillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  qaCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 16 },

  sectionCard: { padding: 18, gap: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
  clearBtn: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  holdingsSection: { gap: 10 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  holdingsList: { gap: 8 },

  empty: {
    borderRadius: 20, borderWidth: 1,
    paddingVertical: 44, paddingHorizontal: 24, alignItems: 'center', gap: 10,
  },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});
