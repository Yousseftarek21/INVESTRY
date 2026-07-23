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

/**
 * Smooths a line through real data points using monotonic cubic Hermite
 * interpolation (Fritsch–Carlson). The curve always passes exactly through
 * every real point, and — unlike a plain Catmull-Rom-style tangent spline —
 * is mathematically guaranteed to never overshoot past the range of its
 * neighboring points. A naive tangent spline can bulge slightly above a
 * peak or below a valley between two real samples, which both visually
 * implies a value that was never actually observed and can clip against a
 * chart's padded bounds (since the padding is sized to the real data range,
 * not to an overshoot the curve math might introduce). This produces the
 * same kind of smooth, flowing line for typical price data — the
 * difference is only visible exactly at sharp peaks/valleys, where this one
 * flattens the tangent instead of overshooting through it.
 */
export function buildSmoothPath(pts: ChartPt[]): string {
  const n = pts.length;
  if (n < 2) return '';
  if (n === 2) {
    return `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)} L ${pts[1].x.toFixed(2)},${pts[1].y.toFixed(2)}`;
  }

  // Secant slope of each consecutive pair.
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    d.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx);
  }

  // Initial tangent at each point: the secant itself at the two endpoints;
  // a flat tangent (0) at any local min/max (a sign change between the two
  // adjacent secants) since a peak/valley has no meaningful "direction" to
  // follow through — that flat tangent is exactly what prevents overshoot
  // at the point this bug was actually happening. Otherwise, the average
  // of the two adjacent secants.
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }

  // Fritsch–Carlson clamp: bounds each tangent relative to its interval's
  // secant slope so the curve can't overshoot even on non-extremum stretches.
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }

  let path = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const cp1x = pts[i].x + dx / 3;
    const cp1y = pts[i].y + (m[i] * dx) / 3;
    const cp2x = pts[i + 1].x - dx / 3;
    const cp2y = pts[i + 1].y - (m[i + 1] * dx) / 3;
    path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
  }
  return path;
}
