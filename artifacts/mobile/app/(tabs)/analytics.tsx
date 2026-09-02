import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
  Animated, LayoutChangeEvent, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { forwardChevron, forwardArrow } from '@/utils/rtl';
import { pctDelta, todayContributionFromStamp } from '@/utils/pctDelta';
import { tradingDayStart, touchedToday, cairoWeekStart } from '@/utils/cairoDate';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs, LinearGradient, Stop, Path,
} from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useHoldings } from '@/context/HoldingsContext';
import { useCash } from '@/context/CashContext';
import { computeCashTotalEGP, computeTotalLoanBalanceEGP } from '@/utils/cash';
import { BanknoteIcon } from '@/components/BanknoteIcon';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { pricesAreFresh } from '@/utils/pricesCache';
import { getRECurrentValue } from '@/utils/rePrice';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { useGlobalStocks } from '@/hooks/useGlobalStocks';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { useInflationRate } from '@/hooks/useInflationRate';
import { usePortfolioBenchmark } from '@/hooks/usePortfolioBenchmark';
import { usePortfolioTargets, AllocationClass } from '@/hooks/usePortfolioTargets';
import { useServerIntraday } from '@/hooks/useServerIntraday';
import { Holding, MarketPrices } from '@/types';
import { FinancialTools } from '@/components/FinancialTools';
import { PremiumGate } from '@/components/PremiumGate';
import { BetaChip } from '@/components/BetaChip';
import { PerfChart } from '@/components/PerfChart';
import { getHistoryCoverage, isPeriodAvailable, periodLimitedByHistory } from '@/utils/chartUtils';
import { useAppSettings } from '@/context/AppSettingsContext';
import { AllocationBar, AllocationSegment } from '@/components/AllocationBar';
import { WeeklyRecapCard } from '@/components/WeeklyRecapCard';
import { useSoldHoldings } from '@/hooks/useSoldHoldings';
import { useDailyChanges } from '@/hooks/useDailyChanges';
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
// Monthly/quarterly-payout certificates pay interest out to a linked account
// each period rather than compounding it back into the certificate — its
// value stays flat at principal until maturity. Only at-maturity products
// accrue. Matches components/HoldingCard.tsx, the canonical per-holding
// display — this used to accrue unconditionally, overstating totals here.
function fixedIncomeAccruedValue(h: Extract<Holding, { type: 'fixed_income' }>, asOf: Date = new Date()): number {
  if (h.paymentFrequency !== 'at_maturity') return h.principal;
  const purchase = new Date(h.purchaseDate);
  const maturity = new Date(h.maturityDate);
  const daysTotal = Math.max(1, (maturity.getTime() - purchase.getTime()) / 86400000);
  const daysElapsed = Math.max(0, Math.min(daysTotal, (asOf.getTime() - purchase.getTime()) / 86400000));
  return h.principal * (1 + (h.annualRate / 100) * (daysElapsed / 365));
}

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
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) {
    // 999,999 rounds to 1000.00 at this precision, which would misleadingly
    // print as "1000.00K" — promote to the M tier instead.
    if (Math.abs(Number((n / 1_000).toFixed(2))) >= 1000) return `${(n / 1_000_000).toFixed(2)}M`;
    return `${(n / 1_000).toFixed(2)}K`;
  }
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

// ─── Drift row (Rebalancing card) ──────────────────────────────────────────────

function DriftRow({ label, icon, color, currentPct, targetPct }: {
  label: string; icon: React.ReactNode; color: string; currentPct: number; targetPct: number;
}) {
  const colors = useColors();
  const t = useT();
  const drift = currentPct - targetPct;
  const isOff = Math.abs(drift) >= 10;
  const badgeColor = isOff ? colors.red : colors.green;
  return (
    <View style={dr.row}>
      <View style={[dr.iconBox, { backgroundColor: color + '1A' }]}>{icon}</View>
      <View style={dr.body}>
        <Text style={[dr.label, { color: colors.text }]}>{label}</Text>
        <Text style={[dr.sub, { color: colors.mutedForeground }]}>
          {currentPct.toFixed(0)}% · target {targetPct.toFixed(0)}%
        </Text>
      </View>
      <View style={[dr.badge, { backgroundColor: badgeColor + '18' }]}>
        <Text style={[dr.badgeTxt, { color: badgeColor }]}>
          {isOff ? t.rebalancingDrifted(Math.abs(drift).toFixed(0)) : t.rebalancingOnTrack}
        </Text>
      </View>
    </View>
  );
}
const dr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 1 },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  editRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth,
  },
  editTxt: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
});

// ─── Fix My Portfolio card ───────────────────────────────────────────────────
const fp = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  diagnosis: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  move: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', lineHeight: 19, marginTop: 2 },
  detail: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  disclaimer: { fontSize: 10.5, fontFamily: 'Inter_400Regular', marginTop: 4, opacity: 0.75 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ctaTxt: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
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
// Same visual language as MetalSpotlight (shares its `ms` styles below) but
// generalized for the 4 non-metal types (stock/real_estate/personal_asset/
// fixed_income), which don't have a meaningful "grams"/"price-per-gram" —
// count and cost basis are the universal 3rd/1st stats instead. Previously
// only gold and silver got a dedicated breakdown card at all; any user
// holding stocks, real estate, personal assets, or fixed income saw nothing
// equivalent for what they actually held.
function ClassSpotlight({ title, countLabel, value, cost, gainPct, tintColor, footerText }: {
  title: string; countLabel: string; value: number; cost: number;
  gainPct: number; tintColor: string; footerText?: string;
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
          <Text style={[ms.statVal, { color: colors.text }]}>{countLabel}</Text>
          <Text style={[ms.statLabel, { color: colors.mutedForeground }]}>{t.holdingsCountLabel}</Text>
        </View>
        <View style={[ms.divider, { backgroundColor: colors.border }]} />
        <View style={ms.statCol}>
          <Text style={[ms.statVal, { color: tintColor }]}>{fmtK(value)}<Text style={[ms.statUnit, { color: colors.mutedForeground }]}> EGP</Text></Text>
          <Text style={[ms.statLabel, { color: colors.mutedForeground }]}>{t.marketValue}</Text>
        </View>
        <View style={[ms.divider, { backgroundColor: colors.border }]} />
        <View style={ms.statCol}>
          <Text style={[ms.statVal, { color: colors.text }]}>{fmtK(cost)}<Text style={[ms.statUnit, { color: colors.mutedForeground }]}> EGP</Text></Text>
          <Text style={[ms.statLabel, { color: colors.mutedForeground }]}>{t.costBasisLabel}</Text>
        </View>
      </View>
      {footerText && (
        <View style={[ms.footer, { borderTopColor: tintColor + '20' }]}>
          <Feather name="award" size={10} color={tintColor} />
          <Text style={[ms.footerTxt, { color: colors.mutedForeground }]}>{footerText}</Text>
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

// ─── Realized gains card ───────────────────────────────────────────────────────
const rg = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 18,
  },
  left: { flex: 1, gap: 6 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4, textTransform: 'uppercase' },
  value: { fontSize: 22, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.4 },
  currency: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});

const dh = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 18,
  },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});

const hs = StyleSheet.create({
  strip: { gap: 12, paddingRight: 4 },
  card: {},
});

const ts = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 11, borderWidth: 1,
  },
  tabTxt: { fontSize: 12.5, fontFamily: 'Inter_700Bold' },
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

function EmptyState({ icon = 'bar-chart-2', title, hint }: {
  icon?: keyof typeof Feather.glyphMap; title?: string; hint?: string;
} = {}) {
  const colors = useColors();
  const t = useT();
  return (
    <View style={[em.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[em.icon, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={28} color={colors.mutedForeground} />
      </View>
      <Text style={[em.title, { color: colors.text }]}>{title ?? t.noAnalyticsYetTitle}</Text>
      <Text style={[em.sub, { color: colors.mutedForeground }]}>
        {hint ?? t.noAnalyticsYetHint}
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
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
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
        <Text style={[s.planningToolLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[s.planningToolSub, { color: colors.mutedForeground }]}>{sub}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const t = useT();
  // Only for date locale on the tracking-since line below — useT resolves
  // the strings but doesn't expose which language produced them.
  const { language } = useAppSettings();
  const colors = useColors();
  const router = useRouter();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  // Asset breakdown strip's card width — a fixed 260px looked arbitrary and
  // gave no "peek" of the next card on wider phones (nothing hinting the
  // strip scrolls), and could crowd out the peek on narrow ones. Sized off
  // the real screen width instead, minus the 20px screen padding each side
  // and a deliberate ~14% sliver of the next card showing at the edge.
  const { width: screenWidth } = useWindowDimensions();
  const spotlightCardWidth = screenWidth - 40 - 36;
  const scrollRef = useRef<ScrollView>(null);
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { cashAccounts } = useCash();
  const { data: rawPrices, isLoading: pricesLoading, refetch } = useMarketPrices();
  const { data: egxStocks } = useEGXMarket();
  const { data: globalStocks } = useGlobalStocks();
  const prices = useMemo(() => {
    if (!rawPrices) return rawPrices;
    const egxPrices: Record<string, number> = {};
    egxStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
    globalStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
    return { ...rawPrices, egxPrices };
  }, [rawPrices, egxStocks, globalStocks]);
  const isLoading = pricesLoading || holdingsLoading;

  const [period, setPeriod] = useState<Period>('ALL');
  // Top-level Analytics grouping — was 15 sections stacked in one endless
  // scroll (health/chart/allocation/insights alongside rebalancing/
  // performers/breakdown alongside history), which read as crowded and
  // unorganized rather than as three actually-related groups. Splitting by
  // what each group answers: "how am I doing overall," "what exactly do I
  // hold," "what happened over time" — not by arbitrary card order.
  const [activeSection, setActiveSection] = useState<'overview' | 'breakdown' | 'history'>('overview');
  const [chartWidth, setChartWidth] = useState(0);

  // ── Maths ─────────────────────────────────────────────────────────────────────
  const egxChangeByTicker = useMemo(() => {
    const m: Record<string, number> = {};
    egxStocks?.forEach(s => { m[s.ticker] = s.changePercent; });
    globalStocks?.forEach(s => { m[s.ticker] = s.changePercent; });
    return m;
  }, [egxStocks, globalStocks]);

  const sm = useMemo(() => {
    let goldV = 0, silverV = 0, stockV = 0, reV = 0, paV = 0, fiV = 0, totalCost = 0;
    let goldCost = 0, silverCost = 0, stockCost = 0, reCost = 0, paCost = 0, fiCost = 0;
    let totalGoldGrams = 0, totalSilverGrams = 0;
    let stockCount = 0, reCount = 0, paCount = 0, fiCount = 0;
    let todayGold = 0, todaySilver = 0, todayStock = 0, todayFI = 0;
    for (const h of holdings) {
      const v = computeValue(h, prices);
      const c = computeCost(h, prices);
      totalCost += c;
      // Same reasoning as index.tsx's countsToday — a holding added/edited
      // today still counts at full value everywhere above. For gold/silver/
      // stock its contribution isn't just skipped though: the server's
      // priceAtCreationEgp/priceAtLastEditEgp stamp (never client-supplied)
      // gives a real, unfakeable baseline for "movement since this lot
      // existed," so that's used instead of the day's full %. Falls back to
      // 0 only when no stamp exists yet (older data).
      const countsToday = !touchedToday(h.updatedAt);
      if (h.type === 'gold') {
        goldV += v; goldCost += c; totalGoldGrams += h.grams;
        // goldChangePercent is the metal's raw USD move; goldChangePercentEgp
        // compounds it with today's FX move, which is what a holding valued
        // in EGP (`v`) actually needs — see markets.ts for why.
        if (countsToday) {
          todayGold += pctDelta(v, prices?.goldChangePercentEgp ?? 0);
        } else {
          const stampContribution = todayContributionFromStamp(h.priceAtLastEditEgp ?? h.priceAtCreationEgp, h.grams, v);
          if (stampContribution != null) todayGold += stampContribution;
        }
      } else if (h.type === 'silver') {
        silverV += v; silverCost += c; totalSilverGrams += h.grams;
        if (countsToday) {
          todaySilver += pctDelta(v, prices?.silverChangePercentEgp ?? 0);
        } else {
          const stampContribution = todayContributionFromStamp(h.priceAtLastEditEgp ?? h.priceAtCreationEgp, h.grams, v);
          if (stampContribution != null) todaySilver += stampContribution;
        }
      }
      else if (h.type === 'stock') {
        stockV += v; stockCost += c; stockCount++;
        if (countsToday) {
          const changePercent = egxChangeByTicker[h.symbol] ?? 0;
          todayStock += pctDelta(v, changePercent);
        } else {
          const stampContribution = todayContributionFromStamp(h.priceAtLastEditEgp ?? h.priceAtCreationEgp, h.shares, v);
          if (stampContribution != null) todayStock += stampContribution;
        }
      }
      else if (h.type === 'personal_asset') { paV += v; paCost += c; paCount++; }
      else if (h.type === 'fixed_income') {
        fiV += v; fiCost += c; fiCount++;
        // Since the trading day began, matching index.tsx — see the comment
        // there for why a rolling 24h window was wrong.
        if (countsToday) todayFI += v - fixedIncomeAccruedValue(h, tradingDayStart());
      }
      else { reV += v; reCost += c; reCount++; }
    }
    // Same treatment as index.tsx's identical summary useMemo — see
    // computeTotalLoanBalanceEGP's comment for the double-counting bug this
    // fixes. Subtracting totalLoans from both totalValue and totalCost (not
    // just totalValue) keeps gain/gainPct honest: it cancels out of the
    // absolute gain entirely, and correctly turns gainPct into a return on
    // the user's own committed capital. fiV/fiCost themselves (used for
    // per-class gain% below, and for fiV's own today-delta math elsewhere)
    // stay untouched, matching the fixed_income holding's own card, which
    // also never nets its loan against its own displayed value or
    // performance — only the allocation bar's fixed-income slice (below)
    // is loan-adjusted, since that one specifically claims to show real net
    // composition, the same claim the headline total makes.
    const totalLoans = computeTotalLoanBalanceEGP(holdings);
    // Floored at 0 — total debt exceeding total assets/cost basis should
    // never render as a negative headline figure or cost basis.
    const totalValue = Math.max(0, goldV + silverV + stockV + reV + paV + fiV - totalLoans);
    totalCost = Math.max(0, totalCost - totalLoans);
    const gain = totalValue - totalCost;
    const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    const fiVNetOfLoans = Math.max(0, fiV - totalLoans);
    const goldGainPct = goldCost > 0 ? ((goldV - goldCost) / goldCost) * 100 : 0;
    const silverGainPct = silverCost > 0 ? ((silverV - silverCost) / silverCost) * 100 : 0;
    const stockGainPct = stockCost > 0 ? ((stockV - stockCost) / stockCost) * 100 : 0;
    const reGainPct = reCost > 0 ? ((reV - reCost) / reCost) * 100 : 0;
    const paGainPct = paCost > 0 ? ((paV - paCost) / paCost) * 100 : 0;
    const fiGainPct = fiCost > 0 ? ((fiV - fiCost) / fiCost) * 100 : 0;
    const goldAvgBuy = totalGoldGrams > 0 ? goldCost / totalGoldGrams : 0;
    const silverAvgBuy = totalSilverGrams > 0 ? silverCost / totalSilverGrams : 0;
    const metalPct = totalValue > 0 ? (goldV + silverV) / totalValue : 0;
    const todayGain = todayGold + todaySilver + todayStock + todayFI;
    return {
      totalValue, totalCost, gain, gainPct, todayGain, totalLoans,
      goldV, silverV, stockV, reV, paV, fiV, fiVNetOfLoans,
      goldCost, silverCost, stockCost, reCost, paCost, fiCost,
      goldGainPct, silverGainPct, stockGainPct, reGainPct, paGainPct, fiGainPct,
      totalGoldGrams, totalSilverGrams, goldAvgBuy, silverAvgBuy,
      metalPct, stockCount, reCount, paCount, fiCount,
    };
  }, [holdings, prices, egxChangeByTicker]);

  const { snapshots } = usePortfolioSnapshots();
  // Same availability rule as Home: only offer a period once real recorded
  // history reaches back that far, so a selectable period is never just a
  // shorter period's data redrawn under a longer label.
  const coverage = useMemo(() => getHistoryCoverage(snapshots), [snapshots]);
  useEffect(() => {
    if (!isPeriodAvailable(period, coverage)) setPeriod('1D');
  }, [coverage, period]);

  // Weekly Recap — most recent snapshot strictly before THIS calendar
  // week's start (cairoWeekStart, the same Sunday boundary the leaderboard
  // resets on), not a rolling "7 days ago" window. A rolling window never
  // actually resets on Sunday — the day the week visibly starts over, it
  // was still spanning most of last week too, showing "this week" numbers
  // that were really "the last 7 days" and staying wrong until day 7.
  // Tolerant of gaps (same "closest prior value" approach
  // dailySummaryCron.ts's weekly push uses server-side). null when there
  // isn't one yet (account under a week old, or genuinely no history
  // before this week began) — the recap card shows an honest "still
  // gathering" state rather than a fabricated 0.0%.
  const [recapVisible, setRecapVisible] = useState(false);
  const weeklyBaseline = useMemo(() => {
    if (snapshots.length === 0) return null;
    const weekStart = cairoWeekStart();
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    let candidate: number | null = null;
    for (const snap of sorted) {
      if (snap.date < weekStart) candidate = snap.value;
      else break;
    }
    return candidate;
  }, [snapshots]);
  const weeklyPctChange = weeklyBaseline && weeklyBaseline > 0
    ? ((sm.totalValue - weeklyBaseline) / weeklyBaseline) * 100
    : null;
  const weeklyEgpChange = weeklyBaseline != null ? sm.totalValue - weeklyBaseline : 0;
  const { data: inflation } = useInflationRate();
  const { data: benchmark } = usePortfolioBenchmark();
  const { configured: targetsConfigured, targets } = usePortfolioTargets();
  // Only for the rebalancing/drift comparison below — sm.totalValue stays
  // investment-only everywhere else (gain %, health score, benchmark), same
  // as the server's computeUserPortfolioValue. Target allocation is about
  // the whole net-worth mix including cash, so its own denominator needs to
  // be the two combined.
  const cashTotalEGP = useMemo(() => computeCashTotalEGP(cashAccounts, prices), [cashAccounts, prices]);
  const startOfDayValue = sm.totalValue - sm.todayGain;
  const { data: serverIntraday, isLoading: serverIntradayLoading } = useServerIntraday();
  // Server-only, same as index.tsx's Home chart — no on-device sample
  // blending, so the two screens can never show a different-shaped 1D
  // curve for the same day. Keep the chart's start/end always freshly
  // consistent with the "Today" badge (which always recomputes live); only
  // the server's middle points (real texture) are used.
  const todaySamples = useMemo(() => {
    // Never draw the flat 2-point start/end line while the server's real
    // intraday texture is still loading — that's a real, visible chart
    // shape that would just get replaced a moment later once it lands,
    // which reads as "the chart changed." An empty array here makes
    // PerfChart show its "building" placeholder instead, so 1D only ever
    // paints once, already textured.
    if (serverIntradayLoading) return [];
    const middle = serverIntraday && serverIntraday.length > 0 ? serverIntraday.map(p => p.v) : [];
    return [startOfDayValue, ...middle, sm.totalValue];
  }, [serverIntradayLoading, serverIntraday, startOfDayValue, sm.totalValue]);

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

  // ── Realized gains (sold/redeemed holdings) ─────────────────────────────────
  const { soldHoldings } = useSoldHoldings();
  const totalRealized = useMemo(
    () => soldHoldings.reduce((sum, s) => sum + s.realizedGainLoss, 0),
    [soldHoldings],
  );

  // ── Daily change history — the server's closed "Today's Change %" per
  // trading day (see useDailyChanges); the card here is just an entry
  // point, the full list lives on its own screen (app/daily-history.tsx).
  const { dailyChanges } = useDailyChanges();

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
      icon: 'bar-chart-2', quantity: sm.stockCount > 0 ? `${sm.stockCount} stock${sm.stockCount !== 1 ? 's' : ''}` : undefined,
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
      // Net of any linked-loan balance — matches the headline Total
      // Portfolio Value's own net-of-loan treatment (Home screen).
      label: t.fixedIncome, value: sm.fiVNetOfLoans, color: '#22C55E',
      icon: { lib: 'mci' as const, name: 'bank-transfer' },
    },
  ], [sm, colors, t]);

  // ── Rebalancing / drift ──────────────────────────────────────────────────────
  // Net worth (investments + cash) — used as driftRows' denominator only when
  // the user has actually set a cash target (see driftDenominator below); every
  // other use of sm.totalValue on this screen (gain %, health score, benchmark)
  // stays investment-only on purpose regardless.
  const netWorthForDrift = sm.totalValue + cashTotalEGP;
  // Shared by driftRows (needs a target to compare against) and
  // concentrationRisk below (doesn't — it only looks at what you actually
  // hold), so both read the same label/color/icon per class.
  const classValue = useMemo((): Record<AllocationClass, number> => ({
    gold: sm.goldV, silver: sm.silverV, stock: sm.stockV,
    realEstate: sm.reV, personalAsset: sm.paV, fixedIncome: sm.fiV, cash: cashTotalEGP,
  }), [sm, cashTotalEGP]);
  // Loan-adjusted variant, for driftRows only — target-allocation drift is
  // a real-position question ("is my actual mix off from my target mix"),
  // so it should use net fixed-income, same as the allocation bar. Kept
  // separate from classValue rather than adjusting it in place: concentration
  // risk below deliberately still reads gross — that card is about the
  // certificate's own concentration/performance, not net worth composition,
  // same restraint the certificate's own card uses.
  const classValueNetOfLoans = useMemo((): Record<AllocationClass, number> => ({
    ...classValue, fixedIncome: sm.fiVNetOfLoans,
  }), [classValue, sm.fiVNetOfLoans]);
  const classMeta = useMemo((): Record<AllocationClass, { label: string; color: string; icon: React.ReactNode }> => ({
    gold: { label: t.gold, color: colors.primary, icon: <MaterialCommunityIcons name="gold" size={16} color={colors.primary} /> },
    silver: { label: t.silver, color: colors.silverColor, icon: <MaterialCommunityIcons name="gold" size={16} color={colors.silverColor} /> },
    stock: { label: t.egxStocksAllocLabel, color: '#4A9EFF', icon: <Feather name="bar-chart-2" size={16} color="#4A9EFF" /> },
    realEstate: { label: t.realEstate, color: '#A47FCA', icon: <MaterialCommunityIcons name="home-city" size={16} color="#A47FCA" /> },
    personalAsset: { label: t.personalAssetsAllocLabel, color: '#E08E45', icon: <MaterialCommunityIcons name="tag-multiple" size={16} color="#E08E45" /> },
    fixedIncome: { label: t.fixedIncome, color: '#22C55E', icon: <MaterialCommunityIcons name="bank-transfer" size={16} color="#22C55E" /> },
    cash: { label: t.cash, color: colors.green, icon: <BanknoteIcon size={16} color={colors.green} /> },
  }), [colors, t]);
  // Only fold cash into the denominator when the user actually set a cash
  // target — reported directly: gold targeted at 100% with no cash target
  // showed as "76% · target 100%" forever, because untargeted cash sitting
  // in Cash Accounts was silently diluting gold's share of net worth even
  // though the user never asked the app to weigh cash against it. Without
  // a cash target, drift should only be measured across what was actually
  // targeted, same reasoning as concentrationRisk's investments-only fix.
  // Shared with fixPlan below so its EGP math is computed against the exact
  // same base as the percentages driftRows shows — using a different one
  // there would make the two disagree with each other.
  const driftDenominator = targets.cash !== undefined ? netWorthForDrift : sm.totalValue;
  const driftRows = useMemo(() => {
    if (!targetsConfigured || driftDenominator <= 0) return [];
    return (Object.keys(targets) as AllocationClass[])
      .filter(k => targets[k] !== undefined)
      .map(k => ({
        key: k,
        ...classMeta[k],
        currentPct: (classValueNetOfLoans[k] / driftDenominator) * 100,
        targetPct: targets[k] as number,
      }))
      .sort((a, b) => Math.abs(b.currentPct - b.targetPct) - Math.abs(a.currentPct - a.targetPct));
  }, [targetsConfigured, targets, classValueNetOfLoans, driftDenominator, classMeta]);

  // ── Concentration risk (no target needed) ───────────────────────────────────
  // driftRows/fixPlan both require a saved target to compare against — a user
  // who's never configured one (e.g. 100% in a single asset class) would only
  // ever see the plain "No targets set" prompt. This catches that case with an
  // objective fact that needs no target at all: one class carrying most of the
  // portfolio is a concentration risk on its own. Still premium-gated, and it
  // still ends in the same "set a real target" CTA — this can only flag the
  // risk, not prescribe a specific fix, since there's no stated goal yet.
  //
  // Denominator is sm.totalValue (investments only), NOT netWorthForDrift —
  // unlike driftRows, which deliberately includes cash because a user sets a
  // real cash *target* alongside their other targets there. This card's own
  // copy says "of your portfolio," which reads as investments, and idle cash
  // diluting a 100%-in-one-thing holding down to some lower number isn't a
  // "risk" being under-flagged, it's the card describing something that
  // isn't a risk (cash) as if it were part of the concentration. Reported
  // directly: a single 100%-gold holding was showing as 76% because cash
  // accounts pulled the old denominator up.
  const CONCENTRATION_THRESHOLD_PCT = 60;
  const concentrationRisk = useMemo(() => {
    if (targetsConfigured || sm.totalValue <= 0) return null;
    const INVESTMENT_CLASSES: AllocationClass[] = ['gold', 'silver', 'stock', 'realEstate', 'personalAsset', 'fixedIncome'];
    const top = INVESTMENT_CLASSES
      .map(k => ({ key: k, value: classValue[k], pct: (classValue[k] / sm.totalValue) * 100 }))
      .filter(e => e.value > 0)
      .sort((a, b) => b.pct - a.pct)[0];
    if (!top || top.pct < CONCENTRATION_THRESHOLD_PCT) return null;
    return { ...top, ...classMeta[top.key] };
  }, [targetsConfigured, sm.totalValue, classValue, classMeta]);

  // ── Fix My Portfolio ─────────────────────────────────────────────────────────
  // driftRows only ever shows a diagnosis ("12pp off target") — this turns the
  // worst overweight/underweight pair into one concrete move: how much EGP to
  // shift, and — when the overweight side has real holdings to point at — which
  // specific position is the obvious one to trim first (its largest by value).
  // Premium-gated: this is the one card in the app that says what to *do*, not
  // just what the numbers are, so it's the natural upsell moment on this screen.
  const REBALANCE_TYPE: Partial<Record<AllocationClass, Holding['type']>> = {
    gold: 'gold', silver: 'silver', stock: 'stock',
    realEstate: 'real_estate', personalAsset: 'personal_asset', fixedIncome: 'fixed_income',
  };
  const fixPlan = useMemo(() => {
    const DRIFT_THRESHOLD_PP = 5; // below this, "fixing" it isn't worth suggesting
    const overweight = driftRows
      .filter(r => r.currentPct - r.targetPct >= DRIFT_THRESHOLD_PP)
      .sort((a, b) => (b.currentPct - b.targetPct) - (a.currentPct - a.targetPct))[0];
    const underweight = driftRows
      .filter(r => r.targetPct - r.currentPct >= DRIFT_THRESHOLD_PP)
      .sort((a, b) => (b.targetPct - b.currentPct) - (a.targetPct - a.currentPct))[0];
    if (!overweight || !underweight || driftDenominator <= 0) return null;

    const moveEGP = Math.min(
      ((overweight.currentPct - overweight.targetPct) / 100) * driftDenominator,
      ((underweight.targetPct - underweight.currentPct) / 100) * driftDenominator,
    );
    if (moveEGP < 500) return null; // too small an amount to bother suggesting

    const overweightType = REBALANCE_TYPE[overweight.key];
    const topHolding = overweightType
      ? holdings
          .filter(h => h.type === overweightType)
          .map(h => ({ h, v: computeValue(h, prices) }))
          .sort((a, b) => b.v - a.v)[0]
      : undefined;
    const trimLabel = topHolding ? holdingLabel(topHolding.h, { gold: t.gold, silver: t.silver, realEstate: t.realEstate }) : null;

    let addGramsNote: string | null = null;
    if (prices) {
      if (underweight.key === 'gold') addGramsNote = t.fixPlanAddGrams((moveEGP / goldPricePerGram(prices, '21k')).toFixed(1), t.gold);
      else if (underweight.key === 'silver') addGramsNote = t.fixPlanAddGrams((moveEGP / silverPricePerGram(prices)).toFixed(1), t.silver);
    }

    return { overweight, underweight, moveEGP, trimLabel, trimValue: topHolding?.v, addGramsNote };
  }, [driftRows, driftDenominator, holdings, prices, t]);

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
    if ((prices?.goldChangePercentEgp ?? 0) > 1) {
      items.push({ icon: 'trending-up', color: colors.primary, text: t.insightGoldUp((prices?.goldChangePercentEgp ?? 0).toFixed(2)) });
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
    if (prices?.goldChangePercentEgp && Math.abs(prices.goldChangePercentEgp) > 0.5) {
      items.push({ icon: 'zap', color: '#F59E0B', text: prices.goldChangePercentEgp > 0
        ? t.insightGoldMovedUp(Math.abs(prices.goldChangePercentEgp).toFixed(2))
        : t.insightGoldMovedDown(Math.abs(prices.goldChangePercentEgp).toFixed(2)) });
    }
    return items.slice(0, 4);
  }, [holdings, sm, prices, colors]);

  const hasHoldings = holdings.length > 0;
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  const healthColor = health.score >= 75 ? colors.green : health.score >= 50 ? '#F59E0B' : colors.red;

  // Matches Markets exactly: contentInset (not contentOffset) plus an
  // imperative scrollTo, since contentOffset alone raced against this
  // screen's heavier initial layout. Also — the previous version applied
  // backgroundColor directly on the ScrollView's own style; Markets applies
  // it to an outer wrapping View instead, which this now matches too.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: -topPad, animated: false });
  }, [topPad]);

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
    <Stack.Screen options={{ headerShown: false }} />
    <ScrollView
      ref={scrollRef}
      style={s.container}
      contentContainerStyle={[s.content, { paddingTop: 16, paddingBottom: botPad + 100 }]}
      contentInset={{ top: topPad }}
      onLayout={() => scrollRef.current?.scrollTo({ y: -topPad, animated: false })}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={[s.pageTitle, { color: colors.text }]}>{t.analytics}</Text>
      </View>

      {/* ══ SECTION 1: Planning ═══════════════════════════════════════ */}
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: '#22C55E18' }]}>
          <Feather name="compass" size={15} color="#22C55E" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>{t.planningGrowthTools}</Text>
          <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>{t.planningToolsSub}</Text>
        </View>
      </View>
      <View style={s.planningRow}>
        <PlanningToolCard
          icon="target" color={colors.primary}
          label={t.goals}
          sub={t.goalsToolSub}
          onPress={() => router.push('/goals' as any)}
        />
        <PlanningToolCard
          icon="percent" color="#4A9EFF"
          label={t.tbillsCalculator}
          sub={t.tbillsToolSub}
          onPress={() => router.push('/tbills-calculator' as any)}
        />
        <PlanningToolCard
          icon="check-circle" color={colors.green}
          label={t.shariahScreening}
          sub={t.shariahScreeningDesc}
          onPress={() => router.push('/sharia-screening' as any)}
        />
      </View>

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
          <Text style={[s.toolsBadgeTxt, { color: colors.primary }]}>{t.financialToolsCountBadge}</Text>
        </View>
      </View>
      <FinancialTools />

      {/* ══ SECTION: AI Financial Assistant ═══════════════════════════ */}
      <View style={[s.sectionDivider, { backgroundColor: colors.border }]} />
      <PremiumGate
        feature={t.aiAssistantTitle}
        description={t.aiAssistantDesc}
      >
        <Pressable onPress={() => router.push('/ai-assistant' as any)}>
          <ExpoLinearGradient
            colors={['#8B5CF61C', '#6366F110']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.aiAssistantCard, { borderColor: '#8B5CF63A' }]}
          >
            <View style={[s.aiAssistantIcon, { backgroundColor: '#8B5CF622' }]}>
              <Feather name="cpu" size={22} color="#8B5CF6" />
              <View style={[s.aiSparkle, { backgroundColor: colors.card }]}>
                <Feather name="zap" size={9} color="#8B5CF6" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.aiTitleRow}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>{t.aiAssistantTitle}</Text>
                <BetaChip label={t.aiAssistantBetaChip} />
              </View>
              <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>{t.aiAssistantDesc}</Text>
            </View>
            <Feather name={forwardChevron()} size={18} color={colors.mutedForeground} />
          </ExpoLinearGradient>
        </Pressable>
      </PremiumGate>

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
            {/* Same rule as Overview and Markets — don't badge cached prices
                as LIVE just because they're real. */}
            <View style={[s.mktBadge, { backgroundColor: (pricesAreFresh(prices?.lastUpdated) ? '#4A9EFF' : colors.mutedForeground) + '18' }]}>
              <Text style={[s.mktBadgeTxt, { color: pricesAreFresh(prices?.lastUpdated) ? '#4A9EFF' : colors.mutedForeground }]}>{t.liveLabel}</Text>
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
            {/* ── Top-level grouping (was one endless scroll) ──────────── */}
            <View style={[ts.row, { backgroundColor: colors.muted }]}>
              {([
                { key: 'overview' as const, icon: 'grid' as const, label: t.analyticsTabOverview },
                { key: 'breakdown' as const, icon: 'pie-chart' as const, label: t.analyticsTabBreakdown },
                { key: 'history' as const, icon: 'clock' as const, label: t.analyticsTabHistory },
              ]).map(({ key, icon, label }) => {
                const active = activeSection === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => { impact(); setActiveSection(key); }}
                    style={[ts.tab, { backgroundColor: active ? colors.card : 'transparent', borderColor: active ? colors.border : 'transparent' }]}
                  >
                    <Feather name={icon} size={13} color={active ? colors.text : colors.mutedForeground} />
                    <Text style={[ts.tabTxt, { color: active ? colors.text : colors.mutedForeground }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* History can be genuinely empty for a new account — no sales
                yet, no daily record yet — which would otherwise render as a
                blank area under the tab with no explanation. */}
            {activeSection === 'history' && soldHoldings.length === 0 && dailyChanges.length === 0 && (
              <EmptyState icon="clock" title={t.noHistoryYetTitle} hint={t.noHistoryYetHint} />
            )}

            {/* ── Health hero ──────────────────────────────────────────── */}
            {activeSection === 'overview' && (
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
            )}

            {/* ── Performance chart ────────────────────────────────────── */}
            {activeSection === 'overview' && (
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
                  liveValue={sm.totalValue}
                  allTimeValues={[sm.totalCost, sm.totalValue]}
                  loading={period === '1D' && serverIntradayLoading}
                />
              </View>
              <View style={s.periodRow}>
                {PERIODS.map(p => {
                  const active = p === period;
                  const available = isPeriodAvailable(p, coverage);
                  return (
                    <Pressable
                      key={p}
                      disabled={!available}
                      onPress={() => { impact(); setPeriod(p); }}
                      style={[s.periodPill, {
                        backgroundColor: active ? colors.primary : colors.muted,
                        opacity: available ? 1 : 0.35,
                      }]}
                    >
                      <Text style={[s.periodTxt, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                        {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {/* Replaces a "Simulated trend based on your portfolio's actual
                  return" note that outlived the thing it described. This chart
                  draws real snapshots, and where history is too short it falls
                  back to two real points (cost basis -> current value) — sparse,
                  but not invented. Calling that "simulated" told users their
                  own tracked data was fake. What's actually worth saying is how
                  far back the record goes, and only on periods that depth
                  actually constrains — see periodLimitedByHistory. */}
              {!!coverage.earliestDate && periodLimitedByHistory(period, coverage) && (
                <Text style={[s.chartNote, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {t.chartTrackingSince(
                    new Date(coverage.earliestDate).toLocaleDateString(
                      language === 'ar' ? 'ar-EG' : 'en-EG',
                      { day: 'numeric', month: 'short', year: 'numeric' },
                    ),
                  )}
                </Text>
              )}
              {sm.totalCost > 0 && inflation && (() => {
                const isBeating = sm.gainPct >= inflation.rate;
                const diff = Math.abs(sm.gainPct - inflation.rate);
                const tint = isBeating ? colors.green : '#F59E0B';
                return (
                  <View style={[s.inflationCard, { backgroundColor: tint + '0F', borderColor: tint + '2E' }]}>
                    <View style={s.inflationHeader}>
                      <View style={[s.inflationIconWrap, { backgroundColor: tint + '1F' }]}>
                        <Feather name={isBeating ? 'trending-up' : 'alert-circle'} size={13} color={tint} />
                      </View>
                      <Text style={[s.inflationTitle, { color: tint }]}>
                        {isBeating ? t.inflationBeatingTitle : t.inflationLaggingTitle}
                      </Text>
                    </View>
                    <View style={s.inflationStatsRow}>
                      <View style={s.inflationStatCol}>
                        <Text style={[s.inflationStatVal, { color: colors.text }]}>
                          {sm.gainPct >= 0 ? '+' : ''}{sm.gainPct.toFixed(1)}%
                        </Text>
                        <Text style={[s.inflationStatLabel, { color: colors.mutedForeground }]}>{t.yourReturnLabel}</Text>
                      </View>
                      <View style={[s.inflationDivider, { backgroundColor: tint + '30' }]} />
                      <View style={s.inflationStatCol}>
                        <Text style={[s.inflationStatVal, { color: colors.text }]}>~{inflation.rate.toFixed(1)}%</Text>
                        <Text style={[s.inflationStatLabel, { color: colors.mutedForeground }]}>{t.egpInflationLabel}</Text>
                      </View>
                    </View>
                    <Text style={[s.inflationDiffText, { color: tint }]}>
                      {isBeating ? t.inflationBeatingDiff(diff.toFixed(1)) : t.inflationLaggingDiff(diff.toFixed(1))}
                    </Text>
                  </View>
                );
              })()}
            </View>
            )}

            {/* ── Community comparison ─────────────────────────────────── */}
            {activeSection === 'overview' && benchmark?.available && (
              <View style={s.section}>
                <SLabel
                  icon="users"
                  title={t.communityComparisonLabel}
                  sub={t.communityComparisonSub(String(benchmark.sampleSize))}
                />
                <InsightCard
                  icon={(benchmark.userPctChange ?? 0) >= (benchmark.averagePctChange ?? 0) ? 'trending-up' : 'trending-down'}
                  color={(benchmark.userPctChange ?? 0) >= (benchmark.averagePctChange ?? 0) ? colors.green : '#F59E0B'}
                  text={
                    (benchmark.userPctChange ?? 0) >= (benchmark.averagePctChange ?? 0)
                      ? t.benchmarkBeating(
                          `${(benchmark.userPctChange ?? 0) >= 0 ? '+' : ''}${(benchmark.userPctChange ?? 0).toFixed(1)}`,
                          (benchmark.averagePctChange ?? 0).toFixed(1),
                        )
                      : t.benchmarkLagging(
                          `${(benchmark.userPctChange ?? 0) >= 0 ? '+' : ''}${(benchmark.userPctChange ?? 0).toFixed(1)}`,
                          (benchmark.averagePctChange ?? 0).toFixed(1),
                        )
                  }
                />
              </View>
            )}

            {/* ── Allocation bars ──────────────────────────────────────── */}
            {activeSection === 'overview' && sm.totalValue > 0 && (
              <View style={s.section}>
                <SLabel icon="pie-chart" title={t.assetAllocationLabel} sub={`${allocSegs.filter(seg => seg.value > 0).length} ${t.classesCount}`} />
                <AllocationBar segments={allocSegs} />
              </View>
            )}

            {/* ── Rebalancing ──────────────────────────────────────────── */}
            {activeSection === 'breakdown' && sm.totalValue > 0 && (
              <View style={s.section}>
                <SLabel
                  icon="target"
                  title={t.rebalancingLabel}
                  sub={targetsConfigured ? t.rebalancingSub(String(driftRows.length)) : undefined}
                />
                {!targetsConfigured ? (
                  concentrationRisk ? (
                    <PremiumGate feature={t.fixPlanTitle} description={t.fixPlanGateDesc}>
                      <Pressable onPress={() => { impact(); router.push('/target-allocation' as any); }}>
                        <View style={[fp.card, { backgroundColor: colors.red + '0D', borderColor: colors.red + '30' }]}>
                          <View style={fp.header}>
                            <View style={[fp.iconBox, { backgroundColor: colors.red + '1E' }]}>
                              <Feather name="alert-triangle" size={15} color={colors.red} />
                            </View>
                            <Text style={[fp.title, { color: colors.text }]}>{t.fixPlanTitle}</Text>
                          </View>
                          <Text style={[fp.diagnosis, { color: colors.mutedForeground }]}>
                            {t.concentrationRiskDiagnosis(concentrationRisk.pct.toFixed(0), concentrationRisk.label)}
                          </Text>
                          <Text style={[fp.move, { color: colors.text }]}>{t.concentrationRiskHint}</Text>
                          <View style={fp.ctaRow}>
                            <Text style={[fp.ctaTxt, { color: colors.primary }]}>{t.rebalancingEmptyBtn}</Text>
                            <Feather name={forwardChevron()} size={13} color={colors.primary} />
                          </View>
                        </View>
                      </Pressable>
                    </PremiumGate>
                  ) : (
                    <Pressable
                      style={[dr.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => { impact(); router.push('/target-allocation' as any); }}
                    >
                      <View style={[dr.iconBox, { backgroundColor: colors.primary + '1A' }]}>
                        <Feather name="target" size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[dr.emptyTitle, { color: colors.text }]}>{t.rebalancingEmptyTitle}</Text>
                        <Text style={[dr.sub, { color: colors.mutedForeground }]}>{t.rebalancingEmptyHint}</Text>
                      </View>
                      <Feather name={forwardChevron()} size={16} color={colors.mutedForeground} />
                    </Pressable>
                  )
                ) : (
                  <Pressable onPress={() => { impact(); router.push('/target-allocation' as any); }}>
                    <View style={[s.performersList, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 }]}>
                      {driftRows.map(r => (
                        <DriftRow key={r.key} label={r.label} icon={r.icon} color={r.color} currentPct={r.currentPct} targetPct={r.targetPct} />
                      ))}
                      <View style={[dr.editRow, { borderTopColor: colors.border }]}>
                        <Feather name="edit-2" size={12} color={colors.primary} />
                        <Text style={[dr.editTxt, { color: colors.primary }]}>{t.editTargetsLabel}</Text>
                      </View>
                    </View>
                  </Pressable>
                )}

                {fixPlan && (
                  <PremiumGate feature={t.fixPlanTitle} description={t.fixPlanGateDesc}>
                    <View style={[fp.card, { backgroundColor: colors.primary + '0D', borderColor: colors.primary + '30' }]}>
                      <View style={fp.header}>
                        <View style={[fp.iconBox, { backgroundColor: colors.primary + '1E' }]}>
                          <Feather name="tool" size={15} color={colors.primary} />
                        </View>
                        <Text style={[fp.title, { color: colors.text }]}>{t.fixPlanTitle}</Text>
                      </View>
                      <Text style={[fp.diagnosis, { color: colors.mutedForeground }]}>
                        {t.fixPlanDiagnosis(
                          fixPlan.overweight.label, (fixPlan.overweight.currentPct - fixPlan.overweight.targetPct).toFixed(0),
                          fixPlan.underweight.label, (fixPlan.underweight.targetPct - fixPlan.underweight.currentPct).toFixed(0),
                        )}
                      </Text>
                      <Text style={[fp.move, { color: colors.text }]}>
                        {t.fixPlanMove(fmtEGP(fixPlan.moveEGP), fixPlan.overweight.label, fixPlan.underweight.label)}
                      </Text>
                      {fixPlan.trimLabel && fixPlan.trimValue != null && (
                        <Text style={[fp.detail, { color: colors.mutedForeground }]}>
                          {t.fixPlanStartWith(fixPlan.trimLabel, fmtEGP(fixPlan.trimValue))}
                        </Text>
                      )}
                      {fixPlan.addGramsNote && (
                        <Text style={[fp.detail, { color: colors.mutedForeground }]}>{fixPlan.addGramsNote}</Text>
                      )}
                      <Text style={[fp.disclaimer, { color: colors.mutedForeground }]}>{t.fixPlanDisclaimer}</Text>
                    </View>
                  </PremiumGate>
                )}
              </View>
            )}

            {/* ── Performers ───────────────────────────────────────────── */}
            {activeSection === 'breakdown' && performers.length > 0 && (
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

            {/* ── Realized gains ───────────────────────────────────────── */}
            {activeSection === 'history' && soldHoldings.length > 0 && (
              <View style={s.section}>
                <SLabel icon="archive" title={t.realizedGainsLabel} sub={`${soldHoldings.length} ${t.investmentPlural}`} />
                <Pressable
                  onPress={() => { impact(); router.push('/sold-holdings' as any); }}
                  style={({ pressed }) => [
                    rg.card,
                    { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={rg.left}>
                    <Text style={[rg.label, { color: colors.mutedForeground }]}>{t.totalRealizedPLLabel}</Text>
                    <Text
                      style={[rg.value, { color: totalRealized >= 0 ? colors.green : colors.red }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {totalRealized >= 0 ? '+' : ''}{fmtK(totalRealized)} <Text style={rg.currency}>EGP</Text>
                    </Text>
                  </View>
                  <Feather name={forwardChevron()} size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            )}

            {/* ── Daily change history ─────────────────────────────────── */}
            {activeSection === 'history' && dailyChanges.length > 0 && (
              <View style={s.section}>
                <SLabel icon="calendar" title={t.dailyHistoryLabel} sub={`${dailyChanges.length} ${t.daysTrackedLabel}`} />
                <Pressable
                  onPress={() => { impact(); router.push('/daily-history' as any); }}
                  style={({ pressed }) => [
                    dh.card,
                    { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={s.aiTitleRow}>
                    <Text style={[dh.cardTitle, { color: colors.text }]}>{t.dailyHistoryLabel}</Text>
                    <BetaChip label={t.dailyHistoryBetaChip} />
                  </View>
                  <Feather name={forwardChevron()} size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            )}

            {/* ── Smart insights ───────────────────────────────────────── */}
            {activeSection === 'overview' && (
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
            )}

            {/* ── Asset breakdown (horizontal strip, was 6 stacked cards) ── */}
            {activeSection === 'breakdown' && (
            <View style={s.section}>
              <SLabel
                icon="pie-chart"
                title={t.assetBreakdownStripLabel}
                sub={`${[sm.goldV, sm.silverV, sm.stockV, sm.reV, sm.paV, sm.fiV].filter(v => v > 0).length} ${t.classesCount}`}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={hs.strip}
                decelerationRate="fast"
                snapToInterval={spotlightCardWidth + 12}
                snapToAlignment="start"
              >
                {sm.goldV > 0 && (
                  <View style={[hs.card, { width: spotlightCardWidth }]}>
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
                {sm.silverV > 0 && (
                  <View style={[hs.card, { width: spotlightCardWidth }]}>
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
                {sm.stockV > 0 && (
                  <View style={[hs.card, { width: spotlightCardWidth }]}>
                    <ClassSpotlight
                      title={t.stockHoldingsTitle}
                      countLabel={`${sm.stockCount}`}
                      value={sm.stockV}
                      cost={sm.stockCost}
                      gainPct={sm.stockGainPct}
                      tintColor="#4A9EFF"
                      footerText={(() => {
                        const top = performers.find(p => p.h.type === 'stock');
                        return top ? t.topPerformerFooter(top.label, top.gainPct.toFixed(1)) : undefined;
                      })()}
                    />
                  </View>
                )}
                {sm.reV > 0 && (
                  <View style={[hs.card, { width: spotlightCardWidth }]}>
                    <ClassSpotlight
                      title={t.realEstateHoldingsTitle}
                      countLabel={`${sm.reCount}`}
                      value={sm.reV}
                      cost={sm.reCost}
                      gainPct={sm.reGainPct}
                      tintColor="#A47FCA"
                    />
                  </View>
                )}
                {sm.paV > 0 && (
                  <View style={[hs.card, { width: spotlightCardWidth }]}>
                    <ClassSpotlight
                      title={t.personalAssetsHoldingsTitle}
                      countLabel={`${sm.paCount}`}
                      value={sm.paV}
                      cost={sm.paCost}
                      gainPct={sm.paGainPct}
                      tintColor="#E08E45"
                    />
                  </View>
                )}
                {sm.fiV > 0 && (
                  <View style={[hs.card, { width: spotlightCardWidth }]}>
                    <ClassSpotlight
                      title={t.fixedIncomeHoldingsTitle}
                      countLabel={`${sm.fiCount}`}
                      value={sm.fiV}
                      cost={sm.fiCost}
                      gainPct={sm.fiGainPct}
                      tintColor="#22C55E"
                    />
                  </View>
                )}
              </ScrollView>
            </View>
            )}
          </>
        )}
      </PremiumGate>

      {/* ── Weekly Recap entry point ──────────────────────────────────
           Free for everyone (not behind the Portfolio Analytics
           PremiumGate above) — it's a shareable, viral moment, gating it
           would work against the whole point of it. Last thing on the
           screen: a closing "here's your week" note after everything
           else, not competing with the Planning/Tools/Analytics sections
           for first attention. */}
      {hasHoldings && sm.totalValue > 0 && (
        <Pressable
          style={[s.recapCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => { impact(); setRecapVisible(true); }}
        >
          <View style={[s.recapIconWrap, { backgroundColor: colors.primary + '18' }]}>
            <Feather name="bar-chart-2" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.recapTitle, { color: colors.text }]}>{t.weeklyRecapEntryLabel}</Text>
            {weeklyPctChange != null && (
              <Text style={[s.recapSub, { color: weeklyPctChange >= 0 ? colors.green : colors.red }]}>
                {weeklyPctChange >= 0 ? '+' : ''}{weeklyPctChange.toFixed(1)}%
              </Text>
            )}
          </View>
          <Feather name={forwardArrow()} size={16} color={colors.mutedForeground} />
        </Pressable>
      )}
    </ScrollView>
    <WeeklyRecapCard
      visible={recapVisible}
      onDismiss={() => setRecapVisible(false)}
      pctChange={weeklyPctChange}
      egpChange={weeklyEgpChange}
      currentValue={sm.totalValue}
      currencyLabel="EGP"
      allocation={[
        { label: t.gold, value: sm.goldV, color: colors.primary },
        { label: t.silver, value: sm.silverV, color: colors.silverColor },
        { label: t.egxStock, value: sm.stockV, color: '#4A9EFF' },
        { label: t.realEstate, value: sm.reV, color: '#A47FCA' },
        { label: t.personalAsset, value: sm.paV, color: '#E08E45' },
        // Net of any linked-loan balance — matches currentValue above
        // (sm.totalValue, already net-of-loan), so these segments actually
        // sum to it.
        { label: t.fixedIncome, value: sm.fiVNetOfLoans, color: '#22C55E' },
      ]}
    />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 28 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.5, marginBottom: 4 },
  pageTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },

  recapCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  recapIconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  recapTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  recapSub: { fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 2 },

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
  inflationCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 4, gap: 10 },
  inflationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inflationIconWrap: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  inflationTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  inflationStatsRow: { flexDirection: 'row', alignItems: 'center' },
  inflationStatCol: { flex: 1, alignItems: 'center', gap: 2 },
  inflationStatVal: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  inflationStatLabel: { fontSize: 10.5, fontFamily: 'Inter_500Medium' },
  inflationDivider: { width: 1, height: 30, alignSelf: 'center' },
  inflationDiffText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },

  // Generic section
  section: { gap: 14 },
  performersList: { gap: 4 },
  insightsList: { gap: 10 },

  // Section dividers (between Portfolio / Market / Tools)
  sectionDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: -20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  aiAssistantCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1, padding: 16 },
  aiAssistantIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  aiSparkle: {
    position: 'absolute', top: -3, right: -3, width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
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
  planningRow: { flexDirection: 'row', gap: 10 },
  planningToolCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  planningToolAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  planningToolIcon:   { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planningToolLabel:  { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  planningToolSub:    { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
