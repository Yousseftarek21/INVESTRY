import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  size?: number;
  strokeWidth?: number;
}

const GAP_DEG = 3;

export function DonutChart({
  segments,
  selectedKey,
  onSelect,
  size = 150,
  strokeWidth = 20,
}: DonutChartProps) {
  const colors = useColors();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const total = segments.reduce((s, seg) => s + seg.value, 0);

  const animProg = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    animProg.setValue(0);
    Animated.timing(animProg, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [total]);

  if (total === 0) return null;

  let cumulativePct = 0;
  const computed = segments
    .filter(s => s.value > 0)
    .map(seg => {
      const pct = seg.value / total;
      const start = cumulativePct;
      cumulativePct += pct;
      const gapArc = (GAP_DEG / 360) * circumference;
      const arcLen = Math.max(0, pct * circumference - gapArc);
      const rotation = start * 360 - 90 + GAP_DEG / 2;
      return { ...seg, pct, start, arcLen, rotation };
    });

  const selectedSeg = computed.find(s => s.key === selectedKey) ?? null;

  return (
    <View style={styles.root}>
      {/* Donut */}
      <TouchableOpacity
        style={{ width: size, height: size }}
        onPress={() => onSelect(null)}
        activeOpacity={0.95}
      >
        <Svg width={size} height={size}>
          {/* Track */}
          <Circle
            cx={center} cy={center} r={radius}
            stroke={colors.muted}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {computed.map(seg => {
            const isSelected = selectedKey === seg.key;
            const dimmed = selectedKey !== null && !isSelected;
            const sw = isSelected ? strokeWidth + 5 : strokeWidth;
            return (
              <G
                key={seg.key}
                rotation={seg.rotation}
                origin={`${center}, ${center}`}
              >
                <Circle
                  cx={center} cy={center} r={radius}
                  stroke={seg.color}
                  strokeWidth={sw}
                  strokeDasharray={`${seg.arcLen} ${circumference}`}
                  strokeLinecap="round"
                  fill="none"
                  opacity={dimmed ? 0.2 : 1}
                />
              </G>
            );
          })}
        </Svg>

        {/* Center label */}
        <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
          {selectedSeg ? (
            <>
              <Text style={[styles.centerPct, { color: selectedSeg.color }]}>
                {(selectedSeg.pct * 100).toFixed(0)}%
              </Text>
              <Text style={[styles.centerSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {selectedSeg.label}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.centerPct, { color: colors.text }]}>ALL</Text>
              <Text style={[styles.centerSub, { color: colors.mutedForeground }]}>Assets</Text>
            </>
          )}
        </View>
      </TouchableOpacity>

      {/* Legend */}
      <View style={styles.legend}>
        {computed.map(seg => {
          const isSelected = selectedKey === seg.key;
          const dimmed = selectedKey !== null && !isSelected;
          return (
            <TouchableOpacity
              key={seg.key}
              style={[
                styles.legendRow,
                isSelected && {
                  backgroundColor: seg.color + '18',
                  borderColor: seg.color + '45',
                },
                { borderColor: 'transparent' },
              ]}
              onPress={() => onSelect(isSelected ? null : seg.key)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.legendDot,
                { backgroundColor: seg.color, opacity: dimmed ? 0.25 : 1 },
              ]} />
              <View style={{ opacity: dimmed ? 0.3 : 1, flex: 1 }}>
                <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>
                  {seg.label}
                </Text>
                <Text style={[styles.legendPct, { color: isSelected ? seg.color : colors.text }]}>
                  {(seg.pct * 100).toFixed(1)}%
                </Text>
              </View>
              <Text style={[styles.legendValue, { color: colors.mutedForeground, opacity: dimmed ? 0.3 : 1 }]}>
                {seg.value.toLocaleString('en-EG', { maximumFractionDigits: 0 })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  center: {
    position: 'absolute', top: 0, left: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  centerPct: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  centerSub: { fontSize: 10, fontFamily: 'Inter_500Medium', marginTop: 2 },
  legend: { flex: 1, gap: 4 },
  legendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
  },
  legendDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  legendLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  legendPct: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  legendValue: { fontSize: 10, fontFamily: 'Inter_400Regular' },
});
