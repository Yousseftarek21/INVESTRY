import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { buildSmoothPath, snapshotsToValues, ChartPt, ChartPeriod, PortfolioSnapshotItem } from '@/utils/chartUtils';

interface PerfChartProps {
  gainPct: number;
  period: ChartPeriod;
  seed?: number;
  width: number;
  height?: number;
  snapshots?: PortfolioSnapshotItem[];
}

export function PerfChart({ gainPct, period, width, height = 110, snapshots }: PerfChartProps) {
  const colors = useColors();
  const t = useT();
  if (width < 10) return <View style={{ height }} />;

  const realValues = snapshots ? snapshotsToValues(snapshots, period) : null;

  // No real data yet — show a flat dashed line + a hint so the user knows
  // the chart builds as they open the app on different days.
  if (realValues === null) {
    const midY = height / 2;
    return (
      <View>
        <Svg width={width} height={height}>
          <Line
            x1={8} y1={midY} x2={width - 8} y2={midY}
            stroke={colors.mutedForeground}
            strokeWidth="1.5"
            strokeDasharray="6,5"
            strokeOpacity="0.35"
          />
        </Svg>
        <Text style={{
          textAlign: 'center',
          color: colors.mutedForeground,
          fontSize: 11,
          fontFamily: 'Inter_400Regular',
          marginTop: 6,
          opacity: 0.75,
        }}>
          {t.chartBuildingHint}
        </Text>
      </View>
    );
  }

  const data = realValues;
  const color = gainPct >= 0 ? colors.green : colors.red;
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
  );
}
