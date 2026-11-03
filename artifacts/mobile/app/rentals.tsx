import React, { useMemo } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useMarketPrices } from '@/hooks/usePrices';
import { useSubscription } from '@/context/SubscriptionContext';
import { useRentalProperties } from '@/context/RentalPropertiesContext';
import { LockedFeatureCard } from '@/components/LockedFeatureCard';
import { ConceptIcon } from '@/components/ConceptIcon';
import { ICON_RENTAL_INCOME } from '@/constants/conceptIcons';
import { forwardChevron } from '@/utils/rtl';
import { convert, monthOf, monthPeriod, outstanding, todayIso, unitStats, upcomingEvents, type NextEvent, type UnitData } from '@/utils/rentalMath';
import { ScreenHeader, fmtMoney, modeLabel, rs, useDateFormat } from '@/components/rental/RentalUI';

export default function RentalsScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const fmt = useDateFormat();
  const { units, bookings, leases, expenses, isLoading, reload } = useRentalProperties();
  const { data: prices } = useMarketPrices();
  const { featuresUnlocked, isLoading: subLoading, showPaywallFromModal } = useSubscription();
  const today = todayIso();
  const month = monthPeriod(monthOf(today));

  const rows = useMemo(() => units
    .filter(u => !u.archived)
    .map(unit => {
      const d: UnitData = {
        unit,
        bookings: bookings.filter(b => b.unitId === unit.id),
        leases: leases.filter(l => l.unitId === unit.id),
        expenses: expenses.filter(e => e.unitId === unit.id),
      };
      return {
        d,
        stats: unitStats(d, month, prices, today),
        owed: outstanding(d, prices, today),
        next: upcomingEvents(d, today)[0] as NextEvent | undefined,
      };
    }), [units, bookings, leases, expenses, prices, today, month]);

  // All-units totals in EGP; each unit is computed in its own currency first.
  const totals = useMemo(() => rows.reduce((acc, r) => {
    const c = r.d.unit.currency;
    acc.income += convert(r.stats.income, c, 'EGP', prices);
    acc.expenses += convert(r.stats.expenses, c, 'EGP', prices);
    acc.owed += convert(r.owed.total, c, 'EGP', prices);
    return acc;
  }, { income: 0, expenses: 0, owed: 0 }), [rows, prices]);

  const addUnit = () => {
    impact();
    if (!subLoading && !featuresUnlocked) { showPaywallFromModal(); return; }
    router.push('/rental-unit-form' as any);
  };

  const nextLine = (e: NextEvent | undefined) => {
    if (!e) return '';
    if (e.kind === 'checkin') return t.rpNextCheckIn(fmt.day(e.date), e.booking.guestName ?? '');
    if (e.kind === 'checkout') return t.rpNextCheckOut(fmt.day(e.date));
    if (e.kind === 'rent') return t.rpNextRent(fmt.day(e.date), fmtMoney(e.month.due, e.lease.currency));
    return t.rpNextLeaseEnd(fmt.day(e.date));
  };

  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  const locked = !subLoading && !featuresUnlocked && units.length === 0;
  const net = totals.income - totals.expenses;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[rs.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader
          title={t.rpTitle}
          right={!locked ? (
            <TouchableOpacity onPress={addUnit} hitSlop={10} accessibilityLabel={t.rpAddUnit}>
              <Feather name="plus" size={22} color={colors.primary} />
            </TouchableOpacity>
          ) : undefined}
        />
        {locked ? (
          <View style={{ flex: 1, padding: 24 }}>
            <LockedFeatureCard feature={t.rpTitle} description={t.rpLockedDesc} fullScreen fromModalScreen />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[rs.content, { paddingBottom: botPad + 32 }]}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={colors.primary} />}
          >
            {rows.length === 0 ? (
              <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                  <ConceptIcon icon={ICON_RENTAL_INCOME} size={30} color={colors.primary} />
                </View>
                <Text style={[s.emptyTitle, { color: colors.text }]}>{t.rpEmptyTitle}</Text>
                <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.rpEmptyHint}</Text>
                <TouchableOpacity style={[s.emptyBtn, { backgroundColor: colors.primary }]} onPress={addUnit} activeOpacity={0.85}>
                  <Feather name="plus" size={16} color={colors.primaryForeground} />
                  <Text style={[s.emptyBtnText, { color: colors.primaryForeground }]}>{t.rpAddUnit}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[rs.card, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rpThisMonthAll}</Text>
                  <Text style={[s.big, { color: net >= 0 ? colors.text : colors.red }]}>{fmtMoney(net, 'EGP')}</Text>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rpNetProfit}</Text>
                  <View style={s.statsRow}>
                    <Stat label={t.rpIncome} value={fmtMoney(totals.income, 'EGP')} color={colors.green} />
                    <Stat label={t.rpExpenses} value={fmtMoney(totals.expenses, 'EGP')} color={colors.red} />
                    {totals.owed > 0.5 && <Stat label={t.rpOwed} value={fmtMoney(totals.owed, 'EGP')} color={colors.red} />}
                  </View>
                </View>

                {rows.map(({ d, stats, owed, next }) => {
                  const occ = stats.occupancy ?? 0;
                  return (
                    <TouchableOpacity
                      key={d.unit.id}
                      style={[rs.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                      activeOpacity={0.8}
                      onPress={() => { impact(); router.push({ pathname: '/rental-unit', params: { unitId: d.unit.id } } as any); }}
                      accessibilityRole="button"
                    >
                      <View style={rs.rowBetween}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[s.unitName, { color: colors.text }]} numberOfLines={1}>{d.unit.name}</Text>
                          <Text style={[rs.hint, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {[modeLabel(d.unit.mode, t), d.unit.location].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <Feather name={forwardChevron()} size={18} color={colors.mutedForeground} />
                      </View>
                      <View style={rs.rowBetween}>
                        <View>
                          <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rpPeriodMonth}</Text>
                          <Text style={[s.unitNet, { color: stats.net >= 0 ? colors.green : colors.red }]}>{fmtMoney(stats.net, d.unit.currency)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rpOccupancy}</Text>
                          <Text style={[s.unitNet, { color: colors.text }]}>{Math.round(occ * 100)}%</Text>
                        </View>
                      </View>
                      <View style={[s.bar, { backgroundColor: colors.muted }]}>
                        <View style={[s.barFill, { width: `${Math.min(100, Math.round(occ * 100))}%`, backgroundColor: colors.primary }]} />
                      </View>
                      {(next || owed.total > 0.5) && (
                        <View style={rs.rowBetween}>
                          <Text style={[rs.hint, { color: colors.mutedForeground, flex: 1 }]} numberOfLines={1}>{nextLine(next)}</Text>
                          {owed.total > 0.5 && (
                            <View style={[s.badge, { backgroundColor: colors.red + '1F' }]}>
                              <Text style={[s.badgeText, { color: colors.red }]}>{t.rpOverdueBadge(fmtMoney(owed.total, d.unit.currency))}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[s.label, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
      <Text style={[s.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center', gap: 10, marginTop: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptyHint: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, marginTop: 6 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  big: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  statValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  unitName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  unitNet: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
