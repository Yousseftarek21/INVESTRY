import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

// ─── 52-Week Range Bar ────────────────────────────────────────────────────────
// Shared between EGXMarket and GlobalStocksMarket stock cards.

export function RangeBar({ price, low, high }: { price: number; low: number; high: number }) {
  const colors = useColors();
  const range = high - low;
  const pct = range > 0 ? Math.max(0, Math.min(1, (price - low) / range)) : 0.5;
  return (
    <View style={rb.wrap}>
      <Text style={[rb.label, { color: colors.mutedForeground }]}>
        {low.toFixed(0)}
      </Text>
      <View style={[rb.track, { backgroundColor: colors.border }]}>
        <View style={[rb.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: colors.primary + '60' }]} />
        <View style={[rb.thumb, { left: `${Math.round(pct * 100)}%`, backgroundColor: colors.primary }]} />
      </View>
      <Text style={[rb.label, { color: colors.mutedForeground }]}>
        {high.toFixed(0)}
      </Text>
    </View>
  );
}
const rb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  label: { fontSize: 9, fontFamily: 'Inter_400Regular', width: 28 },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'visible', position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, height: 4, borderRadius: 2 },
  thumb: { position: 'absolute', top: -3, width: 10, height: 10, borderRadius: 5, marginLeft: -5 },
});
