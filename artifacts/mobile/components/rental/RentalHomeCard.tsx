import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useRentalProperties } from '@/context/RentalPropertiesContext';
import { ConceptIcon } from '@/components/ConceptIcon';
import { ICON_RENTAL_INCOME } from '@/constants/conceptIcons';
import { fmtCompact } from '@/utils/formatNumber';
import { forwardChevron } from '@/utils/rtl';
import { convert, monthOf, monthPeriod, todayIso, unitStats } from '@/utils/rentalMath';
import type { MarketPrices } from '@/types';

/**
 * This month's rental profit across every unit, on Home. Shown only once the
 * owner has a unit. Informational: it is never added to net worth — money
 * only reaches net worth when it's deposited into a cash account.
 */
export function RentalHomeCard({ prices, toDisp, displayCurrency, hideValues, variant = 'card' }: {
  prices: MarketPrices | undefined;
  toDisp: (egp: number) => number;
  displayCurrency: string;
  hideValues: boolean;
  /** 'hero': Home's headline, for someone who tracks only rentals. */
  variant?: 'card' | 'hero';
}) {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const { units, bookings, leases, expenses } = useRentalProperties();

  const summary = useMemo(() => {
    const active = units.filter(u => !u.archived);
    if (active.length === 0) return null;
    const today = todayIso();
    const month = monthPeriod(monthOf(today));
    let netEgp = 0;
    let incomeEgp = 0;
    let costsEgp = 0;
    let occupied = 0;
    let available = 0;
    for (const unit of active) {
      const s = unitStats({
        unit,
        bookings: bookings.filter(b => b.unitId === unit.id),
        leases: leases.filter(l => l.unitId === unit.id),
        expenses: expenses.filter(e => e.unitId === unit.id),
      }, month, prices, today);
      netEgp += convert(s.net, unit.currency, 'EGP', prices);
      incomeEgp += convert(s.income, unit.currency, 'EGP', prices);
      costsEgp += convert(s.expenses, unit.currency, 'EGP', prices);
      if (s.occupancy != null) { occupied += s.occupancy; available += 1; }
    }
    return {
      count: active.length,
      netEgp,
      incomeEgp,
      costsEgp,
      occupancy: available > 0 ? `${Math.round((occupied / available) * 100)}%` : '',
    };
  }, [units, bookings, leases, expenses, prices]);

  if (!summary) return null;
  const positive = summary.netEgp >= 0;
  const value = toDisp(summary.netEgp);
  const money = (egp: number) => (hideValues ? '••••' : `${fmtCompact(Math.abs(toDisp(egp)))} ${displayCurrency}`);

  if (variant === 'hero') {
    return (
      <TouchableOpacity
        style={s.hero}
        onPress={() => { impact(); router.push('/rentals' as any); }}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <Text style={[s.heroLabel, { color: colors.mutedForeground }]}>{t.rpHomeCardTitle.toUpperCase()}</Text>
        <Text style={[s.heroValue, { color: positive ? colors.text : colors.red }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {hideValues ? '••••••' : `${value < 0 ? '−' : ''}${Math.round(Math.abs(value)).toLocaleString('en-US')}`}
          <Text style={[s.heroCurrency, { color: colors.primary }]}> {displayCurrency}</Text>
        </Text>
        <View style={s.heroStats}>
          <HeroStat label={t.rpIncome} value={money(summary.incomeEgp)} color={summary.incomeEgp > 0.5 ? colors.green : colors.text} />
          <HeroStat label={t.rpExpenses} value={money(summary.costsEgp)} color={summary.costsEgp > 0.5 ? colors.red : colors.text} />
          <HeroStat label={t.rpOccupancy} value={summary.occupancy || '—'} color={colors.text} />
        </View>
        <Text style={[s.heroSub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {t.rpHomeCardSub(summary.count, '')} · {t.rpViewAll}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => { impact(); router.push('/rentals' as any); }}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <View style={[s.icon, { backgroundColor: '#F59E0B1A' }]}>
        <ConceptIcon icon={ICON_RENTAL_INCOME} size={18} color="#F59E0B" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.title, { color: colors.mutedForeground }]} numberOfLines={1}>{t.rpHomeCardTitle}</Text>
        <Text style={[s.value, { color: positive ? colors.text : colors.red }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {hideValues ? '••••••' : (
            <>
              {value < 0 ? '−' : ''}{fmtCompact(Math.abs(value))}{' '}
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{displayCurrency}</Text>
            </>
          )}
        </Text>
        <Text style={[s.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{t.rpHomeCardSub(summary.count, summary.occupancy)}</Text>
      </View>
      <Feather name={forwardChevron()} size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function HeroStat({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[s.heroStat, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[s.heroStatLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
      <Text style={[s.heroStatValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 4 },
  heroLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.6 },
  heroValue: { fontSize: 44, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  heroCurrency: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  heroStats: { flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginTop: 6 },
  heroStat: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  heroStatLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  heroStatValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  heroSub: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  value: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
