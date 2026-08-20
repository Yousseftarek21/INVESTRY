import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

function fmtCpt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-EG', { maximumFractionDigits: 0 });
}

export type SegmentIcon =
  | string
  | { lib: 'mci'; name: string };

export interface AllocationSegment {
  label: string;
  value: number;
  color: string;
  icon: SegmentIcon;
  quantity?: string;
}

function SegIcon({ icon, size, color }: { icon: SegmentIcon; size: number; color: string }) {
  if (typeof icon === 'object' && icon.lib === 'mci') {
    return <MaterialCommunityIcons name={icon.name as any} size={size} color={color} />;
  }
  return <Feather name={icon as any} size={size} color={color} />;
}

interface Props {
  segments: AllocationSegment[];
  hideValues?: boolean;
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

  const activeCount = segments.filter(s => s.value > 0).length;

  return (
    <View style={[bar.wrap, { shadowColor: colors.text }]}>
      <View style={[bar.track, { backgroundColor: colors.muted }]}>
        {segments.map((seg, i) => {
          if (total === 0 || seg.value <= 0) return null;
          if (!animsRef.current[seg.label]) {
            animsRef.current[seg.label] = new Animated.Value(0);
          }
          const width = animsRef.current[seg.label].interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', `${((seg.value / total) * 100).toFixed(4)}%`],
          });
          // A hairline separator (not a margin-based gap) so the Animated
          // percentage widths still sum to exactly 100% of the track —
          // gaps via margin would eat into that and leave a visible sliver
          // of the track background showing through at the end.
          const isLast = i === segments.filter(s => s.value > 0).length - 1
            || segments.slice(i + 1).every(s => s.value <= 0);
          return (
            <Animated.View
              key={seg.label}
              style={[
                bar.segment,
                {
                  backgroundColor: seg.color,
                  width,
                  borderRightWidth: activeCount > 1 && !isLast ? 2 : 0,
                  borderRightColor: colors.background,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const bar = StyleSheet.create({
  wrap: {
    borderRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  track:   { height: 10, borderRadius: 6, flexDirection: 'row', overflow: 'hidden' },
  segment: { height: '100%' },
});

// ─── Single allocation row ────────────────────────────────────────────────────

function AllocationRow({
  seg, total, trackWidth, delay, hideValues,
}: {
  seg: AllocationSegment; total: number; trackWidth: number; delay: number; hideValues?: boolean;
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
      {/* Icon — tinted fill plus a colored ring, reads as a small badge
          rather than a flat circle */}
      <View style={[row.iconCircle, { backgroundColor: seg.color + '17', borderColor: seg.color + '4A' }]}>
        <SegIcon icon={seg.icon} size={13} color={seg.color} />
      </View>

      {/* Middle: label + bar */}
      <View style={row.mid}>
        <View style={row.labelRow}>
          <Text style={[row.label, { color: colors.text }]} numberOfLines={1}>
            {seg.label}
          </Text>
          {seg.quantity ? (
            <Text style={[row.qty, { color: colors.mutedForeground }]}>{seg.quantity}</Text>
          ) : null}
        </View>
        <View style={[row.trackBg, { backgroundColor: colors.muted }]}>
          <Animated.View
            style={[
              row.fill,
              {
                backgroundColor: seg.color,
                width: barAnim,
                shadowColor: seg.color,
              },
            ]}
          />
        </View>
      </View>

      {/* Right: percentage + value */}
      <View style={row.right}>
        <Text style={[row.pct, { color: seg.color }]}>{`${pct.toFixed(1)}%`}</Text>
        <Text style={[row.val, { color: colors.mutedForeground }]}>
          {hideValues ? '•••••' : `${fmtCpt(seg.value)} EGP`}
        </Text>
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  iconCircle: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1.3,
    alignItems: 'center', justifyContent: 'center',
  },
  mid:        { flex: 1, gap: 6 },
  labelRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  label:      { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  trackBg:    { height: 5, borderRadius: 2.5, overflow: 'hidden' },
  fill:       {
    height: '100%', borderRadius: 2.5,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 3,
  },
  qty:        { fontSize: 10, fontFamily: 'Inter_400Regular' },
  right:      { alignItems: 'flex-end', gap: 3, minWidth: 66 },
  pct:        { fontSize: 13.5, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.2 },
  val:        { fontSize: 10, fontFamily: 'Inter_400Regular' },
});

// ─── Main component ───────────────────────────────────────────────────────────

export function AllocationBar({ segments, hideValues }: Props) {
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
            hideValues={hideValues}
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
