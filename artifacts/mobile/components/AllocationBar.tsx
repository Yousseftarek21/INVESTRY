import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface AllocationBarProps {
  segments: Segment[];
}

export function AllocationBar({ segments }: AllocationBarProps) {
  const colors = useColors();
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  if (total === 0) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.bar, { backgroundColor: colors.muted }]}>
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          if (pct < 0.5) return null;
          return (
            <View
              key={i}
              style={[styles.segment, { width: `${pct}%` as any, backgroundColor: seg.color }]}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          if (pct < 0.5) return null;
          return (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: seg.color }]} />
              <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{seg.label}</Text>
              <Text style={[styles.legendPct, { color: colors.text }]}>{pct.toFixed(0)}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  bar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  legendPct: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
