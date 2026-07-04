import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Animated, LayoutChangeEvent, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, {
  Defs, LinearGradient, Stop,
  Circle, Path,
} from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { Holding, MarketPrices } from '@/types';
import { FinancialTools } from '@/components/FinancialTools';
import { PremiumGate } from '@/components/PremiumGate';

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
function holdingLabel(h: Holding): string {
  if (h.type === 'gold') return `${h.karat.toUpperCase()} Gold`;
  if (h.type === 'silver') return 'Silver';
  if (h.type === 'stock') return h.symbol;
  if (h.type === 'real_estate') return h.propertyName || 'Real Estate';
  if (h.type === 'personal_asset') return h.name;
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

function genCurve(gainPct: number, period: Period, seed: number, n = 40): number[] {
  const scale: Record<Period, number> = { '1D': 0.12, '1W': 0.35, '1M': 0.9, '3M': 1.8, '1Y': 3.5, 'ALL': 6 };
  const s = scale[period];
  let r = (seed || 7) % 99991;
  const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  let v = 100;
  return Array.from({ length: n }, (_, i) => {
    v += (gainPct / 100) * s * (i / n) + (rand() - 0.47) * 1.8;
    return v;
  });
}

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

// ─── Animated arc ring ────────────────────────────────────────────────────────

function HealthArc({ score, size = 160 }: { score: number; size: number }) {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;
  const scoreColor =
    score >= 75 ? colors.green : score >= 50 ? '#F59E0B' : colors.red;
  const grade =
    score >= 75 ? 'Excellent' : score >= 50 ? 'Good' : score > 0 ? 'Needs Work' : 'No data';

  useEffect(() => {
    Animated.timing(anim, {
      toValue: score,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const sw = 14;
  const r = (size - sw) / 2;
  const cx = size / 2;
  const cy = size / 2;

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
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
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
        <Text style={[ha.score, { color: scoreColor }]}>{score}</Text>
        <Text style={[ha.outOf, { color: colors.mutedForeground }]}>out of 100</Text>
        <View style={[ha.gradePill, { backgroundColor: scoreColor + '22', borderColor: scoreColor + '44' }]}>
          <Text style={[ha.gradeText, { color: scoreColor }]}>{grade}</Text>
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

// ─── Stacked allocation bars ───────────────────────────────────────────────────

function AllocationBars({ segs }: {
  segs: { label: string; value: number; color: string; pct: number }[];
}) {
  const colors = useColors();
  // Keyed by label (not index) so adding/removing an asset class between
  // renders can't leave a stale-length array with missing entries — that
  // used to crash Animated.timing with "Cannot read property 'stopTracking'
  // of undefined" whenever the number of active asset classes changed
  // (e.g. adding the first Personal Asset holding).
  const widthsRef = useRef<Record<string, Animated.Value>>({});

  useEffect(() => {
    segs.forEach((seg, i) => {
      if (!widthsRef.current[seg.label]) {
        widthsRef.current[seg.label] = new Animated.Value(0);
      }
      Animated.timing(widthsRef.current[seg.label], {
        toValue: seg.pct,
        duration: 700 + i * 100,
        useNativeDriver: false,
      }).start();
    });
  }, [segs.map(s => s.pct).join(',')]);

  if (!segs.length) return null;

  return (
    <View style={ab.container}>
      {segs.map((seg, i) => {
        if (!widthsRef.current[seg.label]) {
          widthsRef.current[seg.label] = new Animated.Value(0);
        }
        const width = widthsRef.current[seg.label];
        return (
          <View key={seg.label} style={ab.row}>
            <View style={ab.meta}>
              <View style={[ab.dot, { backgroundColor: seg.color }]} />
              <Text style={[ab.label, { color: colors.text }]}>{seg.label}</Text>
              <Text style={[ab.value, { color: colors.mutedForeground }]}>{fmtK(seg.value)} EGP</Text>
            </View>
            <View style={[ab.track, { backgroundColor: colors.muted }]}>
              <Animated.View
                style={[
                  ab.fill,
                  {
                    backgroundColor: seg.color,
                    width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) as any,
                  },
                ]}
              />
            </View>
            <Text style={[ab.pct, { color: seg.color }]}>
              {seg.pct.toFixed(1)}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}
const ab = StyleSheet.create({
  container: { gap: 14 },
  row: { gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  label: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  value: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  pct: { fontSize: 12, fontFamily: 'Inter_700Bold', textAlign: 'right' },
});

// ─── Full-width performance chart ─────────────────────────────────────────────

function PerfChart({ gainPct, period, seed, width, height = 110 }: {
  gainPct: number; period: Period; seed: number; width: number; height: number;
}) {
  const colors = useColors();
  if (width < 10) return <View style={{ height }} />;
  const data = genCurve(gainPct, period, seed);
  const color = gainPct >= 0 ? colors.green : colors.red;
  const minV = Math.min(...data), maxV = Math.max(...data);
  const range = maxV - minV || 1;
  const pad = 10;
  const pts: Pt[] = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + ((maxV - v) / range) * (height - pad * 2);
    return { x, y, value: v };
  });
  const linePath = buildSmoothPath(pts);
  const lastPt = pts[pts.length - 1];
  const fillPath = `${linePath} L ${lastPt.x.toFixed(2)},${height} L 0,${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.30" />
          <Stop offset="0.55" stopColor={color} stopOpacity="0.08" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={fillPath} fill="url(#cf)" />
      <Path d={linePath} fill="none" stroke={color}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={lastPt.x} cy={lastPt.y} r="4" fill={color} />
      <Circle cx={lastPt.x} cy={lastPt.y} r="8" fill={color} fillOpacity="0.2" />
    </Svg>
  );
}

// ─── Podium performers ────────────────────────────────────────────────────────

function PodiumRow({ rank, label, gainPct, value, isFirst }: {
  rank: number; label: string; gainPct: number; value: number; isFirst: boolean;
}) {
  const colors = useColors();
  const isGain = gainPct >= 0;
  const gc = isGain ? colors.green : colors.red;
  const rankColors = ['#D4AC0D', '#C0C8D4', '#CD7F32'];
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

function ScoreBar({ label, score, max, color, icon }: {
  label: string; score: number; max: number; color: string; icon: keyof typeof Feather.glyphMap;
}) {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: score / max, duration: 800, useNativeDriver: false }).start();
  }, [score, max]);

  return (
    <View style={sb.row}>
      <View style={[sb.iconBox, { backgroundColor: color + '1A' }]}>
        <Feather name={icon} size={12} color={color} />
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
          <Text style={[ms.statLabel, { color: colors.mutedForeground }]}>Total Weight</Text>
        </View>
        <View style={[ms.divider, { backgroundColor: colors.border }]} />
        <View style={ms.statCol}>
          <Text style={[ms.statVal, { color: tintColor }]}>{fmtK(value)}<Text style={[ms.statUnit, { color: colors.mutedForeground }]}> EGP</Text></Text>
          <Text style={[ms.statLabel, { color: colors.mutedForeground }]}>Market Value</Text>
        </View>
        <View style={[ms.divider, { backgroundColor: colors.border }]} />
        <View style={ms.statCol}>
          <Text style={[ms.statVal, { color: colors.text }]}>{avgBuy.toFixed(0)}<Text style={[ms.statUnit, { color: colors.mutedForeground }]}> EGP/g</Text></Text>
          <Text style={[ms.statLabel, { color: colors.mutedForeground }]}>Avg Buy</Text>
        </View>
      </View>
      {livePrice !== undefined && (
        <View style={[ms.footer, { borderTopColor: tintColor + '20' }]}>
          <Feather name="radio" size={10} color={tintColor} />
          <Text style={[ms.footerTxt, { color: colors.mutedForeground }]}>
            Live price: <Text style={{ color: tintColor }}>{livePrice.toFixed(0)} EGP/g</Text>
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

function SLabel({ icon, title, sub }: {
  icon: keyof typeof Feather.glyphMap; title: string; sub?: string;
}) {
  const colors = useColors();
  return (
    <View style={sl.row}>
      <View style={[sl.iconWrap, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={13} color={colors.mutedForeground} />
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { holdings, isLoading: holdingsLoading } = useHoldings();
  const { data: prices, isLoading: pricesLoading, refetch } = useMarketPrices();
  const isLoading = pricesLoading || holdingsLoading;

  const [period, setPeriod] = useState<Period>('ALL');
  const [chartWidth, setChartWidth] = useState(0);

  // ── Maths ─────────────────────────────────────────────────────────────────────
  const sm = useMemo(() => {
    let goldV = 0, silverV = 0, stockV = 0, reV = 0, paV = 0, totalCost = 0;
    let goldCost = 0, silverCost = 0;
    let totalGoldGrams = 0, totalSilverGrams = 0;
    for (const h of holdings) {
      const v = computeValue(h, prices);
      const c = computeCost(h, prices);
      totalCost += c;
      if (h.type === 'gold') { goldV += v; goldCost += c; totalGoldGrams += h.grams; }
      else if (h.type === 'silver') { silverV += v; silverCost += c; totalSilverGrams += h.grams; }
      else if (h.type === 'stock') { stockV += v; }
      else if (h.type === 'personal_asset') { paV += v; }
      else { reV += v; }
    }
    const totalValue = goldV + silverV + stockV + reV + paV;
    const gain = totalValue - totalCost;
    const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    const goldGainPct = goldCost > 0 ? ((goldV - goldCost) / goldCost) * 100 : 0;
    const silverGainPct = silverCost > 0 ? ((silverV - silverCost) / silverCost) * 100 : 0;
    const goldAvgBuy = totalGoldGrams > 0 ? goldCost / totalGoldGrams : 0;
    const silverAvgBuy = totalSilverGrams > 0 ? silverCost / totalSilverGrams : 0;
    const metalPct = totalValue > 0 ? (goldV + silverV) / totalValue : 0;
    return {
      totalValue, totalCost, gain, gainPct,
      goldV, silverV, stockV, reV, paV,
      goldCost, silverCost, goldGainPct, silverGainPct,
      totalGoldGrams, totalSilverGrams, goldAvgBuy, silverAvgBuy,
      metalPct,
    };
  }, [holdings, prices]);

  // ── Health ────────────────────────────────────────────────────────────────────
  const typeCount = useMemo(() => new Set(holdings.map(h => h.type)).size, [holdings]);
  const health = useMemo(() => {
    if (!sm.totalValue) return { score: 0, div: 0, conc: 0, hedge: 0, real: 0 };
    const div = Math.min(30, typeCount * 8);
    const maxClass = Math.max(sm.goldV, sm.silverV, sm.stockV, sm.reV, sm.paV);
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
      return { h, v, gainPct: c > 0 ? ((v - c) / c) * 100 : 0, label: holdingLabel(h) };
    }).sort((a, b) => b.gainPct - a.gainPct),
    [holdings, prices]
  );

  // ── Allocation segs ───────────────────────────────────────────────────────────
  const allocSegs = useMemo(() => {
    const raw = [
      { label: 'Gold', value: sm.goldV, color: colors.primary },
      { label: 'Silver', value: sm.silverV, color: colors.silverColor },
      { label: 'EGX Stocks', value: sm.stockV, color: '#4A9EFF' },
      { label: 'Real Estate', value: sm.reV, color: '#A47FCA' },
      { label: 'Personal Assets', value: sm.paV, color: '#E08E45' },
    ].filter(s => s.value > 0);
    return raw.map(s => ({ ...s, pct: sm.totalValue > 0 ? (s.value / sm.totalValue) * 100 : 0 }));
  }, [sm, colors]);

  // ── Insights ──────────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    type I = { icon: keyof typeof Feather.glyphMap; color: string; text: string };
    const items: I[] = [];
    if (!holdings.length) {
      items.push({ icon: 'info', color: colors.primary, text: 'Add your first investment to see personalized insights about your portfolio.' });
      return items;
    }
    if (performers[0]?.gainPct !== 0) {
      const b = performers[0];
      items.push({ icon: 'trending-up', color: colors.green, text: `${b.label} is your best performer at ${b.gainPct > 0 ? '+' : ''}${b.gainPct.toFixed(1)}%.` });
    }
    const worst = performers[performers.length - 1];
    if (worst?.gainPct < -2) {
      items.push({ icon: 'trending-down', color: colors.red, text: `${worst.label} is down ${worst.gainPct.toFixed(1)}%. Consider reviewing this position.` });
    }
    if (typeCount < 2) {
      items.push({ icon: 'alert-triangle', color: '#F59E0B', text: 'All eggs in one basket. Spreading across gold, stocks, or real estate reduces risk.' });
    } else if (typeCount >= 3) {
      items.push({ icon: 'check-circle', color: colors.green, text: `Solid diversification — you hold ${typeCount} different asset classes.` });
    }
    if (sm.metalPct < 0.1 && sm.totalValue > 0) {
      items.push({ icon: 'shield', color: '#A47FCA', text: 'Gold & silver hedge against EGP inflation. A 10–20% metals allocation is a common strategy.' });
    }
    if ((prices?.goldChangePercent ?? 0) > 1) {
      items.push({ icon: 'award', color: colors.primary, text: `Gold up ${prices?.goldChangePercent.toFixed(2)}% today — your metals investments are appreciating.` });
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
    if (metalPct > 0) items.push({ icon: 'shield', color: colors.primary, text: `Precious metals represent ${metalPct.toFixed(0)}% of your portfolio — a strong inflation hedge against EGP depreciation.` });
    if (sm.goldV > 0 && sm.gain > 0) {
      const goldContrib = sm.totalValue > 0 ? (sm.goldV / sm.totalValue) * 100 : 0;
      items.push({ icon: 'award', color: colors.primary, text: `Gold is your largest contributor at ${goldContrib.toFixed(0)}% of total portfolio value.` });
    }
    if (sm.stockV > 0) {
      const stockPct = sm.totalValue > 0 ? (sm.stockV / sm.totalValue) * 100 : 0;
      items.push({ icon: 'bar-chart-2', color: '#4A9EFF', text: `EGX stocks make up ${stockPct.toFixed(0)}% of your portfolio. Consider monitoring market volatility.` });
    }
    if (sm.gainPct > 10) {
      items.push({ icon: 'trending-up', color: colors.green, text: `Your portfolio is up ${sm.gainPct.toFixed(1)}% overall — significantly outpacing traditional savings rates.` });
    } else if (sm.gainPct < -5) {
      items.push({ icon: 'trending-down', color: colors.red, text: `Portfolio is down ${Math.abs(sm.gainPct).toFixed(1)}%. Dollar-cost averaging can reduce the impact of short-term volatility.` });
    }
    if (prices?.goldChangePercent && Math.abs(prices.goldChangePercent) > 0.5) {
      const dir = prices.goldChangePercent > 0 ? 'up' : 'down';
      items.push({ icon: 'zap', color: '#F59E0B', text: `Gold is ${dir} ${Math.abs(prices.goldChangePercent).toFixed(2)}% today — ${dir === 'up' ? 'your metals investments are gaining.' : 'a potential buy opportunity.'}` });
    }
    return items.slice(0, 4);
  }, [holdings, sm, prices, colors]);

  const sparkSeed = holdings.reduce((s, h) => s + h.id.charCodeAt(0), 1);
  const hasHoldings = holdings.length > 0;
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  const healthColor = health.score >= 75 ? colors.green : health.score >= 50 ? '#F59E0B' : colors.red;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: topPad + 16, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={[s.pageTitle, { color: colors.text }]}>Analytics</Text>
        </View>
      </View>

      {/* ══ SECTION 1: Financial Tools (always first & visible) ══════ */}
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: colors.primary + '18' }]}>
          <Feather name="tool" size={15} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Financial Tools</Text>
          <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>Smart calculators for investors</Text>
        </View>
        <View style={[s.toolsBadge, { backgroundColor: colors.primary + '18' }]}>
          <Text style={[s.toolsBadgeTxt, { color: colors.primary }]}>8 TOOLS</Text>
        </View>
      </View>
      <FinancialTools />

      {/* ══ SECTION 2: Market Intelligence ══════════════════════════ */}
      <View style={[s.sectionDivider, { backgroundColor: colors.border }]} />
      <PremiumGate
        feature="Market Intelligence"
        description="Live USD/EGP rate, gold & silver prices by karat, and personalized portfolio signals — updated in real time."
      >
        <View style={s.sectionHeader}>
          <View style={[s.sectionIconWrap, { backgroundColor: '#4A9EFF18' }]}>
            <Feather name="globe" size={15} color="#4A9EFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Market Intelligence</Text>
            <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>Live rates & portfolio signals</Text>
          </View>
          <LiveDot />
        </View>

        {/* Market Summary Cards — 3-up row */}
        <View style={s.marketRow}>
          <View style={[s.mktCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.mktLabel, { color: colors.mutedForeground }]}>USD / EGP</Text>
            <Text style={[s.mktPrice, { color: colors.text }]}>
              {prices?.usdToEgp ? prices.usdToEgp.toFixed(2) : '—'}
            </Text>
            <View style={[s.mktBadge, { backgroundColor: '#4A9EFF18' }]}>
              <Text style={[s.mktBadgeTxt, { color: '#4A9EFF' }]}>LIVE</Text>
            </View>
          </View>

          <View style={[s.mktCard, { backgroundColor: colors.card, borderColor: colors.primary + '30' }]}>
            <Text style={[s.mktLabel, { color: colors.mutedForeground }]}>Gold 21K / g</Text>
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
            <Text style={[s.mktLabel, { color: colors.mutedForeground }]}>Silver / g</Text>
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
            <Text style={[s.karatStripLabel, { color: colors.mutedForeground }]}>GOLD PRICES (EGP/g)</Text>
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
            <SLabel icon="cpu" title="Personalized Insights" sub="Based on your portfolio" />
            <View style={s.insightsList}>
              {marketInsights.map((ins, i) => (
                <InsightCard key={i} icon={ins.icon} color={ins.color} text={ins.text} />
              ))}
            </View>
            <Text style={[s.disclaimer, { color: colors.mutedForeground }]}>
              Insights are informational only — not financial advice.
            </Text>
          </View>
        )}
      </PremiumGate>

      {/* ══ SECTION 3: Portfolio Analytics ═══════════════════════════ */}
      <View style={[s.sectionDivider, { backgroundColor: colors.border }]} />
      <PremiumGate
        feature="Portfolio Analytics"
        description="Portfolio health score, performance chart, asset allocation, top performers, and smart insights."
      >
        <View style={s.sectionHeader}>
          <View style={[s.sectionIconWrap, { backgroundColor: colors.primary + '18' }]}>
            <Feather name="bar-chart-2" size={15} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Portfolio Analytics</Text>
            <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>Performance, health & allocation</Text>
          </View>
        </View>

        {!hasHoldings ? (
          <EmptyState />
        ) : (
          <>
            {/* ── Health hero ──────────────────────────────────────────── */}
            <View style={[s.healthHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.heroSectionLabel, { color: colors.mutedForeground }]}>PORTFOLIO HEALTH</Text>
              <View style={s.healthArcWrap}>
                <HealthArc score={health.score} size={168} />
              </View>
              <View style={s.scoreBarsWrap}>
                <ScoreBar label="Diversification" score={health.div} max={30} color={colors.primary} icon="layers" />
                <ScoreBar label="Balance" score={health.conc} max={25} color="#4A9EFF" icon="sliders" />
                <ScoreBar label="Inflation Hedge" score={health.hedge} max={25} color="#F59E0B" icon="shield" />
                <ScoreBar label="Real Assets" score={health.real} max={20} color="#A47FCA" icon="home" />
              </View>
              <Text style={[s.disclaimer, { color: colors.mutedForeground }]}>
                Informational only — not financial advice.
              </Text>
            </View>

            {/* ── Performance chart ────────────────────────────────────── */}
            <View style={s.chartSection}>
              <SLabel icon="activity" title="Performance" sub={`${sm.gain >= 0 ? '+' : ''}${sm.gainPct.toFixed(2)}% all-time`} />
              <View
                onLayout={(e: LayoutChangeEvent) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0) setChartWidth(w);
                }}
                style={s.chartArea}
              >
                <PerfChart gainPct={sm.gainPct} period={period} seed={sparkSeed} width={chartWidth} height={110} />
              </View>
              <View style={s.periodRow}>
                {PERIODS.map(p => {
                  const active = p === period;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setPeriod(p)}
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
                Simulated trend based on your portfolio's actual return
              </Text>
            </View>

            {/* ── Allocation bars ──────────────────────────────────────── */}
            {allocSegs.length > 0 && (
              <View style={s.section}>
                <SLabel icon="pie-chart" title="Asset Allocation" sub={`${allocSegs.length} classes`} />
                <AllocationBars segs={allocSegs} />
              </View>
            )}

            {/* ── Performers ───────────────────────────────────────────── */}
            {performers.length > 0 && (
              <View style={s.section}>
                <SLabel icon="award" title="Performers" sub={`${performers.length} investments`} />
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
              <SLabel icon="zap" title="Smart Insights" sub={`${insights.length} observations`} />
              <View style={s.insightsList}>
                {insights.map((ins, i) => (
                  <InsightCard key={i} icon={ins.icon} color={ins.color} text={ins.text} />
                ))}
              </View>
              <Text style={[s.disclaimer, { color: colors.mutedForeground }]}>
                Insights are informational only — not financial advice.
              </Text>
            </View>

            {/* ── Gold spotlight ───────────────────────────────────────── */}
            {sm.goldV > 0 && (
              <View style={s.section}>
                <SLabel icon="star" title="Gold Breakdown" />
                <MetalSpotlight
                  title="GOLD HOLDINGS"
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
                <SLabel icon="circle" title="Silver Breakdown" />
                <MetalSpotlight
                  title="SILVER HOLDINGS"
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
  periodRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  periodPill: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 5 },
  periodTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  chartNote: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },

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
});
