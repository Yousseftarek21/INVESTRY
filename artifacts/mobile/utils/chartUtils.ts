export const CHART_PERIODS = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const;
export type ChartPeriod = typeof CHART_PERIODS[number];

export type ChartPt = { x: number; y: number; value: number };

export interface PortfolioSnapshotItem { date: string; value: number; }

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
 * Converts stored portfolio snapshots into chart values for the given period.
 * Returns null when there isn't enough real history to draw a meaningful line.
 */
export function snapshotsToValues(
  snapshots: PortfolioSnapshotItem[],
  period: ChartPeriod,
): number[] | null {
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

  return filtered.map(s => s.value);
}

/**
 * Smooths a line through real data points using a Catmull-Rom-style spline.
 * The curve always passes exactly through every real point — only the
 * flow *between* points is adjusted, never their values — so increasing
 * the tension here makes existing real data look more organic/flowing
 * without ever implying movement that wasn't actually observed. With
 * exactly 2 points there is no curvature information to work with at all:
 * any smooth curve passing through both endpoints is just the straight
 * line between them, regardless of this tension value.
 */
/**
 * Straight-line segments between real points only — no smoothing. A curve
 * would imply motion between two real samples that never actually happened;
 * this matches the app's own "no data points are invented" chart policy.
 */
export function buildLinearPath(pts: ChartPt[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(2)},${pts[i].y.toFixed(2)}`;
  }
  return d;
}
