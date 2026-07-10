import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { genCurve, buildSmoothPath, ChartPt, ChartPeriod } from '@/utils/chartUtils';

interface PerfChartProps {
  gainPct: number;
  period: ChartPeriod;
  seed: number;
  width: number;
  height?: number;
}

export function PerfChart({ gainPct, period, seed, width, height = 110 }: PerfChartProps) {
  const colors = useColors();
  if (width < 10) return <View style={{ height }} />;

  const data = genCurve(gainPct, period, seed);
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
  const lastPt = pts[pts.length - 1];
  const fillPath = `${linePath} L ${lastPt.x.toFixed(2)},${height} L 0,${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="pfc" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.30" />
          <Stop offset="0.55" stopColor={color} stopOpacity="0.08" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={fillPath} fill="url(#pfc)" />
      <Path d={linePath} fill="none" stroke={color}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={lastPt.x} cy={lastPt.y} r="4" fill={color} />
      <Circle cx={lastPt.x} cy={lastPt.y} r="8" fill={color} fillOpacity="0.2" />
    </Svg>
  );
}
