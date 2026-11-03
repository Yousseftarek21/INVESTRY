import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { ConceptIcon } from '@/components/ConceptIcon';
import { ICON_INVESTMENTS, ICON_RENTAL_INCOME } from '@/constants/conceptIcons';
import { BanknoteIcon } from '@/components/BanknoteIcon';

/**
 * Shown in place of an all-zero Home for someone who hasn't added anything
 * yet. Each choice goes straight to adding the first item; it disappears by
 * itself once anything exists, or for good when skipped.
 */
export function TrackChooser({ onSkip }: { onSkip: () => void }) {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();

  const options = [
    {
      key: 'investments',
      title: t.trackInvestments,
      desc: t.trackInvestmentsDesc,
      color: colors.primary,
      icon: <ConceptIcon icon={ICON_INVESTMENTS} size={20} color={colors.primary} />,
      go: () => router.push('/add-investment?mode=investment' as any),
    },
    {
      key: 'cash',
      title: t.trackCash,
      desc: t.trackCashDesc,
      color: colors.green,
      icon: <BanknoteIcon size={20} color={colors.green} />,
      go: () => router.push('/cash-accounts?openAdd=1' as any),
    },
    {
      key: 'rentals',
      title: t.trackRentals,
      desc: t.trackRentalsDesc,
      color: '#F59E0B',
      icon: <ConceptIcon icon={ICON_RENTAL_INCOME} size={20} color="#F59E0B" />,
      go: () => router.push('/rentals' as any),
    },
  ];

  return (
    <View style={s.wrap}>
      <Text style={[s.title, { color: colors.text }]}>{t.trackTitle}</Text>
      <Text style={[s.sub, { color: colors.mutedForeground }]}>{t.trackSub}</Text>
      <View style={s.list}>
        {options.map(o => (
          <TouchableOpacity
            key={o.key}
            style={[s.option, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => { impact(); o.go(); }}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <View style={[s.icon, { backgroundColor: o.color + '1A' }]}>{o.icon}</View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.optTitle, { color: colors.text }]}>{o.title}</Text>
              <Text style={[s.optDesc, { color: colors.mutedForeground }]}>{o.desc}</Text>
            </View>
            <Feather name="plus" size={18} color={o.color} />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={() => { impact(); onSkip(); }} hitSlop={10} style={s.skip} accessibilityRole="button">
        <Text style={[s.skipText, { color: colors.mutedForeground }]}>{t.trackSkip}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6, paddingTop: 8 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  sub: { fontSize: 13.5, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19, marginBottom: 10 },
  list: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, padding: 14 },
  icon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 15.5, fontFamily: 'Inter_600SemiBold' },
  optDesc: { fontSize: 12.5, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 17 },
  skip: { alignSelf: 'center', paddingVertical: 10, marginTop: 4 },
  skipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
