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

// Africa/Cairo, not UTC — must match the server's cairoDateString() and the
// two snapshot hooks (usePortfolioSnapshots, useIntradaySamples), or a
// UTC-based cutoff/today comparison can be a day off for ~3h after every
// Cairo midnight (Egypt is UTC+3).
function cairoDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}

/** Real recorded coverage: how far back tracked history actually reaches. */
export interface HistoryCoverage {
  /** Earliest tracked date ("YYYY-MM-DD"), or null when nothing is tracked. */
  earliestDate: string | null;
  /** Whole days between the earliest tracked date and today, inclusive. */
  trackedDays: number;
}

export function getHistoryCoverage(snapshots: PortfolioSnapshotItem[]): HistoryCoverage {
  if (!snapshots.length) return { earliestDate: null, trackedDays: 0 };
  const earliestDate = snapshots.reduce(
    (min, s) => (s.date < min ? s.date : min),
    snapshots[0].date,
  );
  const startMs = new Date(earliestDate).getTime();
  if (!Number.isFinite(startMs)) return { earliestDate: null, trackedDays: 0 };
  const todayMs = new Date(cairoDateStr(new Date())).getTime();
  return {
    earliestDate,
    trackedDays: Math.max(1, Math.round((todayMs - startMs) / 86_400_000) + 1),
  };
}

/**
 * A period is only offered when real recorded history actually reaches back
 * to its window start — otherwise it would render the exact same line as a
 * shorter period (all it can do is re-show the same limited data), which
 * reads as a duplicate/fake curve rather than a real N-day view.
 *
 * 1D is always available (it's live intraday data, not snapshot history).
 * ALL is always available (its window is whatever exists, by definition).
 */
export function isPeriodAvailable(period: ChartPeriod, coverage: HistoryCoverage): boolean {
  if (period === '1D' || period === 'ALL') return true;
  // Most of the window, not all of it. Recording starts whenever tracking was
  // switched on, which is usually a little after signup — demanding a full
  // 30 days would lock 1M behind a few missing days even though ~25 days of
  // real data is a genuine, useful month view. The chart labels the real
  // start date either way, so partial coverage is stated, not hidden. Still
  // far too strict for a window nothing reaches (3M/1Y on a month of data),
  // which is the duplicate-curve case this exists to prevent.
  return coverage.trackedDays >= PERIOD_DAYS[period] * 0.7;
}

/**
 * Converts stored portfolio snapshots into chart points for the given
 * period. Returns null when there isn't enough real history to draw a
 * meaningful line. Keeps each point's real calendar date (rather than
 * collapsing to bare numbers) so the chart can carry genuine timestamps.
 *
 * liveValue, when given, overlays today's entry with the current
 * real-time portfolio total instead of whatever was last persisted to
 * local/server storage — persistence is debounced (see
 * usePortfolioSnapshots), so without this overlay the last point can lag
 * several seconds to minutes behind what the 1D chart shows instantly.
 */
export function snapshotsToValues(
  snapshots: PortfolioSnapshotItem[],
  period: ChartPeriod,
  liveValue?: number,
): PortfolioSnapshotItem[] | null {
  if (period === '1D') return null; // no intraday data
  const days = PERIOD_DAYS[period];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cairoDateStr(cutoff);
  let filtered = snapshots.filter(s => s.date >= cutoffStr);

  if (typeof liveValue === 'number' && Number.isFinite(liveValue) && liveValue > 0) {
    const today = cairoDateStr(new Date());
    const idx = filtered.findIndex(s => s.date === today);
    const todayPoint = { date: today, value: liveValue };
    filtered = idx >= 0
      ? [...filtered.slice(0, idx), todayPoint, ...filtered.slice(idx + 1)]
      : [...filtered, todayPoint];
  }

  if (filtered.length < MIN_REAL_PTS) return null;

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
