import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

function fmtCpt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) {
    // 999,999 rounds to 1000.00 at this precision, which would misleadingly
    // print as "1000.00K" — promote to the M tier instead.
    if (Number((n / 1_000).toFixed(2)) >= 1000) return `${(n / 1_000_000).toFixed(2)}M`;
    return `${(n / 1_000).toFixed(2)}K`;
  }
  return n.toLocaleString('en-EG', { maximumFractionDigits: 0 });
}

export type SegmentIcon =
  | string
  | { lib: 'mci'; name: string };

export interface AllocationSegment {
  label: string;
  value: number;
  color: string;
  // No longer rendered by the chip layout (dot + label + % reads fine
  // without one at this size) — kept optional so existing callers that
  // still pass an icon don't need to change.
  icon?: SegmentIcon;
  quantity?: string;
}

interface Props {
  segments: AllocationSegment[];
  hideValues?: boolean;
  // Optional, opt-in — analytics.tsx (this component's other caller) keeps
  // its exact current layout unless it explicitly passes this too.
  chipWrapStyle?: StyleProp<ViewStyle>;
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
                  borderRightWidth: activeCount > 1 && !isLast ? 1.5 : 0,
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
    borderRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  track:   { height: 7, borderRadius: 4, flexDirection: 'row', overflow: 'hidden' },
  segment: { height: '100%' },
});

// ─── Allocation chip ──────────────────────────────────────────────────────────
// Replaces the old one-full-row-per-asset-type layout: a user holding all 6
// types used to get 6 stacked rows (icon + its own progress bar + qty +
// value, every one of them permanently visible), which could run to ~300px
// on its own. A chip shows only the dot/label/% by default — quantity and
// EGP value move behind a tap on that specific chip instead of always being
// on screen, and chips wrap onto as many lines as they need rather than
// stacking full-width rows. A 2-asset user barely notices the difference; a
// 6-asset user gets a fraction of the height.

function AllocationChip({
  seg, pct, hideValues, expanded, onToggle, index,
}: {
  seg: AllocationSegment; pct: number; hideValues?: boolean; expanded: boolean; onToggle: () => void; index: number;
}) {
  const colors = useColors();
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 320,
      delay: index * 45,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: enterAnim,
        transform: [{ scale: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
      }}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          chip.pill,
          {
            backgroundColor: expanded ? seg.color + '14' : colors.muted + '00',
            borderColor: expanded ? seg.color + '55' : colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={chip.headRow}>
          <View style={[chip.dot, { backgroundColor: seg.color }]} />
          <Text style={[chip.label, { color: colors.text }]} numberOfLines={1}>{seg.label}</Text>
          <Text style={[chip.pct, { color: seg.color }]}>{`${pct.toFixed(0)}%`}</Text>
        </View>
        {expanded && (
          <Text style={[chip.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
            {seg.quantity ? `${seg.quantity} · ` : ''}
            {hideValues ? '•••••' : `${fmtCpt(seg.value)} EGP`}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const chip = StyleSheet.create({
  pill: {
    borderRadius: 100, borderWidth: 1,
    paddingHorizontal: 11, paddingVertical: 7,
  },
  headRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:      { width: 7, height: 7, borderRadius: 3.5 },
  label:    { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  pct:      { fontSize: 12, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.1 },
  detail:   { fontSize: 10.5, fontFamily: 'Inter_400Regular', marginTop: 3, paddingLeft: 13 },
});

// ─── Main component ───────────────────────────────────────────────────────────

export function AllocationBar({ segments, hideValues, chipWrapStyle }: Props) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);

  if (total === 0) return null;

  // Biggest holding leads, so the chip row reads in the same order the
  // overview bar's segments visually take up space, left to right.
  const active = segments.filter(s => s.value > 0).sort((a, b) => b.value - a.value);

  return (
    <View style={styles.container}>
      {/* Pass ALL segments so the fixed-size anims ref stays stable */}
      <OverviewBar segments={segments} total={total} />

      <View style={[styles.chipWrap, chipWrapStyle]}>
        {active.map((seg, i) => (
          <AllocationChip
            key={seg.label}
            seg={seg}
            pct={total > 0 ? (seg.value / total) * 100 : 0}
            hideValues={hideValues}
            expanded={expandedLabel === seg.label}
            onToggle={() => setExpandedLabel(cur => cur === seg.label ? null : seg.label)}
            index={i}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  chipWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
