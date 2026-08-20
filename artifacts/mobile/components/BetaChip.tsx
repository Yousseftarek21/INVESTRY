import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// One color, one shape for every "this is still beta" signal in the app —
// Real Estate, the AI Assistant, and the Global Indices "coming soon" card
// all used their own ad-hoc chip before this (amber, gold, green), which
// read as inconsistent rather than as one deliberate "beta" language.
// Deliberately its own accent (amber), separate from colors.primary or any
// semantic color, so it reads the same in both themes and isn't confused
// with a status color (green/red) or the app's own brand accent.
const AMBER = '#F59E0B';

export function BetaChip({ label }: { label: string }) {
  return (
    <View style={s.chip}>
      <Text style={s.text} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1,
    borderColor: AMBER + '40', backgroundColor: AMBER + '1F', flexShrink: 0,
  },
  text: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: AMBER },
});
