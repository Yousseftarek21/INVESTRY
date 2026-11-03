import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { fmtMoney, useDateFormat } from '@/components/rental/RentalUI';
import { dayNum } from '@/utils/rentalMath';
import type { ComingUpItem } from '@/utils/homeSummary';

/** The next few dated things across the app (see utils/homeSummary.ts comingUp). */
export function ComingUpStrip({ items, today, hideValues }: { items: ComingUpItem[]; today: string; hideValues: boolean }) {
  const colors = useColors();
  const t = useT();
  const fmt = useDateFormat();
  const { impact } = useHaptic();
  if (items.length === 0) return null;

  const money = (amount: number, currency: string) => (hideValues ? '••••' : fmtMoney(amount, currency));
  const whenLabel = (iso: string) => {
    const diff = dayNum(iso) - dayNum(today);
    return diff <= 0 ? t.cuToday : diff === 1 ? t.cuTomorrow : fmt.day(iso);
  };

  const describe = (item: ComingUpItem): { icon: keyof typeof Feather.glyphMap; color: string; title: string; sub: string; open: () => void } => {
    if (item.kind === 'rental') {
      const e = item.event;
      const open = () => router.push({ pathname: '/rental-unit', params: { unitId: item.unitId } } as any);
      if (e.kind === 'checkin') return { icon: 'log-in', color: colors.primary, title: item.unitName, sub: t.cuCheckIn(e.booking.guestName ?? ''), open };
      if (e.kind === 'checkout') return { icon: 'log-out', color: colors.primary, title: item.unitName, sub: t.cuCheckOut, open };
      if (e.kind === 'rent') return { icon: 'key', color: '#F59E0B', title: item.unitName, sub: t.cuRentDue(money(e.month.due - e.month.paid, e.lease.currency)), open };
      return { icon: 'file-text', color: colors.mutedForeground, title: item.unitName, sub: t.cuLeaseEnd, open };
    }
    if (item.kind === 'maturity') {
      return {
        icon: 'award', color: colors.green, title: item.label, sub: t.cuMaturity(money(item.principal, 'EGP')),
        open: () => router.push('/(tabs)/holdings' as any),
      };
    }
    return {
      icon: 'clock', color: '#F59E0B', title: item.name, sub: t.cuPendingIncome(money(item.amount, item.currency)),
      open: () => router.push('/recurring-income' as any),
    };
  };

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[s.heading, { color: colors.mutedForeground }]}>{t.cuTitle}</Text>
      {items.map((item, i) => {
        const d = describe(item);
        const soon = dayNum(item.date) - dayNum(today) <= 1;
        return (
          <TouchableOpacity
            key={`${item.kind}-${i}-${item.date}`}
            style={[s.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            onPress={() => { impact(); d.open(); }}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={[s.icon, { backgroundColor: d.color + '1A' }]}>
              <Feather name={d.icon} size={15} color={d.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{d.title}</Text>
              <Text style={[s.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{d.sub}</Text>
            </View>
            <View style={[s.when, { backgroundColor: soon ? colors.primary + '1F' : colors.muted }]}>
              <Text style={[s.whenText, { color: soon ? colors.primary : colors.mutedForeground }]} numberOfLines={1}>{whenLabel(item.date)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  heading: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  when: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 110 },
  whenText: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold' },
});
