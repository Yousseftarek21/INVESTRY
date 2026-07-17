import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { buildSmoothPath, snapshotsToValues, ChartPt, ChartPeriod, PortfolioSnapshotItem } from '@/utils/chartUtils';

interface PerfChartProps {
  period: ChartPeriod;
  width: number;
  height?: number;
  snapshots?: PortfolioSnapshotItem[];
  /**
   * Real [value at start of today, value now] pair for the 1D period, derived
   * from actual live price/accrual change (not fabricated). Covers every
   * holding type with a real daily change (gold, silver, stocks, fixed
   * income); real estate/personal assets/cash contribute $0 — see caller.
   */
  todayValues?: [number, number];
}

export function PerfChart({ period, width, height = 110, snapshots, todayValues }: PerfChartProps) {
  const colors = useColors();
  const t = useT();
  if (width < 10) return <View style={{ height }} />;

  const periodValues = period === '1D'
    ? (todayValues ?? null)
    : (snapshots ? snapshotsToValues(snapshots, period) : null);

  // Longer periods need multiple days of real history, which a brand-new
  // account doesn't have yet. Rather than show nothing, fall back to
  // today's real movement (same real data as 1D) with a small honest
  // note — always something real on screen, never a fabricated curve.
  const usingTodayFallback = period !== '1D' && periodValues === null;
  const realValues = periodValues ?? (usingTodayFallback ? todayValues ?? null : null);

  // No real data at all yet (e.g. prices still loading) — a clear, visible
  // empty state, not a subtle dashed line easy to mistake for broken.
  if (realValues === null) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Feather name="trending-up" size={20} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
        <Text style={{
          textAlign: 'center',
          color: colors.mutedForeground,
          fontSize: 12,
          fontFamily: 'Inter_500Medium',
        }}>
          {t.chartBuildingHint}
        </Text>
      </View>
    );
  }

  const data = realValues;
  // Color reflects whether THIS period's line actually went up or down
  // (first vs last real value) — not the portfolio's all-time gainPct,
  // which caused a genuinely-up-today line to render red because the
  // all-time return happened to be negative.
  const color = data[data.length - 1] >= data[0] ? colors.green : colors.red;
  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const range = maxV - minV || 1;
  const pad = 10;

  const pts: ChartPt[] = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: pad + ((maxV - v) / range) * (height - pad * 2),
    value: v,
  }));

  const linePath = buildSmoothPath(pts);
  const firstPt = pts[0];
  const lastPt = pts[pts.length - 1];
  const fillPath = `${linePath} L ${lastPt.x.toFixed(2)},${height} L 0,${height} Z`;

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="pfc" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.28" />
            <Stop offset="0.6" stopColor={color} stopOpacity="0.06" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={fillPath} fill="url(#pfc)" />
        <Path d={linePath} fill="none" stroke={color}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={firstPt.x} cy={firstPt.y} r="3" fill={color} fillOpacity="0.4" />
        <Circle cx={lastPt.x} cy={lastPt.y} r="4" fill={color} />
        <Circle cx={lastPt.x} cy={lastPt.y} r="9" fill={color} fillOpacity="0.15" />
      </Svg>
      {usingTodayFallback && (
        <Text style={{
          textAlign: 'center',
          color: colors.mutedForeground,
          fontSize: 10,
          fontFamily: 'Inter_400Regular',
          marginTop: 4,
          opacity: 0.7,
        }}>
          {t.chartTodayFallbackHint}
        </Text>
      )}
    </View>
  );
}
