import { ChartDataPoint } from '@/utils/chartUtils';

/**
 * Reference datasets for PerfChart, in the same {time, value}[] shape the
 * component consumes internally. Not imported by any screen — this exists
 * purely to document/validate the two style states PerfChart recalibrates
 * between (bullish vs bearish), and to give a concrete, non-hypothetical
 * example of the data shape for anyone wiring up a new call site.
 *
 * PerfChart itself decides color from `data[last].value >= data[0].value`,
 * so any series where the final point is >= the first renders green/bullish,
 * and any series where it's lower renders red/bearish — these two datasets
 * are deliberately shaped to make that obvious at a glance.
 */

/** Net-positive session: opens at 1,000,000 EGP, closes up ~3.2%. */
export const MOCK_BULLISH_SESSION: ChartDataPoint[] = [
  { time: '09:30', value: 1_000_000 },
  { time: '10:15', value: 1_004_200 },
  { time: '11:00', value: 998_600 },   // real intraday dip — still a legitimate sample
  { time: '11:45', value: 1_009_800 },
  { time: '12:30', value: 1_015_300 },
  { time: '13:15', value: 1_011_900 },
  { time: '14:00', value: 1_021_400 },
  { time: '14:45', value: 1_018_700 },
  { time: '15:30', value: 1_032_100 }, // final > initial → colors.green, upward gradient fill
];

/** Net-negative session: opens at 1,000,000 EGP, closes down ~2.6%. */
export const MOCK_BEARISH_SESSION: ChartDataPoint[] = [
  { time: '09:30', value: 1_000_000 },
  { time: '10:15', value: 996_400 },
  { time: '11:00', value: 1_002_100 }, // real intraday bounce — still a legitimate sample
  { time: '11:45', value: 991_800 },
  { time: '12:30', value: 985_300 },
  { time: '13:15', value: 988_600 },
  { time: '14:00', value: 979_900 },
  { time: '14:45', value: 982_500 },
  { time: '15:30', value: 973_800 },   // final < initial → colors.red, downward gradient fill
];

/** Zero-volatility flatline (e.g. a halted/untraded asset) — exercises the
 *  range-fallback-to-1 guard in PerfChart so a static line never divides
 *  by zero or collapses the padded viewport. */
export const MOCK_FLATLINE_SESSION: ChartDataPoint[] = [
  { time: '09:30', value: 500_000 },
  { time: '12:30', value: 500_000 },
  { time: '15:30', value: 500_000 },
];

/** Includes a null and a non-finite entry, as raw values might arrive from
 *  a flaky upstream feed — exercises sanitizeSeries() before this ever
 *  reaches PerfChart's own {time,value}[] normalization. */
export const MOCK_DIRTY_FEED: (number | null | undefined)[] = [
  1_000_000, null, 1_004_200, NaN, undefined, 1_009_800, 998_600, 1_012_400,
];
