import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Animated, LayoutChangeEvent, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Polyline, Defs, LinearGradient, Stop, Polygon, Circle } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { DonutChart } from '@/components/DonutChart';
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

function holdingLabel(h: Holding): string {
  if (h.type === 'gold') return `${h.karat.toUpperCase()} Gold`;
  if (h.type === 'silver') return 'Silver';
  if (h.type === 'stock') return h.symbol;
  if (h.type === 'real_estate') return h.location || 'Real Estate';
  return '–';
}

function fmtEGP(n: number): string {
  return Math.abs(n).toLocaleString('en-EG', { maximumFractionDigits: 0 });
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
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);
  return (
    <View style={ldSt.row}>
      <Animated.View style={[ldSt.dot, { backgroundColor: colors.green, opacity }]} />
      <Text style={[ldSt.text, { color: colors.green }]}>LIVE</Text>
    </View>
  );
}
const ldSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
});

// ─── Performance chart ────────────────────────────────────────────────────────

const PERIODS = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const;
type Period = typeof PERIODS[number];

function genCurve(gainPct: number, period: Period, seed: number, n = 30): number[] {
  const scale: Record<Period, number> = { '1D': 0.15, '1W': 0.4, '1M': 1, '3M': 2, '1Y': 4, 'ALL': 6 };
  const s = scale[period];
  let r = (seed || 7) % 99991;
  const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  let v = 100;
  return Array.from({ length: n }, (_, i) => {
    v += (gainPct / 100) * s * (i / n) + (rand() - 0.47) * 2.2;
    return v;
  });
}

function PerfChart({ gainPct, period, seed, width, height = 90 }: {
  gainPct: number; period: Period; seed: number; width: number; height: number;
}) {
  const colors = useColors();
  if (width < 10) return <View style={{ height }} />;
  const data = genCurve(gainPct, period, seed);
  const color = gainPct >= 0 ? colors.green : colors.red;
  const minV = Math.min(...data), maxV = Math.max(...data);
  const range = maxV - minV || 1;
  const pad = 4;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + ((maxV - v) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fill = `0,${height} ${pts.join(' ')} ${width},${height}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.22" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Polygon points={fill} fill="url(#cf)" />
      <Polyline points={pts.join(' ')} fill="none" stroke={color}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Health ring (SVG arc) ────────────────────────────────────────────────────

function HealthRing({ score, size = 96 }: { score: number; size: number }) {
  const colors = useColors();
  const sw = 10;
  const r = (size - sw) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const scoreColor = score >= 75 ? colors.green : score >= 50 ? '#F59E0B' : colors.red;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={c} cy={c} r={r} stroke={colors.muted} strokeWidth={sw} fill="none" />
        <Circle cx={c} cy={c} r={r} stroke={scoreColor} strokeWidth={sw} fill="none"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
      </Svg>
      <View style={[ringSt.center, { width: size, height: size }]}>
        <Text style={[ringSt.score, { color: scoreColor }]}>{score}</Text>
        <Text style={[ringSt.out, { color: colors.mutedForeground }]}>/100</Text>
      </View>
    </View>
  );
}
const ringSt = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  score: { fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  out: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: -2 },
});

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, badge, children }: {
  title: string; icon: keyof typeof Feather.glyphMap; badge?: string; children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[scSt.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={scSt.hdr}>
        <View style={[scSt.iconBox, { backgroundColor: colors.muted }]}>
          <Feather name={icon} size={12} color={colors.mutedForeground} />
        </View>
        <Text style={[scSt.title, { color: colors.mutedForeground }]}>{title}</Text>
        {badge !== undefined && (
          <View style={[scSt.badge, { backgroundColor: colors.muted }]}>
            <Text style={[scSt.badgeTxt, { color: colors.mutedForeground }]}>{badge}</Text>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}
const scSt = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 14 },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeTxt: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});

// ─── Metric chip (hero) ───────────────────────────────────────────────────────

function MetricChip({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  const colors = useColors();
  const c = color ?? colors.text;
  return (
    <View style={[mcSt.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Text style={[mcSt.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[mcSt.value, { color: c }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub !== undefined && <Text style={[mcSt.sub, { color: color ? color + 'AA' : colors.mutedForeground }]}>{sub}</Text>}
    </View>
  );
}
const mcSt = StyleSheet.create({
  chip: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 11, gap: 3 },
  label: { fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  value: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 9, fontFamily: 'Inter_500Medium' },
});

// ─── Health row ───────────────────────────────────────────────────────────────

function HealthRow({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const colors = useColors();
  return (
    <View style={hrSt2.row}>
      <Text style={[hrSt2.label, { color: colors.text }]}>{label}</Text>
      <View style={[hrSt2.track, { backgroundColor: colors.muted }]}>
        <View style={[hrSt2.bar, { width: `${(score / max) * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[hrSt2.pts, { color: colors.mutedForeground }]}>{score}/{max}</Text>
    </View>
  );
}
const hrSt2 = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { width: 108, fontSize: 12, fontFamily: 'Inter_500Medium' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
  pts: { width: 34, fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
});

// ─── Insight item ─────────────────────────────────────────────────────────────

function InsightItem({ icon, color, text }: {
  icon: keyof typeof Feather.glyphMap; color: string; text: string;
}) {
  const colors = useColors();
  return (
    <View style={[inSt.row, { backgroundColor: color + '0E', borderColor: color + '25' }]}>
      <View style={[inSt.icon, { backgroundColor: color + '20' }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <Text style={[inSt.text, { color: colors.text }]}>{text}</Text>
    </View>
  );
}
const inSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  text: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});

// ─── Performer row ────────────────────────────────────────────────────────────

function PerformerRow({ rank, label, gainPct, value }: {
  rank: number; label: string; gainPct: number; value: number;
}) {
  const colors = useColors();
  const isGain = gainPct >= 0;
  const gc = isGain ? colors.green : colors.red;
  return (
    <View style={prSt.row}>
      <View style={[prSt.rank, { backgroundColor: colors.muted }]}>
        <Text style={[prSt.rankTxt, { color: colors.mutedForeground }]}>{rank}</Text>
      </View>
      <View style={prSt.body}>
        <Text style={[prSt.label, { color: colors.text }]} numberOfLines={1}>{label}</Text>
        <Text style={[prSt.value, { color: colors.mutedForeground }]}>
          {fmtEGP(value)} EGP
        </Text>
      </View>
      <View style={[prSt.badge, { backgroundColor: gc + '16' }]}>
        <Text style={[prSt.badgeTxt, { color: gc }]}>
          {isGain ? '+' : ''}{gainPct.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}
const prSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rankTxt: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  body: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  value: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  badgeTxt: { fontSize: 12, fontFamily: 'Inter_700Bold' },
});

// ─── Metal stat cell ──────────────────────────────────────────────────────────

function MetalCell({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors = useColors();
  return (
    <View style={[mlSt.cell, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Text style={[mlSt.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[mlSt.value, { color: color ?? colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
const mlSt = StyleSheet.create({
  cell: { flex: 1, minWidth: '46%', borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  label: { fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  value: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { data: prices, isLoading: pricesLoading, refetch } = useMarketPrices();
  const isLoading = pricesLoading || holdingsLoading;

  const [period, setPeriod] = useState<Period>('ALL');
  const [chartWidth, setChartWidth] = useState(0);
  const [donutSel, setDonutSel] = useState<string | null>(null);

  // ── Portfolio maths ──────────────────────────────────────────────────────────
  const sm = useMemo(() => {
    let goldV = 0, silverV = 0, stockV = 0, reV = 0, totalCost = 0;
    let goldCost = 0, silverCost = 0;
    let totalGoldGrams = 0, totalSilverGrams = 0;
    let todayGold = 0, todaySilver = 0;

    for (const h of holdings) {
      const v = computeValue(h, prices);
      const c = computeCost(h);
      totalCost += c;
      if (h.type === 'gold') {
        goldV += v; goldCost += c; totalGoldGrams += h.grams;
        todayGold += v * ((prices?.goldChangePercent ?? 0) / 100);
      } else if (h.type === 'silver') {
        silverV += v; silverCost += c; totalSilverGrams += h.grams;
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
    const goldGainPct = goldCost > 0 ? ((goldV - goldCost) / goldCost) * 100 : 0;
    const silverGainPct = silverCost > 0 ? ((silverV - silverCost) / silverCost) * 100 : 0;
    const goldAvgBuy = totalGoldGrams > 0 ? goldCost / totalGoldGrams : 0;
    const silverAvgBuy = totalSilverGrams > 0 ? silverCost / totalSilverGrams : 0;
    const metalPct = totalValue > 0 ? (goldV + silverV) / totalValue : 0;

    return {
      totalValue, totalCost, gain, gainPct, todayGain, todayPct,
      goldV, silverV, stockV, reV,
      goldCost, silverCost, goldGainPct, silverGainPct,
      totalGoldGrams, totalSilverGrams, goldAvgBuy, silverAvgBuy,
      metalPct,
    };
  }, [holdings, prices]);

  const displayValue = useCounterDisplay(sm.totalValue);
  const sparkSeed = holdings.reduce((s, h) => s + h.id.charCodeAt(0), 1);

  // ── Health score ─────────────────────────────────────────────────────────────
  const typeCount = useMemo(() => new Set(holdings.map(h => h.type)).size, [holdings]);
  const { healthScore, divScore, concScore, hedgeScore, realScore } = useMemo(() => {
    if (!sm.totalValue) return { healthScore: 0, divScore: 0, concScore: 0, hedgeScore: 0, realScore: 0 };
    const d = Math.min(30, typeCount * 8);
    const maxClass = Math.max(sm.goldV, sm.silverV, sm.stockV, sm.reV);
    const maxPct = maxClass / sm.totalValue;
    const cn = maxPct > 0.8 ? 5 : maxPct > 0.6 ? 12 : maxPct > 0.4 ? 20 : 25;
    const hd = sm.metalPct > 0.3 ? 25 : sm.metalPct > 0.15 ? 18 : sm.metalPct > 0 ? 10 : 0;
    const rp = (sm.goldV + sm.silverV + sm.reV) / sm.totalValue;
    const re = rp > 0.5 ? 20 : rp > 0.25 ? 14 : rp > 0 ? 8 : 4;
    return { healthScore: Math.min(100, d + cn + hd + re), divScore: d, concScore: cn, hedgeScore: hd, realScore: re };
  }, [sm, typeCount]);

  const healthColor = healthScore >= 75 ? colors.green : healthScore >= 50 ? '#F59E0B' : colors.red;
  const healthGrade = healthScore >= 75 ? 'Excellent' : healthScore >= 50 ? 'Good' : 'Needs Work';

  // ── Performers ───────────────────────────────────────────────────────────────
  const performers = useMemo(() =>
    holdings.map(h => {
      const v = computeValue(h, prices);
      const c = computeCost(h);
      return { h, v, gainPct: c > 0 ? ((v - c) / c) * 100 : 0, label: holdingLabel(h) };
    }).sort((a, b) => b.gainPct - a.gainPct),
    [holdings, prices]
  );

  // ── Insights ─────────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    type Insight = { icon: keyof typeof Feather.glyphMap; color: string; text: string };
    const items: Insight[] = [];

    if (!holdings.length) {
      items.push({ icon: 'info', color: colors.primary, text: 'Add your first investment to see personalized insights about your portfolio.' });
      return items;
    }
    if (performers.length > 0 && performers[0].gainPct !== 0) {
      const best = performers[0];
      items.push({ icon: 'trending-up', color: colors.green, text: `${best.label} is your best performer at ${best.gainPct > 0 ? '+' : ''}${best.gainPct.toFixed(1)}% gain.` });
    }
    const worst = performers[performers.length - 1];
    if (worst && worst.gainPct < -2) {
      items.push({ icon: 'trending-down', color: colors.red, text: `${worst.label} is down ${worst.gainPct.toFixed(1)}%. Review this position.` });
    }
    if (typeCount < 2) {
      items.push({ icon: 'alert-triangle', color: '#F59E0B', text: 'Your portfolio is in one asset class. Diversifying across gold, stocks, or real estate can reduce risk.' });
    } else if (typeCount >= 3) {
      items.push({ icon: 'check-circle', color: colors.green, text: `Good diversification — you hold ${typeCount} different asset types.` });
    }
    if (sm.metalPct < 0.1 && sm.totalValue > 0) {
      items.push({ icon: 'shield', color: '#A47FCA', text: 'Precious metals like gold and silver can protect against EGP inflation. Consider allocating 10–20% to metals.' });
    }
    if ((prices?.goldChangePercent ?? 0) > 1) {
      items.push({ icon: 'award', color: colors.primary, text: `Gold is up ${prices?.goldChangePercent.toFixed(2)}% today — your gold holdings are growing.` });
    } else if ((prices?.goldChangePercent ?? 0) < -1) {
      items.push({ icon: 'activity', color: '#F59E0B', text: `Gold is down ${prices?.goldChangePercent.toFixed(2)}% today. Precious metals remain a long-term inflation hedge.` });
    }
    return items.slice(0, 4);
  }, [holdings, performers, typeCount, sm, prices, colors]);

  // ── Segments ─────────────────────────────────────────────────────────────────
  const donutSegs = useMemo(() => [
    { key: 'gold', label: t.gold, value: sm.goldV, color: colors.primary },
    { key: 'silver', label: t.silver, value: sm.silverV, color: colors.silverColor },
    { key: 'stock', label: t.egxStock, value: sm.stockV, color: '#4A9EFF' },
    { key: 'real_estate', label: t.realEstate, value: sm.reV, color: '#A47FCA' },
  ].filter(s => s.value > 0), [sm, colors, t]);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  const hasHoldings = holdings.length > 0;
  const isGain = sm.gain >= 0;
  const gainColor = isGain ? colors.green : colors.red;
  const isTodayGain = sm.todayGain >= 0;
  const todayColor = isTodayGain ? colors.green : colors.red;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: topPad + 16, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={[s.appLabel, { color: colors.primary }]}>INVSTRY</Text>
          <Text style={[s.screenTitle, { color: colors.text }]}>Analytics</Text>
        </View>
        <LiveDot />
      </View>

      {/* ── Hero card ─────────────────────────────────────────────── */}
      <View style={[s.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.heroAccent, { backgroundColor: colors.primary }]} />
        <View style={s.heroBody}>
          <Text style={[s.heroLabel, { color: colors.mutedForeground }]}>Total Portfolio Value</Text>
          <Text style={[s.heroValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {displayValue}
            <Text style={[s.heroCur, { color: colors.mutedForeground }]}>{' '}EGP</Text>
          </Text>
          {hasHoldings && (
            <View style={s.metricsRow}>
              <MetricChip
                label="Today"
                value={`${isTodayGain ? '+' : '−'}${fmtEGP(sm.todayGain)}`}
                sub={`${isTodayGain ? '+' : ''}${sm.todayPct.toFixed(2)}% EGP`}
                color={todayColor}
              />
              <MetricChip
                label="Total Return"
                value={`${isGain ? '+' : '−'}${fmtEGP(sm.gain)}`}
                sub={`${isGain ? '+' : ''}${sm.gainPct.toFixed(2)}% EGP`}
                color={gainColor}
              />
              <MetricChip
                label="Cost Basis"
                value={fmtEGP(sm.totalCost)}
                sub="EGP invested"
              />
            </View>
          )}
        </View>
      </View>

      {/* ── Performance chart ─────────────────────────────────────── */}
      {hasHoldings && (
        <SectionCard title="PORTFOLIO PERFORMANCE" icon="activity">
          <View
            style={[s.chartArea, { borderBottomColor: colors.border }]}
            onLayout={(e: LayoutChangeEvent) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0) setChartWidth(w);
            }}
          >
            <PerfChart gainPct={sm.gainPct} period={period} seed={sparkSeed} width={chartWidth} height={90} />
          </View>
          <Text style={[s.chartNote, { color: colors.mutedForeground }]}>
            Simulated trend based on your portfolio's actual return
          </Text>
          <View style={s.periodRow}>
            {PERIODS.map(p => {
              const active = p === period;
              return (
                <Pressable
                  key={p}
                  style={[s.pill, {
                    backgroundColor: active ? colors.primary : 'transparent',
                    borderColor: active ? colors.primary : colors.border,
                  }]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[s.pillTxt, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>
      )}

      {/* ── Asset allocation ──────────────────────────────────────── */}
      {hasHoldings && donutSegs.length > 0 && (
        <SectionCard title="ASSET ALLOCATION" icon="pie-chart">
          <DonutChart
            segments={donutSegs}
            selectedKey={donutSel}
            onSelect={setDonutSel}
            size={140}
            strokeWidth={18}
          />
        </SectionCard>
      )}

      {/* ── Portfolio health ──────────────────────────────────────── */}
      {hasHoldings && (
        <SectionCard title="PORTFOLIO HEALTH" icon="heart">
          <View style={s.healthRow}>
            <View style={s.healthLeft}>
              <HealthRing score={healthScore} size={96} />
              <Text style={[s.healthGrade, { color: healthColor }]}>{healthGrade}</Text>
            </View>
            <View style={s.healthRight}>
              <HealthRow label="Diversification" score={divScore} max={30} color={colors.primary} />
              <HealthRow label="Balance" score={concScore} max={25} color="#4A9EFF" />
              <HealthRow label="Inflation Hedge" score={hedgeScore} max={25} color="#F59E0B" />
              <HealthRow label="Real Assets" score={realScore} max={20} color="#A47FCA" />
            </View>
          </View>
          <Text style={[s.disclaimer, { color: colors.mutedForeground }]}>
            Informational only — not financial advice.
          </Text>
        </SectionCard>
      )}

      {/* ── Smart insights ────────────────────────────────────────── */}
      <SectionCard title="SMART INSIGHTS" icon="zap" badge={`${insights.length}`}>
        <View style={s.insightsList}>
          {insights.map((ins, i) => (
            <InsightItem key={i} icon={ins.icon} color={ins.color} text={ins.text} />
          ))}
        </View>
        <Text style={[s.disclaimer, { color: colors.mutedForeground }]}>
          Insights are informational only — not financial advice.
        </Text>
      </SectionCard>

      {/* ── Performers ───────────────────────────────────────────── */}
      {performers.length > 0 && (
        <SectionCard title="PERFORMERS" icon="award" badge={`${performers.length}`}>
          <View style={s.performersList}>
            {performers.slice(0, 5).map((p, i) => (
              <PerformerRow key={p.h.id} rank={i + 1} label={p.label} gainPct={p.gainPct} value={p.v} />
            ))}
          </View>
        </SectionCard>
      )}

      {/* ── Gold analytics ────────────────────────────────────────── */}
      {sm.goldV > 0 && (
        <SectionCard title="GOLD ANALYTICS" icon="award">
          <View style={s.metalGrid}>
            <MetalCell label="Total Weight" value={`${sm.totalGoldGrams.toFixed(2)} g`} />
            <MetalCell label="Current Value" value={`${fmtEGP(sm.goldV)} EGP`} color={colors.primary} />
            <MetalCell label="Avg Buy Price" value={`${sm.goldAvgBuy.toFixed(0)} EGP/g`} />
            <MetalCell
              label="Unrealized P/L"
              value={`${sm.goldGainPct >= 0 ? '+' : ''}${sm.goldGainPct.toFixed(2)}%`}
              color={sm.goldGainPct >= 0 ? colors.green : colors.red}
            />
          </View>
          {prices && (
            <View style={[s.metalTip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="info" size={12} color={colors.mutedForeground} />
              <Text style={[s.metalTipTxt, { color: colors.mutedForeground }]}>
                Live gold: {(prices.goldUsd * prices.usdToEgp / 31.1035).toFixed(0)} EGP/g (24K) · USD/EGP {prices.usdToEgp.toFixed(2)}
              </Text>
            </View>
          )}
        </SectionCard>
      )}

      {/* ── Silver analytics ──────────────────────────────────────── */}
      {sm.silverV > 0 && (
        <SectionCard title="SILVER ANALYTICS" icon="circle">
          <View style={s.metalGrid}>
            <MetalCell label="Total Weight" value={`${sm.totalSilverGrams.toFixed(2)} g`} />
            <MetalCell label="Current Value" value={`${fmtEGP(sm.silverV)} EGP`} color={colors.silverColor} />
            <MetalCell label="Avg Buy Price" value={`${sm.silverAvgBuy.toFixed(2)} EGP/g`} />
            <MetalCell
              label="Unrealized P/L"
              value={`${sm.silverGainPct >= 0 ? '+' : ''}${sm.silverGainPct.toFixed(2)}%`}
              color={sm.silverGainPct >= 0 ? colors.green : colors.red}
            />
          </View>
        </SectionCard>
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
  heroBody: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20, gap: 12 },
  heroLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  heroValue: { fontSize: 40, fontFamily: 'Inter_700Bold', letterSpacing: -1.5 },
  heroCur: { fontSize: 17, fontFamily: 'Inter_400Regular', letterSpacing: 0 },
  metricsRow: { flexDirection: 'row', gap: 8 },

  chartArea: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  chartNote: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: -4 },
  periodRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  pillTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  healthLeft: { alignItems: 'center', gap: 8, flexShrink: 0 },
  healthRight: { flex: 1, gap: 10 },
  healthGrade: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  disclaimer: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 16 },

  insightsList: { gap: 8 },
  performersList: { gap: 12 },

  metalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metalTip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
  },
  metalTipTxt: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular' },
});
