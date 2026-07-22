export const CHART_PERIODS = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const;
export type ChartPeriod = typeof CHART_PERIODS[number];

export type ChartPt = { x: number; y: number; value: number; time: string | number };

export interface PortfolioSnapshotItem { date: string; value: number; }

/** Canonical shape for a single chart sample — real timestamp when one
 *  exists (a snapshot's calendar date), otherwise a sample index. */
export interface ChartDataPoint {
  time: string | number;
  value: number;
}

/** Drops null/undefined/NaN/Infinity entries so a single bad upstream
 *  sample can never crash path construction or corrupt the min/max scale. */
export function sanitizeSeries(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

/** Days of history each period requires to use real snapshot data. */
const PERIOD_DAYS: Record<ChartPeriod, number> = {
  '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365, 'ALL': 9999,
};

/** Minimum real snapshots needed before we show real data (not the seeded curve). */
const MIN_REAL_PTS = 2;

/**
 * Real snapshot history must span at least this fraction of the requested
 * period before we trust it as representative. Without this, 2 snapshots
 * from the last couple of days (all we may have right after this feature
 * started tracking) would satisfy "2+ points within the window" for ANY
 * period — including 1Y or ALL — mislabeling a tiny recent blip as the
 * whole period's trend, which can contradict the account's real overall
 * direction (e.g. showing "up" for 1Y when the portfolio is down all-time).
 */
const MIN_SPAN_FRACTION = 0.6;

/**
 * 'ALL' has no fixed length, so a fraction-of-period check doesn't apply.
 * Local snapshot tracking can never really span "all time" back to a
 * holding's actual purchase date — it only starts from whenever this
 * feature began running on the device. Require a real, substantial
 * history (~9 months) before treating that local history as a stand-in
 * for the account's entire lifetime; otherwise always defer to the
 * honest cost-vs-current-value comparison instead.
 */
const ALL_TIME_MIN_DAYS = 270;

/**
 * Converts stored portfolio snapshots into chart points for the given
 * period. Returns null when there isn't enough real history to draw a
 * meaningful line. Keeps each point's real calendar date (rather than
 * collapsing to bare numbers) so the chart can carry genuine timestamps.
 */
export function snapshotsToValues(
  snapshots: PortfolioSnapshotItem[],
  period: ChartPeriod,
): PortfolioSnapshotItem[] | null {
  if (period === '1D') return null; // no intraday data
  const days = PERIOD_DAYS[period];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const filtered = snapshots.filter(s => s.date >= cutoffStr);
  if (filtered.length < MIN_REAL_PTS) return null;

  const spanDays = (new Date(filtered[filtered.length - 1].date).getTime() - new Date(filtered[0].date).getTime()) / 86400000;
  const requiredSpanDays = period === 'ALL' ? ALL_TIME_MIN_DAYS : days * MIN_SPAN_FRACTION;
  if (spanDays < requiredSpanDays) return null;

  return filtered;
}

const DEFAULT_TENSION = 0.3;

/**
 * Smooths a line through real data points using cubic-Bezier segments whose
 * control points are derived from each point's neighbors (a Catmull-Rom-style
 * tangent estimate). The curve always passes exactly through every real
 * point — only the flow *between* points is adjusted, never the values
 * themselves — so this never implies a price movement that wasn't actually
 * observed, it just renders the connection between real samples less
 * mechanically than a straight ruler line. With exactly 2 points there is no
 * curvature information to work with at all: any smooth curve through both
 * endpoints is just the straight line between them, so that case is drawn
 * directly rather than run through the (identical, but more expensive) curve
 * math.
 */
export function buildSmoothPath(pts: ChartPt[], tension: number = DEFAULT_TENSION): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)} L ${pts[1].x.toFixed(2)},${pts[1].y.toFixed(2)}`;
  }

  const controlPoint = (
    current: ChartPt, previous: ChartPt | undefined, next: ChartPt | undefined, reverse: boolean,
  ): [number, number] => {
    const p = previous ?? current;
    const n = next ?? current;
    const dx = n.x - p.x;
    const dy = n.y - p.y;
    const angle = Math.atan2(dy, dx) + (reverse ? Math.PI : 0);
    const length = Math.sqrt(dx * dx + dy * dy) * tension;
    return [current.x + Math.cos(angle) * length, current.y + Math.sin(angle) * length];
  };

  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const [cp1x, cp1y] = controlPoint(pts[i - 1], pts[i - 2], pts[i], false);
    const [cp2x, cp2y] = controlPoint(pts[i], pts[i - 1], pts[i + 1], true);
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${pts[i].x.toFixed(2)},${pts[i].y.toFixed(2)}`;
  }
  return d;
}
