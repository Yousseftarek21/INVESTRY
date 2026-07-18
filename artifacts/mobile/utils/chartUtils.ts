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

export function genCurve(gainPct: number, period: ChartPeriod, seed: number, n = 60): number[] {
  const scale: Record<ChartPeriod, number> = { '1D': 0.12, '1W': 0.35, '1M': 0.9, '3M': 1.8, '1Y': 3.5, 'ALL': 6 };
  const s = scale[period];
  let r = (seed || 7) % 99991;
  const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  let v = 100;
  return Array.from({ length: n }, (_, i) => {
    v += (gainPct / 100) * s * (i / n) + (rand() - 0.47) * 1.8;
    return v;
  });
}

export function buildSmoothPath(pts: ChartPt[]): string {
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
