import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
  Animated, LayoutChangeEvent, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, {
  Defs, LinearGradient, Stop, Path,
} from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { getRECurrentValue } from '@/utils/rePrice';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { useIntradaySamples } from '@/hooks/useIntradaySamples';
import { Holding, MarketPrices } from '@/types';
import { FinancialTools } from '@/components/FinancialTools';
import { PremiumGate } from '@/components/PremiumGate';
import { PerfChart } from '@/components/PerfChart';
import { AllocationBar, AllocationSegment } from '@/components/AllocationBar';
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
function fixedIncomeAccruedValue(h: Extract<Holding, { type: 'fixed_income' }>, asOf: Date = new Date()): number {
  const purchase = new Date(h.purchaseDate);
  const maturity = new Date(h.maturityDate);
  const daysTotal = Math.max(1, (maturity.getTime() - purchase.getTime()) / 86400000);
  const daysElapsed = Math.max(0, Math.min(daysTotal, (asOf.getTime() - purchase.getTime()) / 86400000));
  return h.principal * (1 + (h.annualRate / 100) * (daysElapsed / 365));
}

const ONE_DAY_MS = 86400000;
function computeValue(h: Holding, prices?: MarketPrices): number {
  if (h.type === 'fixed_income') return fixedIncomeAccruedValue(h);
  if (h.type === 'real_estate') return getRECurrentValue(h);
  if (!prices) return 0;
  if (h.type === 'gold') return h.grams * goldPricePerGram(prices, h.karat);
  if (h.type === 'silver') return h.grams * silverPricePerGram(prices);
  if (h.type === 'stock') return h.shares * (prices.egxPrices?.[h.symbol] ?? h.purchasePricePerShare);
  if (h.type === 'personal_asset') return personalAssetValueEGP(h, prices);
  return 0;
}
function computeCost(h: Holding, prices?: MarketPrices): number {
  if (h.type === 'gold') return h.grams * h.purchasePricePerGram;
  if (h.type === 'silver') return h.grams * h.purchasePricePerGram;
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.purchasePrice;
  if (h.type === 'personal_asset') return personalAssetCostEGP(h, prices);
  if (h.type === 'fixed_income') return h.principal;
  return 0;
}
function holdingLabel(h: Holding, labels: { gold: string; silver: string; realEstate: string }): string {
  if (h.type === 'gold') return `${h.karat.toUpperCase()} ${labels.gold}`;
  if (h.type === 'silver') return labels.silver;
  if (h.type === 'stock') return h.symbol;
  if (h.type === 'real_estate') return h.propertyName || labels.realEstate;
  if (h.type === 'personal_asset') return h.name;
  if (h.type === 'fixed_income') return h.label || h.institution;
  return '–';
}
function fmtEGP(n: number): string {
  return Math.abs(n).toLocaleString('en-EG', { maximumFractionDigits: 0 });
}
function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-EG', { maximumFractionDigits: 0 });
}

// ─── Period chart helpers ──────────────────────────────────────────────────────

const PERIODS = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const;
type Period = typeof PERIODS[number];

// ─── Animated arc ring ────────────────────────────────────────────────────────

function HealthArc({ score, size = 160 }: { score: number; size: number }) {
  const colors = useColors();
  const t = useT();
  const { width: screenWidth } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;
  const scoreColor =
    score >= 75 ? colors.green : score >= 50 ? '#F59E0B' : colors.red;
  const grade =
    score >= 75 ? t.healthExcellent : score >= 50 ? t.healthGood : score > 0 ? t.healthNeedsWork : t.healthNoData;

  // Scale down the arc on small screens (iPhone SE = 320pt wide)
  const effectiveSize = Math.min(size, Math.floor(screenWidth * 0.44));
  const scoreFontSize = Math.max(28, Math.floor(effectiveSize * 0.26));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: score,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const sw = Math.max(10, Math.floor(effectiveSize * 0.083));
  const r = (effectiveSize - sw) / 2;
  const cx = effectiveSize / 2;
  const cy = effectiveSize / 2;

  // Arc from 150° to 390° (240° sweep) — bottom-left to bottom-right
  const startDeg = 150;
  const sweepDeg = 240;
  const circ = 2 * Math.PI * r;
  const arcLen = (sweepDeg / 360) * circ;

  function arcPoint(deg: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const s0 = arcPoint(startDeg);
  const s1 = arcPoint(startDeg + sweepDeg);
  const bgPath = `M ${s0.x} ${s0.y} A ${r} ${r} 0 1 1 ${s1.x} ${s1.y}`;
  const filled = (score / 100) * arcLen;

  return (
    <View style={{ width: effectiveSize, height: effectiveSize, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={effectiveSize} height={effectiveSize} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={scoreColor} stopOpacity="0.6" />
            <Stop offset="1" stopColor={scoreColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Path
          d={bgPath}
          fill="none"
          stroke={colors.muted}
          strokeWidth={sw}
          strokeLinecap="round"
        />
        {/* Filled */}
        <Path
          d={bgPath}
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arcLen}`}
        />
      </Svg>
      <View style={{ alignItems: 'center', gap: 2, marginTop: -12 }}>
        <Text
          style={[ha.score, { color: scoreColor, fontSize: scoreFontSize }]}
        >
          {score}
        </Text>
        <Text style={[ha.outOf, { color: colors.mutedForeground }]}>{t.outOf100}</Text>
        <View style={[ha.gradePill, { backgroundColor: scoreColor + '22', borderColor: scoreColor + '44' }]}>
          <Text style={[ha.gradeText, { color: scoreColor }]} numberOfLines={1}>{grade}</Text>
        </View>
      </View>
    </View>
  );
}
const ha = StyleSheet.create({
  score: { fontSize: 44, fontFamily: 'Inter_700Bold', letterSpacing: -2 },
  outOf: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  gradePill: { marginTop: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  gradeText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
});

// ─── Full-width performance chart ─────────────────────────────────────────────

// ─── Podium performers ────────────────────────────────────────────────────────

function PodiumRow({ rank, label, gainPct, value, isFirst }: {
  rank: number; label: string; gainPct: number; value: number; isFirst: boolean;
}) {
  const colors = useColors();
  const isGain = gainPct >= 0;
  const gc = isGain ? colors.green : colors.red;
  const rankColors = ['#C9A227', '#C0C8D4', '#CD7F32'];
  const rankColor = rankColors[rank - 1] ?? colors.mutedForeground;

  return (
    <View style={[pod.row, isFirst && [pod.firstRow, { borderColor: colors.primary + '30', backgroundColor: colors.primary + '08' }]]}>
      <Text style={[pod.rankNum, { color: rankColor }]}>{rank}</Text>
      <View style={pod.body}>
        <Text style={[pod.label, { color: colors.text }, isFirst && pod.labelFirst]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[pod.val, { color: colors.mutedForeground }]}>{fmtK(value)} EGP</Text>
      </View>
      <View style={[pod.badge, { backgroundColor: gc + '18' }]}>
        <Text style={[pod.badgeTxt, { color: gc }]}>
          {isGain ? '+' : ''}{gainPct.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}
const pod = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 14 },
  firstRow: { paddingHorizontal: 12, borderWidth: 1 },
  rankNum: { fontSize: 28, fontFamily: 'Inter_700Bold', width: 34, textAlign: 'center', letterSpacing: -1 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  labelFirst: { fontFamily: 'Inter_700Bold' },
  val: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  badgeTxt: { fontSize: 13, fontFamily: 'Inter_700Bold' },
});

// ─── Insight cards (bordered left accent) ─────────────────────────────────────

function InsightCard({ icon, color, text }: {
  icon: keyof typeof Feather.glyphMap; color: string; text: string;
}) {
  const colors = useColors();
  return (
    <View style={[ic.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[ic.accent, { backgroundColor: color }]} />
      <View style={[ic.iconBox, { backgroundColor: color + '1A' }]}>
        <Feather name={icon} size={15} color={color} />
      </View>
      <Text style={[ic.text, { color: colors.text }]}>{text}</Text>
    </View>
  );
}
const ic = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    paddingRight: 14, paddingVertical: 14,
  },
  accent: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginLeft: -1 },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});

// ─── Health score bars ─────────────────────────────────────────────────────────

type ScoreBarIcon = keyof typeof Feather.glyphMap | { lib: 'mci'; name: string };

function ScoreBar({ label, score, max, color, icon }: {
  label: string; score: number; max: number; color: string; icon: ScoreBarIcon;
}) {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: score / max, duration: 800, useNativeDriver: false }).start();
  }, [score, max]);

  return (
    <View style={sb.row}>
      <View style={[sb.iconBox, { backgroundColor: color + '1A' }]}>
        {typeof icon === 'object' && icon.lib === 'mci'
          ? <MaterialCommunityIcons name={icon.name as any} size={12} color={color} />
          : <Feather name={icon as keyof typeof Feather.glyphMap} size={12} color={color} />}
      </View>
      <View style={sb.body}>
        <View style={sb.topRow}>
          <Text style={[sb.label, { color: colors.text }]}>{label}</Text>
          <Text style={[sb.pts, { color: color }]}>{score}<Text style={[sb.max, { color: colors.mutedForeground }]}>/{max}</Text></Text>
        </View>
        <View style={[sb.track, { backgroundColor: colors.muted }]}>
          <Animated.View style={[sb.fill, { backgroundColor: color, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) as any }]} />
        </View>
      </View>
    </View>
  );
}
const sb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body: { flex: 1, gap: 5 },
  topRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  pts: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  max: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
});

// ─── Metal spotlight card ──────────────────────────────────────────────────────

function MetalSpotlight({ title, grams, value, avgBuy, gainPct, livePrice, tintColor }: {
  title: string; grams: number; value: number; avgBuy: number;
  gainPct: number; livePrice?: number; tintColor: string;
}) {
  const colors = useColors();
  const t = useT();
  const isGain = gainPct >= 0;
  const gc = isGain ? colors.green : colors.red;
  return (
    <View style={[ms.card, { backgroundColor: colors.card, borderColor: tintColor + '30' }]}>
      <View style={[ms.topBar, { backgroundColor: tintColor + '12' }]}>
        <Text style={[ms.title, { color: tintColor }]}>{title}</Text>
        <View style={[ms.gainBadge, { backgroundColor: gc + '1A' }]}>
          <Text style={[ms.gainTxt, { color: gc }]}>{isGain ? '+' : ''}{gainPct.toFixed(2)}%</Text>
        </View>
      </View>
      <View style={ms.body}>
        <View style={ms.statCol}>
          <Text style={[ms.statVal, { color: colors.text }]}>{grams.toFixed(2)}<Text style={[ms.statUnit, { color: colors.mutedForeground }]}> g</Text></Text>
          <Text style={[ms.statLabel, { color: colors.mutedForeground }]}>{t.totalWeight}</Text>
        </View>
        <View style={[ms.divider, { backgroundColor: colors.border }]} />
        <View style={ms.statCol}>
          <Text style={[ms.statVal, { color: tintColor }]}>{fmtK(value)}<Text style={[ms.statUnit, { color: colors.mutedForeground }]}> EGP</Text></Text>
          <Text style={[ms.statLabel, { color: colors.mutedForeground }]}>{t.marketValue}</Text>
        </View>
        <View style={[ms.divider, { backgroundColor: colors.border }]} />
        <View style={ms.statCol}>
          <Text style={[ms.statVal, { color: colors.text }]}>{avgBuy.toFixed(0)}<Text style={[ms.statUnit, { color: colors.mutedForeground }]}> EGP/g</Text></Text>
          <Text style={[ms.statLabel, { color: colors.mutedForeground }]}>{t.avgBuy}</Text>
        </View>
      </View>
      {livePrice !== undefined && (
        <View style={[ms.footer, { borderTopColor: tintColor + '20' }]}>
          <Feather name="radio" size={10} color={tintColor} />
          <Text style={[ms.footerTxt, { color: colors.mutedForeground }]}>
            {t.livePricePrefix}<Text style={{ color: tintColor }}>{livePrice.toFixed(0)} EGP/g</Text>
          </Text>
        </View>
      )}
    </View>
  );
}
const ms = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  gainBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  gainTxt: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  body: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, gap: 0 },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  statUnit: { fontSize: 11, fontFamily: 'Inter_400Regular', letterSpacing: 0 },
  statLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  divider: { width: 1, height: 36, alignSelf: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 10 },
  footerTxt: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});

// ─── Section label ─────────────────────────────────────────────────────────────

type SLabelIcon = keyof typeof Feather.glyphMap | { lib: 'mci'; name: string };
function SLabel({ icon, title, sub }: {
  icon: SLabelIcon; title: string; sub?: string;
}) {
  const colors = useColors();
  const ic = typeof icon === 'object' && icon.lib === 'mci'
    ? <MaterialCommunityIcons name={icon.name as any} size={13} color={colors.mutedForeground} />
    : <Feather name={icon as keyof typeof Feather.glyphMap} size={13} color={colors.mutedForeground} />;
  return (
    <View style={sl.row}>
      <View style={[sl.iconWrap, { backgroundColor: colors.muted }]}>
        {ic}
      </View>
      <Text style={[sl.title, { color: colors.text }]}>{title}</Text>
      {sub && <Text style={[sl.sub, { color: colors.mutedForeground }]}>{sub}</Text>}
    </View>
  );
}
const sl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.1 },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});

// ─── Live dot ─────────────────────────────────────────────────────────────────

function LiveDot() {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.25, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
    ])).start();
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green, opacity }} />
      <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.green, letterSpacing: 1.5 }}>LIVE</Text>
    </View>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  const colors = useColors();
  return (
    <View style={[em.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[em.icon, { backgroundColor: colors.muted }]}>
        <Feather name="bar-chart-2" size={28} color={colors.mutedForeground} />
      </View>
      <Text style={[em.title, { color: colors.text }]}>No analytics yet</Text>
      <Text style={[em.sub, { color: colors.mutedForeground }]}>
        Add investments in the Investments tab and your portfolio analytics will appear here.
      </Text>
    </View>
  );
}
const em = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12 },
  icon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});

// ─── Planning Tool Card (matches FinancialTools ToolCard style) ────────────────

function PlanningToolCard({
  icon, color, label, sub, onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scale, { toValue: 0.93, useNativeDriver: Platform.OS !== 'web' }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: Platform.OS !== 'web' }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[s.planningToolCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[s.planningToolAccent, { backgroundColor: color }]} />
        <View style={[s.planningToolIcon, { backgroundColor: color + '1A' }]}>
          <Feather name={icon} size={22} color={color} />
        </View>
        <Text style={[s.planningToolLabel, { color: colors.text }]} numberOfLines={1}>{label}</Text>
        <Text style={[s.planningToolSub, { color: colors.mutedForeground }]} numberOfLines={1}>{sub}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const t = useT();
  const colors = useColors();
  const router = useRouter();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { data: rawPrices, isLoading: pricesLoading, refetch } = useMarketPrices();
  const { data: egxStocks } = useEGXMarket();
  const prices = useMemo(() => {
    if (!rawPrices) return rawPrices;
    const egxPrices: Record<string, number> = {};
    egxStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
    return { ...rawPrices, egxPrices };
  }, [rawPrices, egxStocks]);
  const isLoading = pricesLoading || holdingsLoading;

  const [period, setPeriod] = useState<Period>('ALL');
  const [chartWidth, setChartWidth] = useState(0);

  // ── Maths ─────────────────────────────────────────────────────────────────────
  const egxChangeByTicker = useMemo(() => {
    const m: Record<string, number> = {};
    egxStocks?.forEach(s => { m[s.ticker] = s.changePercent; });
    return m;
  }, [egxStocks]);

  const sm = useMemo(() => {
    let goldV = 0, silverV = 0, stockV = 0, reV = 0, paV = 0, fiV = 0, totalCost = 0;
    let goldCost = 0, silverCost = 0;
    let totalGoldGrams = 0, totalSilverGrams = 0;
    let stockCount = 0, reCount = 0, paCount = 0;
    let todayGold = 0, todaySilver = 0, todayStock = 0, todayFI = 0;
    for (const h of holdings) {
      const v = computeValue(h, prices);
      const c = computeCost(h, prices);
      totalCost += c;
      if (h.type === 'gold') {
        goldV += v; goldCost += c; totalGoldGrams += h.grams;
        todayGold += v * ((prices?.goldChangePercent ?? 0) / 100);
      } else if (h.type === 'silver') {
        silverV += v; silverCost += c; totalSilverGrams += h.grams;
        todaySilver += v * ((prices?.silverChangePercent ?? 0) / 100);
      }
      else if (h.type === 'stock') {
        stockV += v; stockCount++;
        const changePercent = egxChangeByTicker[h.symbol] ?? 0;
        todayStock += v * (changePercent / 100);
      }
      else if (h.type === 'personal_asset') { paV += v; paCount++; }
      else if (h.type === 'fixed_income') {
        fiV += v;
        const yesterday = new Date(Date.now() - ONE_DAY_MS);
        todayFI += v - fixedIncomeAccruedValue(h, yesterday);
      }
      else { reV += v; reCount++; }
    }
    const totalValue = goldV + silverV + stockV + reV + paV + fiV;
    const gain = totalValue - totalCost;
    const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    const goldGainPct = goldCost > 0 ? ((goldV - goldCost) / goldCost) * 100 : 0;
    const silverGainPct = silverCost > 0 ? ((silverV - silverCost) / silverCost) * 100 : 0;
    const goldAvgBuy = totalGoldGrams > 0 ? goldCost / totalGoldGrams : 0;
    const silverAvgBuy = totalSilverGrams > 0 ? silverCost / totalSilverGrams : 0;
    const metalPct = totalValue > 0 ? (goldV + silverV) / totalValue : 0;
    const todayGain = todayGold + todaySilver + todayStock + todayFI;
    return {
      totalValue, totalCost, gain, gainPct, todayGain,
      goldV, silverV, stockV, reV, paV, fiV,
      goldCost, silverCost, goldGainPct, silverGainPct,
      totalGoldGrams, totalSilverGrams, goldAvgBuy, silverAvgBuy,
      metalPct, stockCount, reCount, paCount,
    };
  }, [holdings, prices, egxChangeByTicker]);

  const { snapshots } = usePortfolioSnapshots(sm.totalValue);
  const startOfDayValue = sm.totalValue - sm.todayGain;
  const rawTodaySamples = useIntradaySamples(sm.totalValue, startOfDayValue);
  // Keep the chart's start/end always freshly consistent with the "Today"
  // badge (which always recomputes live) — see index.tsx for the full
  // explanation. Only the stored samples' middle points (real texture)
  // are used; the endpoints are always the current live numbers.
  const todaySamples = useMemo(() => {
    const middle = rawTodaySamples && rawTodaySamples.length > 2
      ? rawTodaySamples.slice(1, -1)
      : [];
    return [startOfDayValue, ...middle, sm.totalValue];
  }, [rawTodaySamples, startOfDayValue, sm.totalValue]);

  // ── Health ────────────────────────────────────────────────────────────────────
  const typeCount = useMemo(() => new Set(holdings.map(h => h.type)).size, [holdings]);
  const health = useMemo(() => {
    if (!sm.totalValue) return { score: 0, div: 0, conc: 0, hedge: 0, real: 0 };
    const div = Math.min(30, typeCount * 8);
    const maxClass = Math.max(sm.goldV, sm.silverV, sm.stockV, sm.reV, sm.paV, sm.fiV);
    const maxPct = maxClass / sm.totalValue;
    const conc = maxPct > 0.8 ? 5 : maxPct > 0.6 ? 12 : maxPct > 0.4 ? 20 : 25;
    const hedge = sm.metalPct > 0.3 ? 25 : sm.metalPct > 0.15 ? 18 : sm.metalPct > 0 ? 10 : 0;
    const rp = (sm.goldV + sm.silverV + sm.reV) / sm.totalValue;
    const real = rp > 0.5 ? 20 : rp > 0.25 ? 14 : rp > 0 ? 8 : 4;
    return { score: Math.min(100, div + conc + hedge + real), div, conc, hedge, real };
  }, [sm, typeCount]);

  // ── Performers ────────────────────────────────────────────────────────────────
  const performers = useMemo(() =>
    holdings.map(h => {
      const v = computeValue(h, prices);
      const c = computeCost(h, prices);
      return { h, v, gainPct: c > 0 ? ((v - c) / c) * 100 : 0, label: holdingLabel(h, { gold: t.gold, silver: t.silver, realEstate: t.realEstate }) };
    }).sort((a, b) => b.gainPct - a.gainPct),
    [holdings, prices]
  );

  // ── Allocation segs ───────────────────────────────────────────────────────────
  const allocSegs = useMemo<AllocationSegment[]>(() => [
    {
      label: t.gold, value: sm.goldV, color: colors.primary,
      icon: { lib: 'mci' as const, name: 'gold' }, quantity: sm.totalGoldGrams > 0 ? `${sm.totalGoldGrams.toFixed(1)}g` : undefined,
    },
    {
      label: t.silver, value: sm.silverV, color: colors.silverColor,
      icon: { lib: 'mci' as const, name: 'gold' }, quantity: sm.totalSilverGrams > 0 ? `${sm.totalSilverGrams.toFixed(1)}g` : undefined,
    },
    {
      label: t.egxStocksAllocLabel, value: sm.stockV, color: '#4A9EFF',
      icon: 'trending-up', quantity: sm.stockCount > 0 ? `${sm.stockCount} stock${sm.stockCount !== 1 ? 's' : ''}` : undefined,
    },
    {
      label: t.realEstate, value: sm.reV, color: '#A47FCA',
      icon: { lib: 'mci' as const, name: 'home-city' }, quantity: sm.reCount > 0 ? `${sm.reCount} propert${sm.reCount !== 1 ? 'ies' : 'y'}` : undefined,
    },
    {
      label: t.personalAssetsAllocLabel, value: sm.paV, color: '#E08E45',
      icon: { lib: 'mci' as const, name: 'tag-multiple' }, quantity: sm.paCount > 0 ? `${sm.paCount} asset${sm.paCount !== 1 ? 's' : ''}` : undefined,
    },
    {
      label: t.fixedIncome, value: sm.fiV, color: '#22C55E',
      icon: { lib: 'mci' as const, name: 'bank-transfer' },
    },
  ], [sm, colors, t]);

  // ── Insights ──────────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    type I = { icon: keyof typeof Feather.glyphMap; color: string; text: string };
    const items: I[] = [];
    if (!holdings.length) {
      items.push({ icon: 'info', color: colors.primary, text: t.insightFirstInvestment });
      return items;
    }
    if (performers[0]?.gainPct !== 0) {
      const b = performers[0];
      items.push({ icon: 'trending-up', color: colors.green, text: t.insightBestPerformer(b.label, `${b.gainPct > 0 ? '+' : ''}${b.gainPct.toFixed(1)}`) });
    }
    const worst = performers[performers.length - 1];
    if (worst?.gainPct < -2) {
      items.push({ icon: 'trending-down', color: colors.red, text: t.insightWorstPerformer(worst.label, worst.gainPct.toFixed(1)) });
    }
    if (typeCount < 2) {
      items.push({ icon: 'alert-triangle', color: '#F59E0B', text: t.insightLowDiversification });
    } else if (typeCount >= 3) {
      items.push({ icon: 'check-circle', color: colors.green, text: t.insightSolidDiversification(typeCount) });
    }
    if (sm.metalPct < 0.1 && sm.totalValue > 0) {
      items.push({ icon: 'shield', color: '#A47FCA', text: t.insightLowMetals });
    }
    if ((prices?.goldChangePercent ?? 0) > 1) {
      items.push({ icon: 'trending-up', color: colors.primary, text: t.insightGoldUp((prices?.goldChangePercent ?? 0).toFixed(2)) });
    }
    return items.slice(0, 4);
  }, [holdings, performers, typeCount, sm, prices, colors]);

  // ── Live gold/silver price per gram ──────────────────────────────────────────
  const liveGoldG = prices ? (prices.goldUsd * prices.usdToEgp) / 31.1035 : undefined;
  const liveSilverG = prices ? (prices.silverUsd * prices.usdToEgp) / 31.1035 : undefined;

  // ── Market Intelligence data ──────────────────────────────────────────────────
  const marketInsights = useMemo(() => {
    type MI = { icon: keyof typeof Feather.glyphMap; color: string; text: string };
    const items: MI[] = [];
    if (!holdings.length) return items;
    const metalVal = sm.goldV + sm.silverV;
    const metalPct = sm.totalValue > 0 ? (metalVal / sm.totalValue) * 100 : 0;
    if (metalPct > 0) items.push({ icon: 'shield', color: colors.primary, text: t.insightMetalsPct(metalPct.toFixed(0)) });
    if (sm.goldV > 0 && sm.gain > 0) {
      const goldContrib = sm.totalValue > 0 ? (sm.goldV / sm.totalValue) * 100 : 0;
      items.push({ icon: 'layers', color: colors.primary, text: t.insightGoldLargest(goldContrib.toFixed(0)) });
    }
    if (sm.stockV > 0) {
      const stockPct = sm.totalValue > 0 ? (sm.stockV / sm.totalValue) * 100 : 0;
      items.push({ icon: 'bar-chart-2', color: '#4A9EFF', text: t.insightStocksPct(stockPct.toFixed(0)) });
    }
    if (sm.gainPct > 10) {
      items.push({ icon: 'trending-up', color: colors.green, text: t.insightPortfolioUp(sm.gainPct.toFixed(1)) });
    } else if (sm.gainPct < -5) {
      items.push({ icon: 'trending-down', color: colors.red, text: t.insightPortfolioDown(Math.abs(sm.gainPct).toFixed(1)) });
    }
    if (prices?.goldChangePercent && Math.abs(prices.goldChangePercent) > 0.5) {
      items.push({ icon: 'zap', color: '#F59E0B', text: prices.goldChangePercent > 0
        ? t.insightGoldMovedUp(Math.abs(prices.goldChangePercent).toFixed(2))
        : t.insightGoldMovedDown(Math.abs(prices.goldChangePercent).toFixed(2)) });
    }
    return items.slice(0, 4);
  }, [holdings, sm, prices, colors]);

  const hasHoldings = holdings.length > 0;
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  const healthColor = health.score >= 75 ? colors.green : health.score >= 50 ? '#F59E0B' : colors.red;

  return (
    <>
    <Stack.Screen options={{ headerShown: false }} />
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: topPad + 16, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={[s.pageTitle, { color: colors.text }]}>{t.analytics}</Text>
        </View>
      </View>

      {/* ══ SECTION 1: Planning ═══════════════════════════════════════ */}
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: '#22C55E18' }]}>
          <Feather name="compass" size={15} color="#22C55E" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>{t.planningGrowthTools}</Text>
          <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>Set targets & calculate returns</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.planningScroll}
        contentContainerStyle={s.planningScrollContent}
      >
        <PlanningToolCard
          icon="target" color="#22C55E"
          label={t.goals}
          sub="Set a financial target"
          onPress={() => router.push('/goals' as any)}
        />
        <PlanningToolCard
          icon="percent" color="#4A9EFF"
          label={t.tbillsCalculator}
          sub="Egypt T-Bills estimator"
          onPress={() => router.push('/tbills-calculator' as any)}
        />
      </ScrollView>

      {/* ══ SECTION 2: Financial Tools ════════════════════════════════ */}
      <View style={[s.sectionDivider, { backgroundColor: colors.border }]} />
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: colors.primary + '18' }]}>
          <Feather name="tool" size={15} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>{t.financialToolsTitle}</Text>
          <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>{t.financialToolsSub}</Text>
        </View>
        <View style={[s.toolsBadge, { backgroundColor: colors.primary + '18' }]}>
          <Text style={[s.toolsBadgeTxt, { color: colors.primary }]}>8 TOOLS</Text>
        </View>
      </View>
      <FinancialTools />

      {/* ══ SECTION 2: Market Intelligence ══════════════════════════ */}
      <View style={[s.sectionDivider, { backgroundColor: colors.border }]} />
      <PremiumGate
        feature={t.subMarketIntelligence}
        description={t.marketIntelligenceDesc}
      >
        <View style={s.sectionHeader}>
          <View style={[s.sectionIconWrap, { backgroundColor: '#4A9EFF18' }]}>
            <Feather name="globe" size={15} color="#4A9EFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>{t.subMarketIntelligence}</Text>
            <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>{t.liveRatesPortfolioSignals}</Text>
          </View>
          <LiveDot />
        </View>

        {/* Market Summary Cards — 3-up row */}
        <View style={s.marketRow}>
          <View style={[s.mktCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.mktLabel, { color: colors.mutedForeground }]}>USD/EGP</Text>
            <Text style={[s.mktPrice, { color: colors.text }]}>
              {prices?.usdToEgp ? prices.usdToEgp.toFixed(2) : '—'}
            </Text>
            <View style={[s.mktBadge, { backgroundColor: '#4A9EFF18' }]}>
              <Text style={[s.mktBadgeTxt, { color: '#4A9EFF' }]}>{t.liveLabel}</Text>
            </View>
          </View>

          <View style={[s.mktCard, { backgroundColor: colors.card, borderColor: colors.primary + '30' }]}>
            <Text style={[s.mktLabel, { color: colors.mutedForeground }]}>{t.gold21KPerGram}</Text>
            <Text style={[s.mktPrice, { color: colors.primary }]}>
              {prices ? Math.round(goldPricePerGram(prices, '21k')).toLocaleString('en-EG') : '—'}
            </Text>
            {prices?.goldChangePercent !== undefined && (
              <View style={[s.mktBadge, { backgroundColor: (prices.goldChangePercent >= 0 ? colors.green : colors.red) + '18' }]}>
                <Text style={[s.mktBadgeTxt, { color: prices.goldChangePercent >= 0 ? colors.green : colors.red }]}>
                  {prices.goldChangePercent >= 0 ? '+' : ''}{prices.goldChangePercent.toFixed(2)}%
                </Text>
              </View>
            )}
          </View>

          <View style={[s.mktCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.mktLabel, { color: colors.mutedForeground }]}>{t.silverPerGram}</Text>
            <Text style={[s.mktPrice, { color: colors.silverColor }]}>
              {prices ? Math.round(silverPricePerGram(prices)).toLocaleString('en-EG') : '—'}
            </Text>
            {prices?.silverChangePercent !== undefined && (
              <View style={[s.mktBadge, { backgroundColor: (prices.silverChangePercent >= 0 ? colors.green : colors.red) + '18' }]}>
                <Text style={[s.mktBadgeTxt, { color: prices.silverChangePercent >= 0 ? colors.green : colors.red }]}>
                  {prices.silverChangePercent >= 0 ? '+' : ''}{prices.silverChangePercent.toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Gold karat strip */}
        {prices && (
          <View style={[s.karatStrip, { backgroundColor: colors.card, borderColor: colors.primary + '25' }]}>
            <Text style={[s.karatStripLabel, { color: colors.mutedForeground }]}>{t.goldPricesEGP}</Text>
            <View style={s.karatRow}>
              {(['24k', '22k', '21k', '18k'] as const).map(k => (
                <View key={k} style={s.karatCol}>
                  <Text style={[s.karatVal, { color: colors.primary }]}>
                    {Math.round(goldPricePerGram(prices, k)).toLocaleString('en-EG')}
                  </Text>
                  <Text style={[s.karatKey, { color: colors.mutedForeground }]}>{k.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Personalized signals */}
        {marketInsights.length > 0 && (
          <View style={s.section}>
            <SLabel icon="cpu" title={t.personalizedInsightsTitle} sub={t.basedOnPortfolio} />
            <View style={s.insightsList}>
              {marketInsights.map((ins, i) => (
                <InsightCard key={i} icon={ins.icon} color={ins.color} text={ins.text} />
              ))}
            </View>
            <Text style={[s.disclaimer, { color: colors.mutedForeground }]}>
              {t.insightsDisclaimer}
            </Text>
          </View>
        )}
      </PremiumGate>

      {/* ══ SECTION 3: Portfolio Analytics ═══════════════════════════ */}
      <View style={[s.sectionDivider, { backgroundColor: colors.border }]} />
      <PremiumGate
        feature={t.subPortfolioAnalytics}
        description={t.portfolioAnalyticsDesc}
      >
        <View style={s.sectionHeader}>
          <View style={[s.sectionIconWrap, { backgroundColor: colors.primary + '18' }]}>
            <Feather name="bar-chart-2" size={15} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>{t.subPortfolioAnalytics}</Text>
            <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>{t.performanceHealthAllocation}</Text>
          </View>
        </View>

        {!hasHoldings ? (
          <EmptyState />
        ) : (
          <>
            {/* ── Health hero ──────────────────────────────────────────── */}
            <View style={[s.healthHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.heroSectionLabel, { color: colors.mutedForeground }]}>{t.portfolioHealthLabel}</Text>
              <View style={s.healthArcWrap}>
                <HealthArc score={health.score} size={168} />
              </View>
              <View style={s.scoreBarsWrap}>
                <ScoreBar label={t.diversificationLabel} score={health.div} max={30} color={colors.primary} icon="layers" />
                <ScoreBar label={t.balanceLabel} score={health.conc} max={25} color="#4A9EFF" icon="sliders" />
                <ScoreBar label={t.inflationHedgeLabel} score={health.hedge} max={25} color="#F59E0B" icon="shield" />
                <ScoreBar label={t.realAssetsLabel} score={health.real} max={20} color="#A47FCA" icon={{ lib: 'mci', name: 'home-city' }} />
              </View>
              <Text style={[s.disclaimer, { color: colors.mutedForeground }]}>
                {t.informationalDisclaimer}
              </Text>
            </View>

            {/* ── Performance chart ────────────────────────────────────── */}
            <View style={s.chartSection}>
              <SLabel icon="activity" title={t.performanceLabel} sub={`${sm.gain >= 0 ? '+' : ''}${sm.gainPct.toFixed(2)}% all-time`} />
              <View
                onLayout={(e: LayoutChangeEvent) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0) setChartWidth(w);
                }}
                style={s.chartArea}
              >
                <PerfChart
                  period={period}
                  width={chartWidth}
                  height={110}
                  snapshots={snapshots}
                  todayValues={todaySamples}
                  allTimeValues={[sm.totalCost, sm.totalValue]}
                />
              </View>
              <View style={s.periodRow}>
                {PERIODS.map(p => {
                  const active = p === period;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => { impact(); setPeriod(p); }}
                      style={[s.periodPill, {
                        backgroundColor: active ? colors.primary : colors.muted,
                      }]}
                    >
                      <Text style={[s.periodTxt, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                        {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[s.chartNote, { color: colors.mutedForeground }]}>
                {t.simulatedTrendNote}
              </Text>
              {sm.totalCost > 0 && (
                <View style={s.inflationRow}>
                  <Feather
                    name={sm.gainPct >= 25 ? 'check-circle' : 'alert-circle'}
                    size={11}
                    color={sm.gainPct >= 25 ? colors.green : '#F59E0B'}
                  />
                  <Text style={[s.inflationNote, { color: colors.mutedForeground }]}>
                    {sm.gainPct >= 25
                      ? t.egpInflationBeating((sm.gainPct - 25).toFixed(1))
                      : t.egpInflationLagging(`${sm.gainPct >= 0 ? '+' : ''}${sm.gainPct.toFixed(1)}%`)}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Allocation bars ──────────────────────────────────────── */}
            {sm.totalValue > 0 && (
              <View style={s.section}>
                <SLabel icon="pie-chart" title={t.assetAllocationLabel} sub={`${allocSegs.filter(seg => seg.value > 0).length} ${t.classesCount}`} />
                <AllocationBar segments={allocSegs} />
              </View>
            )}

            {/* ── Performers ───────────────────────────────────────────── */}
            {performers.length > 0 && (
              <View style={s.section}>
                <SLabel icon="award" title={t.performersLabel} sub={`${performers.length} ${t.investmentPlural}`} />
                <View style={s.performersList}>
                  {performers.slice(0, 5).map((p, i) => (
                    <PodiumRow
                      key={p.h.id}
                      rank={i + 1}
                      label={p.label}
                      gainPct={p.gainPct}
                      value={p.v}
                      isFirst={i === 0}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* ── Smart insights ───────────────────────────────────────── */}
            <View style={s.section}>
              <SLabel icon="zap" title={t.smartInsightsLabel} sub={`${insights.length} ${t.observationsLabel}`} />
              <View style={s.insightsList}>
                {insights.map((ins, i) => (
                  <InsightCard key={i} icon={ins.icon} color={ins.color} text={ins.text} />
                ))}
              </View>
              <Text style={[s.disclaimer, { color: colors.mutedForeground }]}>
                {t.insightsDisclaimer}
              </Text>
            </View>

            {/* ── Gold spotlight ───────────────────────────────────────── */}
            {sm.goldV > 0 && (
              <View style={s.section}>
                <SLabel icon={{ lib: 'mci', name: 'gold' }} title={t.goldBreakdownLabel} />
                <MetalSpotlight
                  title={t.goldHoldingsTitle}
                  grams={sm.totalGoldGrams}
                  value={sm.goldV}
                  avgBuy={sm.goldAvgBuy}
                  gainPct={sm.goldGainPct}
                  livePrice={liveGoldG}
                  tintColor={colors.primary}
                />
              </View>
            )}

            {/* ── Silver spotlight ─────────────────────────────────────── */}
            {sm.silverV > 0 && (
              <View style={s.section}>
                <SLabel icon={{ lib: 'mci', name: 'gold' }} title={t.silverBreakdownLabel} />
                <MetalSpotlight
                  title={t.silverHoldingsTitle}
                  grams={sm.totalSilverGrams}
                  value={sm.silverV}
                  avgBuy={sm.silverAvgBuy}
                  gainPct={sm.silverGainPct}
                  livePrice={liveSilverG}
                  tintColor={colors.silverColor}
                />
              </View>
            )}
          </>
        )}
      </PremiumGate>
    </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 28 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.5, marginBottom: 4 },
  pageTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },

  // Health hero (centrepiece)
  healthHero: {
    borderRadius: 28, borderWidth: 1,
    paddingHorizontal: 22, paddingTop: 20, paddingBottom: 20,
    alignItems: 'center', gap: 20,
  },
  heroSectionLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2, alignSelf: 'flex-start' },
  healthArcWrap: { alignItems: 'center' },
  scoreBarsWrap: { alignSelf: 'stretch', gap: 12 },
  disclaimer: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 16, textAlign: 'center' },

  // Chart section (no card border — lives directly in scroll)
  chartSection: { gap: 14 },
  chartHeader: {},
  chartArea: { marginHorizontal: -20, paddingHorizontal: 20 },
  periodRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  periodPill: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 5 },
  periodTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  chartNote: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  inflationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  inflationNote: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16, flexShrink: 1 },

  // Generic section
  section: { gap: 14 },
  performersList: { gap: 4 },
  insightsList: { gap: 10 },

  // Section dividers (between Portfolio / Market / Tools)
  sectionDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: -20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  sectionSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },

  // Market Intelligence cards
  marketRow: { flexDirection: 'row', gap: 10 },
  mktCard: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, gap: 6, alignItems: 'center' },
  mktLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', letterSpacing: 0.3, textAlign: 'center' },
  mktPrice: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, textAlign: 'center' },
  mktBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  mktBadgeTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },

  // Karat strip
  karatStrip: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  karatStripLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  karatRow: { flexDirection: 'row', justifyContent: 'space-between' },
  karatCol: { alignItems: 'center', gap: 3 },
  karatVal: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  karatKey: { fontSize: 10, fontFamily: 'Inter_500Medium' },

  // Financial Tools header (distinct from live sections)
  toolsHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  toolsAccentBar: { width: 4, height: 46, borderRadius: 2 },
  toolsTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  toolsSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  toolsBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  toolsBadgeTxt: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },

  // Planning tool cards (ToolCard-matched style)
  planningScroll:         { marginHorizontal: -20 },
  planningScrollContent:  { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  planningToolCard: {
    width: 110,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 8,
  },
  planningToolAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  planningToolIcon:   { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planningToolLabel:  { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  planningToolSub:    { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
