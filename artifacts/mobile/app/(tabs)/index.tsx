import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Animated, LayoutChangeEvent, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Polyline, Defs, LinearGradient, Stop, Polygon, Line } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { AllocationBar } from '@/components/AllocationBar';
import { Holding, MarketPrices } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeValue(h: Holding, prices?: MarketPrices): number {
  if (h.type === 'gold') return prices ? h.grams * goldPricePerGram(prices, h.karat) : h.grams * h.purchasePricePerGram;
  if (h.type === 'silver') return prices ? h.grams * silverPricePerGram(prices) : h.grams * h.purchasePricePerGram;
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

function fmt(n: number, decimals = 0): string {
  return Math.abs(n).toLocaleString('en-EG', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function fmtSigned(n: number, decimals = 0): string {
  return (n >= 0 ? '+' : '−') + fmt(n, decimals);
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function useCounterDisplay(target: number): string {
  const anim = useRef(new Animated.Value(target)).current;
  const [text, setText] = useState(target.toLocaleString('en-EG', { maximumFractionDigits: 0 }));
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
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.25, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: 1,   duration: 800, useNativeDriver: Platform.OS !== 'web' }),
    ])).start();
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green, opacity }} />
      <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5, color: colors.green }}>LIVE</Text>
    </View>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

const TIME_FILTERS = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const;
type TimeFilter = typeof TIME_FILTERS[number];
const TIME_SCALE: Record<TimeFilter, number> = { '1D': 0.2, '1W': 0.5, '1M': 1, '3M': 2, '1Y': 4, 'ALL': 6 };

function buildPoints(gainPct: number, filter: TimeFilter, seed: number, n = 28): number[] {
  const scale = TIME_SCALE[filter];
  let r = (seed || 7) % 99991;
  const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  let v = 100;
  return Array.from({ length: n }, (_, i) => {
    v += (gainPct / 100) * scale * (i / n) + (rand() - 0.47) * 2.5;
    return v;
  });
}

function Sparkline({ gainPct, filter, seed, width, height = 72 }: {
  gainPct: number; filter: TimeFilter; seed: number; width: number; height?: number;
}) {
  const colors = useColors();
  if (width < 10) return <View style={{ height }} />;

  const data = buildPoints(gainPct, filter, seed);
  const color = gainPct >= 0 ? colors.green : colors.red;
  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const range = maxV - minV || 1;
  const vPad = 6;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = vPad + ((maxV - v) / range) * (height - vPad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPts = `0,${height} ${pts.join(' ')} ${width},${height}`;
  const lastPt = pts[pts.length - 1].split(',');

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sfill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Polygon points={fillPts} fill="url(#sfill)" />
      <Polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={lastPt[0]} y1="0" x2={lastPt[0]} y2={height.toString()} stroke={color} strokeWidth="1" strokeDasharray="3,3" strokeOpacity="0.4" />
    </Svg>
  );
}

// ─── Metric tile ──────────────────────────────────────────────────────────────

function MetricTile({
  label, value, sub, color, icon, accent,
}: {
  label: string; value: string; sub?: string;
  color?: string; icon: keyof typeof Feather.glyphMap; accent?: string;
}) {
  const colors = useColors();
  const ac = accent ?? colors.primary;
  return (
    <View style={[mt.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[mt.iconWrap, { backgroundColor: ac + '18' }]}>
        <Feather name={icon} size={13} color={ac} />
      </View>
      <Text style={[mt.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[mt.value, { color: color ?? colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={[mt.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}
const mt = StyleSheet.create({
  tile: {
    flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
    padding: 14, gap: 5, minWidth: 0,
  },
  iconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  label: { fontSize: 10, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  value: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  sub: { fontSize: 10, fontFamily: 'Inter_400Regular' },
});

// ─── Allocation type card ──────────────────────────────────────────────────────

function AllocCard({ label, value, total, color, icon }: {
  label: string; value: number; total: number; color: string; icon: keyof typeof Feather.glyphMap;
}) {
  const colors = useColors();
  const pct = total > 0 ? (value / total) * 100 : 0;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct / 100, duration: 700, useNativeDriver: false }).start();
  }, [pct]);

  return (
    <View style={[ac2.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[ac2.iconWrap, { backgroundColor: color + '18' }]}>
        <Feather name={icon} size={13} color={color} />
      </View>
      <Text style={[ac2.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[ac2.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {fmt(value)} <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>EGP</Text>
      </Text>
      <View style={[ac2.barBg, { backgroundColor: colors.muted }]}>
        <Animated.View style={[ac2.barFill, { backgroundColor: color, width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
      <Text style={[ac2.pct, { color }]}>{pct.toFixed(1)}%</Text>
    </View>
  );
}
const ac2 = StyleSheet.create({
  card: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 13, gap: 4, minWidth: 0 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  label: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  value: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  barBg: { height: 3, borderRadius: 2, marginTop: 2 },
  barFill: { height: 3, borderRadius: 2 },
  pct: { fontSize: 11, fontFamily: 'Inter_700Bold' },
});

// ─── Investment Timeline item ──────────────────────────────────────────────────

function TimelineItem({
  holding, prices, isLast,
}: { holding: Holding; prices?: MarketPrices; isLast: boolean }) {
  const colors = useColors();
  const value = computeValue(holding, prices);
  const cost = computeCost(holding);
  const gain = value - cost;
  const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
  const gainColor = gain >= 0 ? colors.green : colors.red;

  const typeColor: Record<string, string> = {
    gold: colors.primary, silver: colors.silverColor ?? '#A8A9AD',
    stock: '#4A9EFF', real_estate: '#A47FCA',
  };
  const typeIcon: Record<string, keyof typeof Feather.glyphMap> = {
    gold: 'award', silver: 'circle', stock: 'bar-chart-2', real_estate: 'home',
  };
  const color = typeColor[holding.type] ?? colors.primary;

  const label =
    holding.type === 'gold' ? `${holding.grams}g ${holding.karat} Gold` :
    holding.type === 'silver' ? `${holding.grams}g Silver` :
    holding.type === 'stock' ? `${holding.shares} × ${holding.symbol}` :
    holding.type === 'real_estate' ? holding.location : '';

  const date = new Date(holding.purchaseDate);
  const dateStr = date.toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={tl.item}>
      <View style={tl.lineCol}>
        <View style={[tl.dot, { backgroundColor: color, borderColor: color + '40' }]} />
        {!isLast && <View style={[tl.line, { backgroundColor: colors.border }]} />}
      </View>
      <View style={tl.body}>
        <View style={tl.row}>
          <View style={[tl.iconWrap, { backgroundColor: color + '18' }]}>
            <Feather name={typeIcon[holding.type]} size={12} color={color} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={[tl.name, { color: colors.text }]} numberOfLines={1}>{label}</Text>
            <Text style={[tl.date, { color: colors.mutedForeground }]}>{dateStr}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 1 }}>
            <Text style={[tl.val, { color: colors.text }]}>{fmt(value)} EGP</Text>
            {cost > 0 && (
              <Text style={[tl.gl, { color: gainColor }]}>
                {fmtSigned(gain)} ({gain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
const tl = StyleSheet.create({
  item: { flexDirection: 'row', gap: 12 },
  lineCol: { alignItems: 'center', width: 14, paddingTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, flexShrink: 0 },
  line: { flex: 1, width: 1.5, marginTop: 4 },
  body: { flex: 1, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  date: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  val: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  gl: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon, count }: { title: string; icon: keyof typeof Feather.glyphMap; count?: number }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Feather name={icon} size={13} color={colors.mutedForeground} />
      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.4, color: colors.mutedForeground, flex: 1 }}>
        {title}
      </Text>
      {count !== undefined && (
        <View style={{ backgroundColor: colors.muted, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>{count}</Text>
        </View>
      )}
    </View>
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
    let goldV = 0, silverV = 0, stockV = 0, reV = 0;
    let goldCost = 0, silverCost = 0, stockCost = 0, reCost = 0;
    let todayGold = 0, todaySilver = 0;

    for (const h of holdings) {
      const v = computeValue(h, prices);
      const c = computeCost(h);

      if (h.type === 'gold') {
        goldV += v; goldCost += c;
        todayGold += v * ((prices?.goldChangePercent ?? 0) / 100);
      } else if (h.type === 'silver') {
        silverV += v; silverCost += c;
        todaySilver += v * ((prices?.silverChangePercent ?? 0) / 100);
      } else if (h.type === 'stock') {
        stockV += v; stockCost += c;
      } else {
        reV += v; reCost += c;
      }
    }

    const totalValue = goldV + silverV + stockV + reV;
    const totalCost = goldCost + silverCost + stockCost + reCost;
    const unrealizedGain = totalValue - totalCost;
    const totalReturnPct = totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0;
    const todayGain = todayGold + todaySilver;
    const todayPct = totalValue > 0 ? (todayGain / totalValue) * 100 : 0;

    return {
      totalValue, totalCost, unrealizedGain, totalReturnPct,
      todayGain, todayPct,
      goldV, silverV, stockV, reV,
      goldCost, silverCost, stockCost, reCost,
    };
  }, [holdings, prices]);

  const displayValue = useCounterDisplay(summary.totalValue);
  const sparkSeed = holdings.reduce((s, h) => s + h.id.charCodeAt(0), 1);

  const isGain = summary.unrealizedGain >= 0;
  const isTodayGain = summary.todayGain >= 0;
  const gainColor = isGain ? colors.green : colors.red;
  const todayColor = isTodayGain ? colors.green : colors.red;
  const hasHoldings = holdings.length > 0;

  const timelineSorted = useMemo(
    () => [...holdings].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()),
    [holdings]
  );

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: topPad + 16, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={[s.appLabel, { color: colors.primary }]}>{t.appName}</Text>
          <Text style={[s.screenTitle, { color: colors.text }]}>{t.portfolio}</Text>
        </View>
        <LiveDot />
      </View>

      {/* ── Hero Card ───────────────────────────────────────────── */}
      <View style={[s.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.heroAccent, { backgroundColor: colors.primary }]} />
        <View style={s.heroBody}>

          <View style={s.labelRow}>
            <Text style={[s.heroLabel, { color: colors.mutedForeground }]}>Total Portfolio Value</Text>
            {prices && (
              <Text style={[s.updatedAt, { color: colors.mutedForeground }]}>
                {prices.lastUpdated.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>

          <Text style={[s.heroValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {displayValue}
            <Text style={[s.heroCurrency, { color: colors.mutedForeground }]}>{' '}EGP</Text>
          </Text>

          {hasHoldings && (
            <View style={s.chipRow}>
              <View style={[s.chip, { backgroundColor: todayColor + '12', borderColor: todayColor + '28' }]}>
                <Feather name={isTodayGain ? 'trending-up' : 'trending-down'} size={11} color={todayColor} />
                <Text style={[s.chipLabel, { color: todayColor + 'BB' }]}>Today</Text>
                <Text style={[s.chipVal, { color: todayColor }]}>
                  {isTodayGain ? '+' : '−'}{fmt(summary.todayGain)} EGP
                </Text>
                <View style={[s.chipBadge, { backgroundColor: todayColor + '20' }]}>
                  <Text style={[s.chipBadgeText, { color: todayColor }]}>
                    {isTodayGain ? '+' : ''}{summary.todayPct.toFixed(2)}%
                  </Text>
                </View>
              </View>

              {summary.totalCost > 0 && (
                <View style={[s.chip, { backgroundColor: gainColor + '12', borderColor: gainColor + '28' }]}>
                  <Feather name={isGain ? 'trending-up' : 'trending-down'} size={11} color={gainColor} />
                  <Text style={[s.chipLabel, { color: gainColor + 'BB' }]}>Total Return</Text>
                  <Text style={[s.chipVal, { color: gainColor }]}>
                    {isGain ? '+' : '−'}{fmt(summary.unrealizedGain)} EGP
                  </Text>
                  <View style={[s.chipBadge, { backgroundColor: gainColor + '20' }]}>
                    <Text style={[s.chipBadgeText, { color: gainColor }]}>
                      {isGain ? '+' : ''}{summary.totalReturnPct.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* ── Key Metrics Grid ────────────────────────────────────── */}
      {hasHoldings && (
        <>
          <SectionHeader title="KEY METRICS" icon="activity" />
          <View style={s.metricsGrid}>
            <View style={s.metricsRow}>
              <MetricTile
                label="Total Invested" icon="arrow-down-circle"
                value={`${fmt(summary.totalCost)} EGP`}
                accent="#4A9EFF"
              />
              <MetricTile
                label="Current Value" icon="dollar-sign"
                value={`${fmt(summary.totalValue)} EGP`}
                accent={colors.primary}
              />
            </View>
            <View style={s.metricsRow}>
              <MetricTile
                label="Unrealized Gain/Loss" icon={isGain ? 'trending-up' : 'trending-down'}
                value={`${isGain ? '+' : '−'}${fmt(summary.unrealizedGain)} EGP`}
                color={gainColor} accent={gainColor}
                sub={`${isGain ? '+' : ''}${summary.totalReturnPct.toFixed(2)}% all time`}
              />
              <MetricTile
                label="Today's Change" icon="clock"
                value={`${isTodayGain ? '+' : '−'}${fmt(summary.todayGain)} EGP`}
                color={todayColor} accent={todayColor}
                sub={`${isTodayGain ? '+' : ''}${summary.todayPct.toFixed(2)}% today`}
              />
            </View>
          </View>
        </>
      )}

      {/* ── Performance Chart ───────────────────────────────────── */}
      {hasHoldings && (
        <>
          <SectionHeader title="LIFETIME PERFORMANCE" icon="bar-chart-2" />
          <View style={[s.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View
              style={s.sparkWrap}
              onLayout={(e: LayoutChangeEvent) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0) setSparkWidth(w);
              }}
            >
              <Sparkline gainPct={summary.totalReturnPct} filter={timeFilter} seed={sparkSeed} width={sparkWidth} height={80} />
            </View>

            <View style={s.chartMeta}>
              <View>
                <Text style={[s.chartMetaLabel, { color: colors.mutedForeground }]}>Period Return</Text>
                <Text style={[s.chartMetaVal, { color: gainColor }]}>
                  {isGain ? '+' : ''}{summary.totalReturnPct.toFixed(2)}%
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.chartMetaLabel, { color: colors.mutedForeground }]}>Unrealized P/L</Text>
                <Text style={[s.chartMetaVal, { color: gainColor }]}>
                  {isGain ? '+' : '−'}{fmt(summary.unrealizedGain)} EGP
                </Text>
              </View>
            </View>

            <View style={[s.timeRow, { borderTopColor: colors.border }]}>
              {TIME_FILTERS.map(f => {
                const active = f === timeFilter;
                return (
                  <Pressable
                    key={f}
                    style={[s.timePill, {
                      backgroundColor: active ? colors.primary : 'transparent',
                      borderColor: active ? colors.primary : colors.border,
                    }]}
                    onPress={() => setTimeFilter(f)}
                  >
                    <Text style={[s.timePillText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                      {f}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      )}

      {/* ── Asset Allocation ────────────────────────────────────── */}
      {hasHoldings && summary.totalValue > 0 && (
        <>
          <SectionHeader title="ASSET ALLOCATION" icon="pie-chart" />
          <View style={[s.allocCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AllocationBar
              segments={[
                { label: t.gold,       value: summary.goldV,   color: colors.primary },
                { label: t.silver,     value: summary.silverV, color: colors.silverColor ?? '#A8A9AD' },
                { label: t.egxStock,   value: summary.stockV,  color: '#4A9EFF' },
                { label: t.realEstate, value: summary.reV,     color: '#A47FCA' },
              ]}
            />
          </View>
          <View style={s.allocGrid}>
            <AllocCard label="Gold"        value={summary.goldV}   total={summary.totalValue} color={colors.primary}           icon="award" />
            <AllocCard label="Silver"      value={summary.silverV} total={summary.totalValue} color={colors.silverColor ?? '#A8A9AD'} icon="circle" />
            <AllocCard label="EGX Stocks"  value={summary.stockV}  total={summary.totalValue} color="#4A9EFF"                  icon="bar-chart-2" />
            <AllocCard label="Real Estate" value={summary.reV}     total={summary.totalValue} color="#A47FCA"                  icon="home" />
          </View>
        </>
      )}

      {/* ── Investment Timeline ──────────────────────────────────── */}
      {timelineSorted.length > 0 && (
        <>
          <SectionHeader title="INVESTMENT TIMELINE" icon="calendar" count={holdings.length} />
          <View style={[s.timelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {timelineSorted.map((h, i) => (
              <TimelineItem
                key={h.id}
                holding={h}
                prices={prices}
                isLast={i === timelineSorted.length - 1}
              />
            ))}
          </View>
        </>
      )}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {!hasHoldings && (
        <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.emptyRing2, { borderColor: colors.primary + '10' }]} />
          <View style={[s.emptyRing1, { borderColor: colors.primary + '20' }]} />
          <View style={[s.emptyIconWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="briefcase" size={26} color={colors.primary + 'AA'} />
          </View>
          <Text style={[s.emptyTitle, { color: colors.text }]}>{t.noInvestmentsYet}</Text>
          <Text style={[s.emptySub, { color: colors.mutedForeground }]}>{t.addFromHoldingsTab}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 2 },
  appLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.5, marginBottom: 4 },
  screenTitle: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: -1.2 },

  heroCard: { borderRadius: 26, borderWidth: 1 },
  heroAccent: { height: 3, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  heroBody: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 22, gap: 14 },

  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  updatedAt: { fontSize: 10, fontFamily: 'Inter_400Regular' },

  heroValue: { fontSize: 44, fontFamily: 'Inter_700Bold', letterSpacing: -1.5 },
  heroCurrency: { fontSize: 18, fontFamily: 'Inter_400Regular', letterSpacing: 0 },

  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1, padding: 9, flexWrap: 'wrap' },
  chipLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  chipVal: { fontSize: 11, fontFamily: 'Inter_700Bold', flex: 1 },
  chipBadge: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  chipBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold' },

  metricsGrid: { gap: 10 },
  metricsRow: { flexDirection: 'row', gap: 10 },

  chartCard: { borderRadius: 22, borderWidth: 1, overflow: 'hidden', paddingTop: 18 },
  sparkWrap: { paddingHorizontal: 16 },
  chartMeta: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  chartMetaLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  chartMetaVal: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  timeRow: { flexDirection: 'row', gap: 6, padding: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  timePill: { flex: 1, borderRadius: 9, borderWidth: 1, paddingVertical: 6, alignItems: 'center' },
  timePillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  allocCard: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 18 },
  allocGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  timelineCard: { borderRadius: 22, borderWidth: 1, padding: 18, paddingBottom: 2 },

  empty: {
    borderRadius: 24, paddingVertical: 52, paddingHorizontal: 24,
    borderWidth: 1, alignItems: 'center', gap: 8, overflow: 'hidden',
  },
  emptyRing1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, top: 14, alignSelf: 'center' },
  emptyRing2: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, top: -16, alignSelf: 'center' },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});
