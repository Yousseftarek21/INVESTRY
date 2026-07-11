import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useT } from '@/hooks/useTranslation';

export function LaunchBadge({ accent = '#C9A227', style }: { accent?: string; style?: object }) {
  const t = useT();
  return (
    <View style={[lb.badge, { backgroundColor: accent + '18', borderColor: accent + '40' }, style]}>
      <Feather name="gift" size={13} color={accent} style={{ marginRight: 7 }} />
      <Text style={[lb.text, { color: accent }]}>{t.includedDuringLaunch}</Text>
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
  const t = useT();
  return (
    <View style={bn.wrap}>
      <View style={bn.iconRow}>
        <Text style={bn.emoji}>🎉</Text>
        <Text style={bn.title}>{t.launchOfferTitle}</Text>
      </View>
      <Text style={bn.body}>{t.launchOfferBody}</Text>
    </View>
  );
}

const bn = StyleSheet.create({
  wrap: {
    backgroundColor: '#C9A22712', borderWidth: 1, borderColor: '#C9A22735',
    borderRadius: 18, padding: 16, marginBottom: 16, gap: 6,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emoji: { fontSize: 16 },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#C9A227', letterSpacing: -0.2 },
  body: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#C0CDD8', lineHeight: 19 },
});
