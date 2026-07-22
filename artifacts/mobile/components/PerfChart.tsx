import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import {
  buildSmoothPath, snapshotsToValues, sanitizeSeries,
  ChartPt, ChartDataPoint, ChartPeriod, PortfolioSnapshotItem,
} from '@/utils/chartUtils';

// Fraction of the chart's height reserved above the highest point and below
// the lowest, so the line/gradient never touches or clips against the
// component's top/bottom edge regardless of how tight or wide the real
// value range for the active period turns out to be.
const VERTICAL_PADDING_FRACTION = 0.08;

interface PerfChartProps {
  period: ChartPeriod;
  width: number;
  height?: number;
  snapshots?: PortfolioSnapshotItem[];
  /**
   * Real observed total-portfolio-value samples for today (2+ points),
   * derived from actual live price/accrual change — never fabricated.
   * Starts as just [start-of-day, now] early in the day and gains real
   * in-between points as the day goes on (see useIntradaySamples), so the
   * 1D curve fills in with genuine shape instead of staying a flat line.
   */
  todayValues?: number[];
  /**
   * Real [total cost basis, current total value] pair — used as the fallback
   * for periods longer than 1D when there isn't yet enough real snapshot
   * history. Reflects genuine all-time direction (e.g. a portfolio down 21%
   * overall renders a down/red line), unlike using today's tiny move, which
   * could contradict the real all-time trend.
   */
  allTimeValues?: [number, number];
  /**
   * Thumbnail/snapshot rendering — this chart has no crosshair, tooltip, pan,
   * or zoom behavior to begin with (it's a static SVG paint), so this mainly
   * guarantees that stays true: touches pass straight through to whatever is
   * behind the chart instead of being captured by it. Defaults on since every
   * current call site (Home, Analytics) embeds this as a small inline
   * snapshot, never a full interactive screen.
   */
  snapshotMode?: boolean;
}

export function PerfChart({
  period, width, height = 110, snapshots, todayValues, allTimeValues, snapshotMode = true,
}: PerfChartProps) {
  const colors = useColors();
  const t = useT();
  if (width < 10) return <View style={{ height }} />;

  // ── Resolve this period's real data into a common {time, value}[] shape ──
  // time is a genuine calendar date for multi-day periods (carried through
  // from the snapshot's own date), or a plain sample index for 1D/fallback
  // series where no per-sample timestamp exists upstream — never invented.
  let periodPoints: ChartDataPoint[] | null = null;
  if (period === '1D') {
    const sanitized = todayValues ? sanitizeSeries(todayValues) : [];
    periodPoints = sanitized.length >= 2 ? sanitized.map((v, i) => ({ time: i, value: v })) : null;
  } else if (snapshots) {
    const snap = snapshotsToValues(snapshots, period);
    periodPoints = snap ? snap.map(s => ({ time: s.date, value: s.value })) : null;
  }

  // Longer periods need multiple days of real history, which a brand-new
  // account (or one that just started tracking snapshots) doesn't have yet.
  // Rather than show nothing — or worse, today's tiny move mislabeled as the
  // whole period's trend — fall back to real cost-vs-current-value, which
  // always points the right direction even without daily history.
  const usingAllTimeFallback = period !== '1D' && periodPoints === null;
  let dataPoints: ChartDataPoint[] | null = periodPoints;
  if (dataPoints === null && usingAllTimeFallback && allTimeValues) {
    const sanitizedAllTime = sanitizeSeries(allTimeValues);
    if (sanitizedAllTime.length === 2) {
      dataPoints = [
        { time: 'cost', value: sanitizedAllTime[0] },
        { time: 'current', value: sanitizedAllTime[1] },
      ];
    }
  }

  // No real data at all yet (e.g. prices still loading), or what remained
  // after filtering out bad/missing samples isn't enough to draw a line —
  // a clear, visible empty state, not a subtle dashed line easy to mistake
  // for broken, and never a crash from a malformed upstream value.
  if (!dataPoints || dataPoints.length < 2) {
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

  const data = dataPoints;
  // Color reflects whether THIS period's line actually went up or down
  // (final value vs initial value) — not the portfolio's all-time gainPct,
  // which caused a genuinely-up-today line to render red because the
  // all-time return happened to be negative.
  const initialValue = data[0].value;
  const finalValue = data[data.length - 1].value;
  const color = finalValue >= initialValue ? colors.green : colors.red;

  // Optional, faint "simulated trend" reference: a straight line from your
  // cost basis to current value, shown only alongside genuinely real data
  // (never in place of it) so you always have the honest big-picture
  // direction for context, even while looking at a shorter real window.
  // Skipped for 1D (too short to need big-picture context) and ALL/fallback
  // views (where the real line already IS this exact comparison).
  const sanitizedAllTime = allTimeValues ? sanitizeSeries(allTimeValues) : [];
  const showTrendOverlay =
    period !== '1D' && !usingAllTimeFallback &&
    sanitizedAllTime.length === 2 && sanitizedAllTime[0] > 0 && sanitizedAllTime[1] > 0;

  const allValues = showTrendOverlay ? [...data.map(p => p.value), ...sanitizedAllTime] : data.map(p => p.value);
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  // range falls back to 1 when every value is identical (a flatline — e.g.
  // trading halted, or a still-loading portfolio) so the scale never divides
  // by zero; the line simply renders dead-center of the padded viewport.
  const range = maxV - minV || 1;
  const pad = height * VERTICAL_PADDING_FRACTION;

  const yFor = (v: number) => pad + ((maxV - v) / range) * (height - pad * 2);

  const pts: ChartPt[] = data.map((p, i) => ({
    x: (i / (data.length - 1)) * width,
    y: yFor(p.value),
    value: p.value,
    time: p.time,
  }));

  const linePath = buildSmoothPath(pts, 0.3);
  const firstPt = pts[0];
  const lastPt = pts[pts.length - 1];
  const fillPath = `${linePath} L ${lastPt.x.toFixed(2)},${height} L 0,${height} Z`;

  const trendPath = showTrendOverlay
    ? `M 0,${yFor(sanitizedAllTime[0]).toFixed(2)} L ${width.toFixed(2)},${yFor(sanitizedAllTime[1]).toFixed(2)}`
    : null;

  return (
    <View pointerEvents={snapshotMode ? 'none' : 'auto'}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="pfc" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.30" />
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
