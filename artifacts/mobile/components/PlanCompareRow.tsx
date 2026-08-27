import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  label: string;
  freeValue: string;
  proValue: string;
  /** Locked/unlocked rows read better as an icon than as repeated text
      ("Locked"/"Full access" on every row gets noisy) — numeric rows
      ("1 holding"/"Unlimited") stay as plain text either side. */
  locked?: boolean;
}

// One row of the Free|Pro comparison table — label left, then two value
// columns. flexDirection: 'row' auto-mirrors under RTL (no left/right style
// keys used here), so the Free/Pro column order visually swaps correctly
// in Arabic instead of just flipping text alignment.
export function PlanCompareRow({ label, freeValue, proValue, locked }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={2}>{label}</Text>
      <View style={styles.valueCol}>
        {locked ? (
          <Feather name="lock" size={13} color={colors.mutedForeground} />
        ) : (
          <Text style={[styles.value, { color: colors.mutedForeground }]} numberOfLines={1}>{freeValue}</Text>
        )}
      </View>
      <View style={styles.valueCol}>
        {locked ? (
          <Feather name="check-circle" size={14} color={colors.primary} />
        ) : (
          <Text style={[styles.value, styles.proValue, { color: colors.primary }]} numberOfLines={1}>{proValue}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flex: 1.6, fontSize: 12.5, fontFamily: 'Inter_500Medium', lineHeight: 17 },
  valueCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  proValue: { fontFamily: 'Inter_700Bold' },
});
