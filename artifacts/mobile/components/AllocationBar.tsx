import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

function fmtCpt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-EG', { maximumFractionDigits: 0 });
}

export interface AllocationSegment {
  label: string;
  value: number;
  color: string;
  icon: string;
  quantity?: string;
}

interface Props {
  segments: AllocationSegment[];
}

// ─── Animated overview bar ───────────────────────────────────────────────────
// Segments are keyed by label (not index) so adding a new asset class never
// leaves a stale-length array with a missing entry — that used to crash
// Animated.timing with "Cannot read property 'stopTracking' of undefined"
// whenever the number of segments exceeded a hardcoded max.

function OverviewBar({ segments, total }: { segments: AllocationSegment[]; total: number }) {
  const colors = useColors();
  const animsRef = useRef<Record<string, Animated.Value>>({});

  useEffect(() => {
    Animated.stagger(
      60,
      segments.map((seg, i) => {
        if (!animsRef.current[seg.label]) {
          animsRef.current[seg.label] = new Animated.Value(0);
        }
        return Animated.timing(animsRef.current[seg.label], {
          toValue: total > 0 ? (seg.value / total) * 100 : 0,
          duration: 700,
          delay: 100,
          useNativeDriver: false,
        });
      })
    ).start();
  }, [segments.map(s => s.value).join(',')]);

  return (
    <View style={[bar.track, { backgroundColor: colors.muted }]}>
      {segments.map(seg => {
        if (total === 0 || seg.value <= 0) return null;
        if (!animsRef.current[seg.label]) {
          animsRef.current[seg.label] = new Animated.Value(0);
        }
        const width = animsRef.current[seg.label].interpolate({
          inputRange: [0, 100],
          outputRange: ['0%', `${((seg.value / total) * 100).toFixed(4)}%`],
        });
        return (
          <Animated.View
            key={seg.label}
            style={[bar.segment, { backgroundColor: seg.color, width }]}
          />
        );
      })}
    </View>
  );
}

const bar = StyleSheet.create({
  track:   { height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'hidden' },
  segment: { height: '100%' },
});

// ─── Single allocation row ────────────────────────────────────────────────────

function AllocationRow({
  seg, total, trackWidth, delay,
}: {
  seg: AllocationSegment; total: number; trackWidth: number; delay: number;
}) {
  const colors = useColors();
  const pct = total > 0 ? (seg.value / total) * 100 : 0;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    barAnim.setValue(0);
    Animated.timing(barAnim, {
      toValue: trackWidth > 0 ? (pct / 100) * trackWidth : 0,
      duration: 750,
      delay: delay + 120,
      useNativeDriver: false,
    }).start();
  }, [pct, trackWidth]);

  if (pct < 0.05) return null;

  return (
    <View style={row.wrap}>
      {/* Icon */}
      <View style={[row.iconCircle, { backgroundColor: seg.color + '1E' }]}>
        <Feather name={seg.icon as any} size={12} color={seg.color} />
      </View>

      {/* Middle: label + bar */}
      <View style={row.mid}>
        <Text style={[row.label, { color: colors.text }]} numberOfLines={1}>
          {seg.label}
        </Text>
        <View style={[row.trackBg, { backgroundColor: colors.muted }]}>
          <Animated.View style={[row.fill, { backgroundColor: seg.color, width: barAnim }]} />
        </View>
        {seg.quantity ? (
          <Text style={[row.qty, { color: colors.mutedForeground }]}>{seg.quantity}</Text>
        ) : null}
      </View>

      {/* Right: percentage + value */}
      <View style={row.right}>
        <Text style={[row.pct, { color: seg.color }]}>{pct.toFixed(1)}%</Text>
        <Text style={[row.val, { color: colors.mutedForeground }]}>
          {fmtCpt(seg.value)} EGP
        </Text>
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  iconCircle: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  mid:        { flex: 1, gap: 5 },
  label:      { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  trackBg:    { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill:       { height: '100%', borderRadius: 2 },
  qty:        { fontSize: 10, fontFamily: 'Inter_400Regular' },
  right:      { alignItems: 'flex-end', gap: 3, minWidth: 64 },
  pct:        { fontSize: 13, fontFamily: 'Inter_700Bold' },
  val:        { fontSize: 10, fontFamily: 'Inter_400Regular' },
});

// ─── Main component ───────────────────────────────────────────────────────────

export function AllocationBar({ segments }: Props) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const [trackWidth, setTrackWidth] = useState(0);

  if (total === 0) return null;

  const active = segments.filter(s => s.value > 0);

  return (
    <View style={styles.container}>
      {/* Pass ALL segments so the fixed-size anims ref stays stable */}
      <OverviewBar segments={segments} total={total} />

      <View
        style={styles.rows}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setTrackWidth(w - 40); // subtract icon + gap
        }}
      >
        {active.map((seg, i) => (
          <AllocationRow
            key={seg.label}
            seg={seg}
            total={total}
            trackWidth={trackWidth}
            delay={i * 60}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  rows:      { gap: 0 },
});
