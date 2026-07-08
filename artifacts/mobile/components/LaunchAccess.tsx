/**
 * Launch Access UI — shared, purely presentational pieces used wherever the
 * app would normally show a "Subscribe" / "Upgrade" button or a plan-status
 * badge. Every place that needs to know whether real purchases are disabled
 * must read `launchAccess` from `useSubscription()` (the single centralized
 * subscription service) and swap to these components — never re-derive the
 * flag locally.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

export function LaunchBadge({ accent = '#1ABBA9', style }: { accent?: string; style?: object }) {
  return (
    <View style={[lb.badge, { backgroundColor: accent + '18', borderColor: accent + '40' }, style]}>
      <Feather name="gift" size={13} color={accent} style={{ marginRight: 7 }} />
      <Text style={[lb.text, { color: accent }]}>Included During Launch</Text>
    </View>
  );
}

const lb = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 18,
  },
  text: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
});

export function LaunchBanner() {
  return (
    <View style={bn.wrap}>
      <View style={bn.iconRow}>
        <Text style={bn.emoji}>🎉</Text>
        <Text style={bn.title}>Launch Offer</Text>
      </View>
      <Text style={bn.body}>
        To celebrate our launch, all users receive complimentary access to Pro features
        for a limited time. Thank you for helping us build the future of investment tracking.
      </Text>
    </View>
  );
}

const bn = StyleSheet.create({
  wrap: {
    backgroundColor: '#1ABBA912', borderWidth: 1, borderColor: '#1ABBA935',
    borderRadius: 18, padding: 16, marginBottom: 16, gap: 6,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emoji: { fontSize: 16 },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#1ABBA9', letterSpacing: -0.2 },
  body: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#C0CDD8', lineHeight: 19 },
});
