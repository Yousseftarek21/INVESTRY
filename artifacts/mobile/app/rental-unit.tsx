import React, { useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useMarketPrices } from '@/hooks/usePrices';
import { useHoldings } from '@/context/HoldingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useRentalProperties, useUnitData } from '@/context/RentalPropertiesContext';
import { getRECurrentValue } from '@/utils/rePrice';
import {
  addMonths, bookingNights, bookingPayout, convert, dayNum, monthOf, monthPeriod, monthlySeries, outstanding,
  rentSchedule, todayIso, unitStart, unitStats, upcomingEvents, yearPeriod, type Period, type RentMonth,
} from '@/utils/rentalMath';
import type { RealEstateHolding } from '@/types';
import { RentalCalendar, MonthlyProfitBars } from '@/components/rental/RentalCharts';
import {
  CATEGORY_ICONS, DeleteButton, ScreenHeader, categoryLabel, fmtMoney, modeLabel, platformLabel, rs, useDateFormat,
} from '@/components/rental/RentalUI';

type PeriodKey = 'month' | 'year' | 'all';

export default function RentalUnitScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const fmt = useDateFormat();
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const data = useUnitData(unitId);
  const { remove, reload, isLoading } = useRentalProperties();
  const { holdings } = useHoldings();
  const { data: prices } = useMarketPrices();
  const { featuresUnlocked, isLoading: subLoading, showPaywallFromModal } = useSubscription();

  const today = todayIso();
  const thisMonth = monthOf(today);
  const [periodKey, setPeriodKey] = useState<PeriodKey>('month');
  const [calMonth, setCalMonth] = useState(thisMonth);

  const period: Period | null = useMemo(() => {
    if (!data) return null;
    if (periodKey === 'month') return monthPeriod(thisMonth);
    if (periodKey === 'year') return yearPeriod(Number(today.slice(0, 4)));
    return { start: dayNum(unitStart(data)), end: monthPeriod(thisMonth).end };
  }, [data, periodKey, thisMonth, today]);

  const stats = useMemo(() => (data && period ? unitStats(data, period, prices, today) : null), [data, period, prices, today]);
  const owed = useMemo(() => (data ? outstanding(data, prices, today) : null), [data, prices, today]);
  const events = useMemo(() => (data ? upcomingEvents(data, today).slice(0, 5) : []), [data, today]);
  const series = useMemo(() => (data ? monthlySeries(data, thisMonth, 12, prices, today) : []), [data, thisMonth, prices, today]);

  const linked = data?.unit.holdingId
    ? holdings.find((h): h is RealEstateHolding => h.id === data.unit.holdingId && h.type === 'real_estate')
    : undefined;
  const yieldPct = useMemo(() => {
    if (!data || !linked) return null;
    const value = convert(getRECurrentValue(linked), 'EGP', data.unit.currency, prices);
    if (!(value > 0)) return null;
    const net12 = series.reduce((s, p) => s + p.net, 0);
    return (net12 / value) * 100;
  }, [data, linked, series, prices]);

  const mixedCurrency = !!data && [...data.bookings, ...data.leases, ...data.expenses].some(x => x.currency !== data.unit.currency);

  // Adding needs Pro; viewing what's already there never does.
  const gateAdd = (go: () => void) => {
    impact();
    if (!subLoading && !featuresUnlocked) { showPaywallFromModal(); return; }
    go();
  };

  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  if (!data || !stats || !period) {
    return (
      <View style={[rs.screen, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title={t.rpTitle} />
      </View>
    );
  }

  const { unit } = data;
  const cur = unit.currency;
  const showStays = unit.mode !== 'long_term' || data.bookings.length > 0;
  const showLease = unit.mode !== 'short_stay' || data.leases.length > 0;
  const card = [rs.card, { backgroundColor: colors.card, borderColor: colors.border }];
  const sortedBookings = [...data.bookings].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const sortedExpenses = [...data.expenses].sort((a, b) => b.date.localeCompare(a.date));
  const leases = [...data.leases].sort((a, b) => b.startDate.localeCompare(a.startDate));

  const openBooking = (id?: string) => router.push({ pathname: '/rental-booking-form', params: { unitId: unit.id, ...(id ? { bookingId: id } : {}) } } as any);
  const openLease = (id?: string) => router.push({ pathname: '/rental-lease-form', params: { unitId: unit.id, ...(id ? { leaseId: id } : {}) } } as any);
  const openExpense = (id?: string) => router.push({ pathname: '/rental-expense-form', params: { unitId: unit.id, ...(id ? { expenseId: id } : {}) } } as any);
  const openPayment = (leaseId: string, month: string) => router.push({ pathname: '/rental-payment-form', params: { leaseId, month } } as any);

  const statusColor = (m: RentMonth) =>
    m.status === 'paid' ? colors.green : m.status === 'overdue' ? colors.red : m.status === 'partial' ? colors.primary : colors.mutedForeground;
  const statusLabel = (m: RentMonth) => ({
    paid: t.rpStatusPaid, partial: t.rpStatusPartial, waived: t.rpStatusWaived, overdue: t.rpStatusOverdue, due: t.rpStatusDue,
  })[m.status];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[rs.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader
          title={unit.name}
          right={
            <TouchableOpacity onPress={() => router.push({ pathname: '/rental-unit-form', params: { unitId: unit.id } } as any)} hitSlop={10} accessibilityLabel={t.rpEditUnit}>
              <Feather name="edit-2" size={19} color={colors.primary} />
            </TouchableOpacity>
          }
        />
        <ScrollView
          contentContainerStyle={[rs.content, { paddingBottom: botPad + 40 }]}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={colors.primary} />}
        >
          <View style={{ gap: 4 }}>
            <Text style={[s.sub, { color: colors.mutedForeground }]} numberOfLines={2}>
              {[modeLabel(unit.mode, t), unit.location, linked?.propertyName].filter(Boolean).join(' · ')}
            </Text>
          </View>

          {/* Quick actions */}
          <View style={s.actions}>
            {unit.mode !== 'long_term' && <ActionPill icon="calendar" label={t.rpAddStay} onPress={() => gateAdd(() => openBooking())} />}
            {unit.mode !== 'short_stay' && <ActionPill icon="user-plus" label={t.rpAddTenant} onPress={() => gateAdd(() => openLease())} />}
            <ActionPill icon="minus-circle" label={t.rpAddCost} onPress={() => gateAdd(() => openExpense())} />
          </View>

          {/* Period + KPIs */}
          <View style={[s.segment, { backgroundColor: colors.muted }]}>
            {(['month', 'year', 'all'] as PeriodKey[]).map(k => (
              <TouchableOpacity
                key={k}
                style={[s.segmentItem, periodKey === k && { backgroundColor: colors.card }]}
                onPress={() => { impact(); setPeriodKey(k); }}
                accessibilityRole="tab"
                accessibilityState={{ selected: periodKey === k }}
              >
                <Text style={[s.segmentText, { color: periodKey === k ? colors.text : colors.mutedForeground }]}>
                  {k === 'month' ? t.rpPeriodMonth : k === 'year' ? t.rpPeriodYear : t.rpPeriodAll}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={card}>
            <Text style={[s.kpiLabel, { color: colors.mutedForeground }]}>{t.rpNetProfit}</Text>
            <Text style={[s.kpiBig, { color: stats.net >= 0 ? colors.text : colors.red }]}>{fmtMoney(stats.net, cur)}</Text>
            <View style={s.kpiGrid}>
              <Kpi label={t.rpIncome} value={fmtMoney(stats.income, cur)} color={colors.green} />
              <Kpi label={t.rpExpenses} value={fmtMoney(stats.expenses, cur)} color={colors.red} />
              <Kpi label={t.rpOccupancy} value={stats.occupancy == null ? '—' : `${Math.round(stats.occupancy * 100)}%`} />
              {stats.avgNightly != null && <Kpi label={t.rpAvgNightly} value={fmtMoney(stats.avgNightly, cur)} />}
              {yieldPct != null && <Kpi label={t.rpYield} value={`${yieldPct.toFixed(1)}%`} />}
              {stats.bookingCount > 0 && <Kpi label={t.rpStays} value={t.rpStaysCount(stats.bookingCount)} />}
            </View>
            {mixedCurrency && <Text style={[rs.hint, { color: colors.mutedForeground }]}>{t.rpMultiCurrencyNote(cur)}</Text>}
          </View>

          {/* Owed */}
          {owed && owed.total > 0.5 && (
            <View style={[card, { borderColor: colors.red + '40' }]}>
              <View style={rs.rowBetween}>
                <Text style={[rs.sectionTitle, { color: colors.red }]}>{t.rpOwed}</Text>
                <Text style={[s.rowAmount, { color: colors.red }]}>{fmtMoney(owed.total, cur)}</Text>
              </View>
              {owed.unpaidBookings.map(b => (
                <Row key={b.id} onPress={() => openBooking(b.id)}
                  title={b.guestName || platformLabel(b.platform, t, b.platformOther)}
                  sub={`${fmt.day(b.checkIn)} – ${fmt.day(b.checkOut)} · ${t.rpPayoutNotReceived}`}
                  amount={fmtMoney(convert(bookingPayout(b), b.currency, cur, prices), cur)} />
              ))}
              {owed.overdueRent.map(({ lease, month }) => (
                <Row key={`${lease.id}-${month.month}`} onPress={() => openPayment(lease.id, month.month)}
                  title={t.rpRentOverdueFor(fmt.month(month.month))}
                  sub={`${lease.tenantName} · ${statusLabel(month)}`}
                  amount={fmtMoney(month.due - month.paid, lease.currency)} />
              ))}
            </View>
          )}

          {/* Coming up */}
          <View style={card}>
            <Text style={[rs.sectionTitle, { color: colors.mutedForeground }]}>{t.rpComingUp}</Text>
            {events.length === 0 ? (
              <Text style={[rs.hint, { color: colors.mutedForeground }]}>{t.rpNothingComingUp}</Text>
            ) : events.map((e, i) => {
              if (e.kind === 'checkin') return <Row key={i} icon="log-in" title={t.rpNextCheckIn(fmt.day(e.date), e.booking.guestName ?? '')} sub={`${t.rpNights(bookingNights(e.booking))} · ${platformLabel(e.booking.platform, t, e.booking.platformOther)}`} onPress={() => openBooking(e.booking.id)} />;
              if (e.kind === 'checkout') return <Row key={i} icon="log-out" title={t.rpNextCheckOut(fmt.day(e.date))} sub={e.booking.guestName ?? ''} onPress={() => openBooking(e.booking.id)} />;
              if (e.kind === 'rent') return <Row key={i} icon="dollar-sign" title={t.rpNextRent(fmt.day(e.date), fmtMoney(e.month.due, e.lease.currency))} sub={e.lease.tenantName} onPress={() => openPayment(e.lease.id, e.month.month)} />;
              return <Row key={i} icon="file-text" title={t.rpNextLeaseEnd(fmt.full(e.date))} sub={e.lease.tenantName} onPress={() => openLease(e.lease.id)} />;
            })}
          </View>

          {showStays && (
            <View style={card}>
              <Text style={[rs.sectionTitle, { color: colors.mutedForeground }]}>{t.rpCalendar}</Text>
              <RentalCalendar
                data={data}
                ym={calMonth}
                onPrev={() => setCalMonth(addMonths(calMonth, -1))}
                onNext={() => setCalMonth(addMonths(calMonth, 1))}
                onBookingPress={openBooking}
              />
            </View>
          )}

          {showLease && (
            <View style={card}>
              <View style={rs.rowBetween}>
                <Text style={[rs.sectionTitle, { color: colors.mutedForeground }]}>{t.rpTenant}</Text>
                <TouchableOpacity onPress={() => gateAdd(() => openLease())} hitSlop={8} accessibilityLabel={t.rpAddTenant}>
                  <Feather name="plus" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {leases.length === 0 && <Text style={[rs.hint, { color: colors.mutedForeground }]}>{t.rpNoTenant}</Text>}
              {leases.map(l => {
                const months = rentSchedule(l, addMonths(thisMonth, 1), today);
                const recent = months.slice(-7).reverse();
                return (
                  <View key={l.id} style={{ gap: 8 }}>
                    <TouchableOpacity onPress={() => openLease(l.id)} style={rs.rowBetween} accessibilityRole="button">
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[s.rowTitle, { color: colors.text }]}>{l.tenantName}</Text>
                        <Text style={[rs.hint, { color: colors.mutedForeground }]}>
                          {t.rpPerMonth(fmtMoney(l.monthlyRent, l.currency))} · {t.rpDueOnDay(l.dueDay)}
                        </Text>
                        <Text style={[rs.hint, { color: colors.mutedForeground }]}>
                          {t.rpContractRange(fmt.full(l.startDate), l.endDate ? fmt.full(l.endDate) : t.rpOpenEnded)}
                          {l.securityDeposit ? ` · ${t.rpDepositLabel}: ${fmtMoney(l.securityDeposit, l.currency)}` : ''}
                        </Text>
                      </View>
                      <Feather name="edit-2" size={15} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    {recent.map(m => (
                      <TouchableOpacity key={m.month} onPress={() => openPayment(l.id, m.month)} style={[s.rentRow, { borderColor: colors.border }]} accessibilityRole="button">
                        <Text style={[s.rowTitle, { color: colors.text, flex: 1 }]}>{fmt.month(m.month)}</Text>
                        <Text style={[rs.hint, { color: colors.mutedForeground }]}>{fmtMoney(m.due, l.currency)}</Text>
                        <View style={[s.badge, { backgroundColor: statusColor(m) + '1F' }]}>
                          <Text style={[s.badgeText, { color: statusColor(m) }]}>{statusLabel(m)}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </View>
          )}

          {showStays && (
            <View style={card}>
              <View style={rs.rowBetween}>
                <Text style={[rs.sectionTitle, { color: colors.mutedForeground }]}>{t.rpStays}</Text>
                <TouchableOpacity onPress={() => gateAdd(() => openBooking())} hitSlop={8} accessibilityLabel={t.rpAddStay}>
                  <Feather name="plus" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {sortedBookings.length === 0 && <Text style={[rs.hint, { color: colors.mutedForeground }]}>{t.rpNoStays}</Text>}
              {sortedBookings.map(b => {
                const badge = b.status === 'cancelled' ? { text: t.rpCancelled, color: colors.mutedForeground }
                  : b.checkIn > today ? { text: t.rpUpcoming, color: colors.primary }
                  : !b.received ? { text: t.rpNotReceived, color: colors.red } : null;
                return (
                  <Row key={b.id} onPress={() => openBooking(b.id)}
                    title={b.guestName || platformLabel(b.platform, t, b.platformOther)}
                    sub={`${fmt.day(b.checkIn)} – ${fmt.day(b.checkOut)} · ${t.rpNights(bookingNights(b))} · ${platformLabel(b.platform, t, b.platformOther)}`}
                    amount={fmtMoney(bookingPayout(b), b.currency)}
                    amountColor={b.status === 'cancelled' ? colors.mutedForeground : colors.green}
                    badge={badge ?? undefined} />
                );
              })}
            </View>
          )}

          <View style={card}>
            <View style={rs.rowBetween}>
              <Text style={[rs.sectionTitle, { color: colors.mutedForeground }]}>{t.rpCosts}</Text>
              <TouchableOpacity onPress={() => gateAdd(() => openExpense())} hitSlop={8} accessibilityLabel={t.rpAddCost}>
                <Feather name="plus" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {sortedExpenses.length === 0 && <Text style={[rs.hint, { color: colors.mutedForeground }]}>{t.rpNoCosts}</Text>}
            {sortedExpenses.map(e => (
              <Row key={e.id} onPress={() => openExpense(e.id)} icon={CATEGORY_ICONS[e.category]}
                title={categoryLabel(e.category, t)}
                sub={`${fmt.full(e.date)}${e.note ? ` · ${e.note}` : ''}`}
                amount={`−${fmtMoney(e.amount, e.currency)}`}
                amountColor={colors.red}
                badge={e.monthly ? { text: t.rpMonthly, color: colors.mutedForeground } : undefined} />
            ))}
          </View>

          <View style={card}>
            <Text style={[rs.sectionTitle, { color: colors.mutedForeground }]}>{t.rpLast12Months}</Text>
            <MonthlyProfitBars points={series} currency={cur} />
          </View>

          <DeleteButton onDelete={() => remove('units', unit.id)} message={t.rpDeleteUnitConfirm(unit.name)} />
        </ScrollView>
      </View>
    </>
  );
}

function ActionPill({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity onPress={onPress} style={[s.pill, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '40' }]} activeOpacity={0.8} accessibilityRole="button">
      <Feather name={icon} size={15} color={colors.primary} />
      <Text style={[s.pillText, { color: colors.primary }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors = useColors();
  return (
    <View style={s.kpi}>
      <Text style={[s.kpiLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
      <Text style={[s.kpiValue, { color: color ?? colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function Row({ title, sub, amount, amountColor, badge, icon, onPress }: {
  title: string; sub?: string; amount?: string; amountColor?: string;
  badge?: { text: string; color: string }; icon?: keyof typeof Feather.glyphMap; onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} style={s.row} activeOpacity={0.7} accessibilityRole={onPress ? 'button' : undefined}>
      {icon && (
        <View style={[s.rowIcon, { backgroundColor: colors.muted }]}>
          <Feather name={icon} size={15} color={colors.mutedForeground} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.rowTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={[rs.hint, { color: colors.mutedForeground }]} numberOfLines={2}>{sub}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {amount ? <Text style={[s.rowAmount, { color: amountColor ?? colors.text }]}>{amount}</Text> : null}
        {badge ? (
          <View style={[s.badge, { backgroundColor: badge.color + '1F' }]}>
            <Text style={[s.badgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  pillText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segmentItem: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  segmentText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  kpiBig: { fontSize: 28, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  kpi: { width: '50%', gap: 2, paddingEnd: 8 },
  kpiLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  kpiValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowAmount: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  rentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
