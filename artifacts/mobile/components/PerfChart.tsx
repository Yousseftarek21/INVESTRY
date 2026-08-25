import React from 'react';
import { ActivityIndicator, PanResponder, PanResponderInstance, Text, View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
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
   * in-between points as the day goes on (see useServerIntraday), so the
   * 1D curve fills in with genuine shape instead of staying a flat line.
   */
  todayValues?: number[];
  /**
   * Current real-time total portfolio value — overlays today's entry in
   * `snapshots` for every non-1D period so the last point tracks live
   * movement immediately, the same way `todayValues` does for 1D, instead
   * of waiting on the debounced snapshot save to catch up.
   */
  liveValue?: number;
  /**
   * Real [total cost basis, current total value] pair — used as the fallback
   * for periods longer than 1D when there isn't yet enough real snapshot
   * history. Reflects genuine all-time direction (e.g. a portfolio down 21%
   * overall renders a down/red line), unlike using today's tiny move, which
   * could contradict the real all-time trend.
   */
  allTimeValues?: [number, number];
  /**
   * Lets the user drag along the curve to read the real value at each
   * recorded point — the honest answer to "is this line actually right?",
   * since every position maps to a stored value rather than a smoothed
   * guess. Requires formatScrubValue to render the readout.
   */
  interactive?: boolean;
  /**
   * Formats a scrubbed value for display. Supplied by the caller because it
   * owns currency conversion, locale, and the hide-values privacy toggle.
   */
  formatScrubValue?: (value: number) => string;
  /**
   * Fires as scrubbing starts/stops so the embedding screen can freeze its
   * ScrollView. Without this the ScrollView wins the responder negotiation
   * mid-drag and the page scrolls out from under the finger instead of the
   * chart tracking it.
   */
  onScrubChange?: (scrubbing: boolean) => void;
  /**
   * Thumbnail/snapshot rendering — this chart has no crosshair, tooltip, pan,
   * or zoom behavior to begin with (it's a static SVG paint), so this mainly
   * guarantees that stays true: touches pass straight through to whatever is
   * behind the chart instead of being captured by it. Defaults on since every
   * current call site (Home, Analytics) embeds this as a small inline
   * snapshot, never a full interactive screen.
   */
  snapshotMode?: boolean;
  /**
   * True while the caller is still waiting on a real data fetch (e.g.
   * useServerIntraday) rather than genuinely lacking enough history yet.
   * Both cases render as "fewer than 2 points" below, but they aren't the
   * same thing to a user — "still loading" is a moment, "come back
   * tomorrow to build this chart" is a multi-day ask. Without this, every
   * cold app launch flashed the multi-day message for the second or so it
   * takes the real data to arrive, which read as the chart telling you to
   * come back later when it was actually just about to finish loading.
   */
  loading?: boolean;
}

export function PerfChart({
  period, width, height = 110, snapshots, todayValues, liveValue, allTimeValues,
  interactive = false, formatScrubValue, onScrubChange, snapshotMode = true, loading = false,
}: PerfChartProps) {
  const colors = useColors();
  const t = useT();

  // ── Scrub-to-read state ──────────────────────────────────────────────────
  // Declared before any early return so hook order never varies. The gesture
  // handler reads the current points through a ref rather than closing over
  // them, so it can be created once and still see fresh data every render.
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);
  const ptsRef = React.useRef<ChartPt[]>([]);
  const interactiveRef = React.useRef(interactive);
  interactiveRef.current = interactive;
  const onScrubChangeRef = React.useRef(onScrubChange);
  onScrubChangeRef.current = onScrubChange;

  const pickNearest = React.useCallback((x: number) => {
    const pts = ptsRef.current;
    if (!pts.length) return;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dist = Math.abs(pts[i].x - x);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    setActiveIdx(best);
  }, []);

  const endScrub = React.useCallback(() => {
    setActiveIdx(null);
    onScrubChangeRef.current?.(false);
  }, []);

  const panRef = React.useRef<PanResponderInstance | null>(null);
  if (!panRef.current) {
    panRef.current = PanResponder.create({
      // Claim on touch-down, and claim it during the capture phase too — a
      // parent ScrollView otherwise wins the negotiation on the first move
      // and scrolls the page instead of letting the chart track the finger.
      onStartShouldSetPanResponder: () => interactiveRef.current,
      onStartShouldSetPanResponderCapture: () => interactiveRef.current,
      onMoveShouldSetPanResponder: () => interactiveRef.current,
      onMoveShouldSetPanResponderCapture: () => interactiveRef.current,
      // Once scrubbing, don't surrender the gesture to the parent ScrollView
      // mid-drag — that would strand the readout under the user's finger.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => {
        onScrubChangeRef.current?.(true);
        pickNearest(e.nativeEvent.locationX);
      },
      onPanResponderMove: e => pickNearest(e.nativeEvent.locationX),
      onPanResponderRelease: () => endScrub(),
      onPanResponderTerminate: () => endScrub(),
    });
  }

  // Switching period rebuilds the series, so a held index would point at an
  // unrelated value (or past the end of a shorter one).
  React.useEffect(() => { setActiveIdx(null); }, [period]);

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
    const snap = snapshotsToValues(snapshots, period, liveValue);
    periodPoints = snap ? snap.map(s => ({ time: s.date, value: s.value })) : null;

    // ALL means "since you bought", so it starts at what you actually paid
    // (real cost basis) and runs through every tracked day to now. Without
    // this anchor it would start wherever snapshot tracking happened to
    // begin — which can rise even while the account is down since purchase,
    // rendering a green climbing line directly contradicting Total P/L.
    // Anchoring here makes ALL agree with Total P/L by construction: same
    // start (cost), same end (current value), so same sign, always.
    if (period === 'ALL' && periodPoints) {
      const cost = allTimeValues ? sanitizeSeries([allTimeValues[0]])[0] : undefined;
      if (typeof cost === 'number' && cost > 0) {
        periodPoints = [{ time: 'cost', value: cost }, ...periodPoints];
      }
    }
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
  // for broken, and never a crash from a malformed upstream value. `loading`
  // gets its own wording (see the prop's own comment) rather than sharing
  // chartBuildingHint's "come back another day" message with a transient
  // fetch that's about to resolve.
  if (!dataPoints || dataPoints.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        ) : (
          <Feather name="trending-up" size={20} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
        )}
        <Text style={{
          textAlign: 'center',
          color: colors.mutedForeground,
          fontSize: 12,
          fontFamily: 'Inter_500Medium',
        }}>
          {loading ? t.chartLoadingHint : t.chartBuildingHint}
        </Text>
      </View>
    );
  }

  const data = dataPoints;
  // Color always matches the direction the line itself actually draws
  // (final value vs initial value of what's on screen) — a line that rises
  // must be green and a line that falls must be red, full stop.
  //
  // 1W/1M/3M/1Y are rolling windows: "value now vs value N days ago". They
  // can legitimately be green while Total P/L is red — recent gains don't
  // undo an older loss, and anchoring them to cost instead would turn a
  // genuine one-month gain into a red line, which is simply wrong. Only
  // ALL is anchored to cost (above), because only ALL means "since you
  // bought" — the same span Total P/L measures, hence always the same sign.
  const initialValue = data[0].value;
  const finalValue = data[data.length - 1].value;
  const color = finalValue >= initialValue ? colors.green : colors.red;

  const allValues = data.map(p => p.value);
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

  const linePath = buildSmoothPath(pts);
  const firstPt = pts[0];
  const lastPt = pts[pts.length - 1];
  const fillPath = `${linePath} L ${lastPt.x.toFixed(2)},${height} L 0,${height} Z`;

  ptsRef.current = pts;

  const activePt = activeIdx != null && activeIdx < pts.length ? pts[activeIdx] : null;
  // Dated points (multi-day snapshots) can name their day; 1D's are intraday
  // sample indices and the cost anchor is synthetic, so those show the value
  // alone rather than inventing a timestamp for them.
  const activeDate = activePt && typeof activePt.time === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(activePt.time)
    ? activePt.time
    : null;
  const scrubText = activePt && formatScrubValue
    ? `${activeDate ? `${activeDate} · ` : ''}${formatScrubValue(activePt.value)}`
    : null;

  return (
    <View
      pointerEvents={interactive ? 'auto' : snapshotMode ? 'none' : 'auto'}
      {...(interactive ? panRef.current!.panHandlers : {})}
    >
      {/* Above the chart, not below it — the finger doing the scrubbing sits
          on the chart itself, so a readout underneath is hidden by the hand.
          Height is reserved even when idle so revealing it never shifts the
          layout mid-drag. */}
      {interactive && formatScrubValue && (
        <Text
          numberOfLines={1}
          style={{
            textAlign: 'center',
            color: scrubText ? colors.text : 'transparent',
            fontSize: 11,
            fontFamily: 'Inter_600SemiBold',
            marginBottom: 2,
          }}
        >
          {scrubText ?? ' '}
        </Text>
      )}
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="pfc" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.30" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={fillPath} fill="url(#pfc)" />
        <Path d={linePath} fill="none" stroke={color}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={firstPt.x} cy={firstPt.y} r="3" fill={color} fillOpacity="0.4" />
        {activePt ? (
          <>
            <Line x1={activePt.x} y1={0} x2={activePt.x} y2={height}
              stroke={colors.mutedForeground} strokeWidth="1" opacity={0.45} />
            <Circle cx={activePt.x} cy={activePt.y} r="4.5" fill={color} />
            <Circle cx={activePt.x} cy={activePt.y} r="10" fill={color} fillOpacity="0.18" />
          </>
        ) : (
          <>
            <Circle cx={lastPt.x} cy={lastPt.y} r="4" fill={color} />
            <Circle cx={lastPt.x} cy={lastPt.y} r="9" fill={color} fillOpacity="0.15" />
          </>
        )}
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
    </View>
  );
}
