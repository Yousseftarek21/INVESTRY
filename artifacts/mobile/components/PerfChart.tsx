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
  /**
   * Real [total cost basis, current total value] pair — used as the fallback
   * for periods longer than 1D when there isn't yet enough real snapshot
   * history. Reflects genuine all-time direction (e.g. a portfolio down 21%
   * overall renders a down/red line), unlike using today's tiny move, which
   * could contradict the real all-time trend.
   */
  allTimeValues?: [number, number];
}

export function PerfChart({ period, width, height = 110, snapshots, todayValues, allTimeValues }: PerfChartProps) {
  const colors = useColors();
  const t = useT();
  if (width < 10) return <View style={{ height }} />;

  const periodValues = period === '1D'
    ? (todayValues ?? null)
    : (snapshots ? snapshotsToValues(snapshots, period) : null);

  // Longer periods need multiple days of real history, which a brand-new
  // account (or one that just started tracking snapshots) doesn't have yet.
  // Rather than show nothing — or worse, today's tiny move mislabeled as the
  // whole period's trend — fall back to real cost-vs-current-value, which
  // always points the right direction even without daily history.
  const usingAllTimeFallback = period !== '1D' && periodValues === null;
  const realValues = periodValues ?? (usingAllTimeFallback ? allTimeValues ?? null : null);

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

  // Optional, faint "simulated trend" reference: a straight line from your
  // cost basis to current value, shown only alongside genuinely real data
  // (never in place of it) so you always have the honest big-picture
  // direction for context, even while looking at a shorter real window.
  // Skipped for 1D (too short to need big-picture context) and ALL/fallback
  // views (where the real line already IS this exact comparison).
  const showTrendOverlay =
    period !== '1D' && !usingAllTimeFallback &&
    !!allTimeValues && allTimeValues[0] > 0 && allTimeValues[1] > 0;

  const allValues = showTrendOverlay ? [...data, ...allTimeValues!] : data;
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const range = maxV - minV || 1;
  const pad = 10;

  const yFor = (v: number) => pad + ((maxV - v) / range) * (height - pad * 2);

  const pts: ChartPt[] = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: yFor(v),
    value: v,
  }));

  const linePath = buildSmoothPath(pts);
  const firstPt = pts[0];
  const lastPt = pts[pts.length - 1];
  const fillPath = `${linePath} L ${lastPt.x.toFixed(2)},${height} L 0,${height} Z`;

  const trendPath = showTrendOverlay
    ? `M 0,${yFor(allTimeValues![0]).toFixed(2)} L ${width.toFixed(2)},${yFor(allTimeValues![1]).toFixed(2)}`
    : null;

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
        {trendPath && (
          <Path d={trendPath} fill="none" stroke={colors.mutedForeground}
            strokeWidth="1.5" strokeDasharray="5,5" opacity={0.5} />
        )}
        <Path d={linePath} fill="none" stroke={color}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={firstPt.x} cy={firstPt.y} r="3" fill={color} fillOpacity="0.4" />
        <Circle cx={lastPt.x} cy={lastPt.y} r="4" fill={color} />
        <Circle cx={lastPt.x} cy={lastPt.y} r="9" fill={color} fillOpacity="0.15" />
      </Svg>
      {usingAllTimeFallback && (
        <Text style={{
          textAlign: 'center',
          color: colors.mutedForeground,
          fontSize: 10,
          fontFamily: 'Inter_400Regular',
          marginTop: 4,
          opacity: 0.7,
        }}>
          {t.chartAllTimeFallbackHint}
        </Text>
      )}
      {trendPath && (
        <Text style={{
          textAlign: 'center',
          color: colors.mutedForeground,
          fontSize: 10,
          fontFamily: 'Inter_400Regular',
          marginTop: 4,
          opacity: 0.6,
        }}>
          {t.chartSimulatedTrendHint}
        </Text>
      )}
    </View>
  );
}
