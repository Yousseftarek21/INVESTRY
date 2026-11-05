import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useMarketPrices } from '@/hooks/usePrices';
import { useLoans } from '@/context/LoansContext';
import { useHoldings } from '@/context/HoldingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { FREE_LOAN_LIMIT } from '@/constants/subscriptionFeatures';
import { forwardChevron } from '@/utils/rtl';
import { todayIso } from '@/utils/rentalMath';
import { loanPaidShare, loanRemaining, loanStatus, monthlyLoanPaymentsEGP, totalLoansEGP } from '@/utils/loanMath';
import { ScreenHeader, fmtMoney, rs, useDateFormat } from '@/components/rental/RentalUI';
import { LOAN_ICONS, loanKindLabel } from '@/components/loans/LoanUI';

export default function LoansScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const fmt = useDateFormat();
  const { loans } = useLoans();
  const { holdings } = useHoldings();
  const { data: prices } = useMarketPrices();
  const { featuresUnlocked, isLoading: subLoading, showPaywallFromModal } = useSubscription();
  const today = todayIso();

  const totalOwed = useMemo(() => totalLoansEGP(loans, prices), [loans, prices]);
  const monthly = useMemo(() => monthlyLoanPaymentsEGP(loans, prices), [loans, prices]);

  // Properties with an installment plan that aren't tracked as a loan yet.
  const suggestions = useMemo(() => holdings.filter(h =>
    h.type === 'real_estate' && h.hasInstallmentPlan && !loans.some(l => l.holdingId === h.id),
  ), [holdings, loans]);

  const atLimit = !subLoading && !featuresUnlocked && loans.length >= FREE_LOAN_LIMIT;
  const add = (holdingId?: string) => {
    impact();
    if (atLimit) { showPaywallFromModal(); return; }
    router.push({ pathname: '/loan-form', params: holdingId ? { holdingId } : {} } as any);
  };

  const sorted = [...loans].sort((a, b) => loanRemaining(b) - loanRemaining(a));
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[rs.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader
          title={t.loansTitle}
          right={
            <TouchableOpacity onPress={() => add()} hitSlop={10} accessibilityLabel={t.loansAdd}>
              <Feather name="plus" size={22} color={colors.primary} />
            </TouchableOpacity>
          }
        />
        <ScrollView contentContainerStyle={[rs.content, { paddingBottom: botPad + 32 }]}>
          {loans.length > 0 && (
            <View style={[rs.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sumRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.loansTotalOwed}</Text>
                  <Text style={[s.big, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{fmtMoney(totalOwed, 'EGP')}</Text>
                </View>
                {monthly > 0 && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.label, { color: colors.mutedForeground }]}>{t.loansMonthly}</Text>
                    <Text style={[s.mid, { color: colors.text }]}>{fmtMoney(monthly, 'EGP')}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {suggestions.map(h => h.type === 'real_estate' && (
            <TouchableOpacity
              key={h.id}
              style={[rs.card, s.suggest, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '0D' }]}
              onPress={() => add(h.id)}
              activeOpacity={0.8}
            >
              <View style={[s.icon, { backgroundColor: colors.primary + '1F' }]}>
                <Feather name="calendar" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{t.loanTrackInstallments(h.propertyName)}</Text>
                <Text style={[rs.hint, { color: colors.mutedForeground }]}>{t.loanTrackInstallmentsHint}</Text>
              </View>
              <Feather name="plus" size={18} color={colors.primary} />
            </TouchableOpacity>
          ))}

          {loans.length === 0 ? (
            <View style={[rs.card, s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="file-minus" size={28} color={colors.primary} />
              </View>
              <Text style={[s.emptyTitle, { color: colors.text }]}>{t.loansEmptyTitle}</Text>
              <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.loansEmptyHint}</Text>
              <TouchableOpacity style={[s.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => add()} activeOpacity={0.85}>
                <Feather name="plus" size={16} color={colors.primaryForeground} />
                <Text style={[s.emptyBtnText, { color: colors.primaryForeground }]}>{t.loansAdd}</Text>
              </TouchableOpacity>
            </View>
          ) : sorted.map(l => {
            const { status, nextDue } = loanStatus(l, today);
            const share = loanPaidShare(l);
            const statusText = status === 'paid_off' ? t.loanPaidOff
              : status === 'overdue' && nextDue ? t.loanOverdue(fmt.day(nextDue))
              : status === 'due_soon' && nextDue ? t.loanDueSoon(fmt.day(nextDue))
              : nextDue ? t.loanNextDue(fmt.day(nextDue))
              : status === 'paid_this_month' ? t.loanPaidThisMonth : '';
            const statusColor = status === 'overdue' ? colors.red : status === 'due_soon' ? '#F59E0B' : status === 'paid_off' ? colors.green : colors.mutedForeground;
            return (
              <TouchableOpacity
                key={l.id}
                style={[rs.card, { backgroundColor: colors.card, borderColor: status === 'overdue' ? colors.red + '55' : colors.border }]}
                onPress={() => { impact(); router.push({ pathname: '/loan-detail', params: { loanId: l.id } } as any); }}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <View style={rs.rowBetween}>
                  <View style={[s.icon, { backgroundColor: colors.red + '14' }]}>
                    <Feather name={LOAN_ICONS[l.kind]} size={16} color={colors.red} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{l.name}</Text>
                    <Text style={[rs.hint, { color: colors.mutedForeground }]} numberOfLines={1}>{loanKindLabel(l.kind, t)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.amount, { color: status === 'paid_off' ? colors.green : colors.text }]}>{fmtMoney(loanRemaining(l), l.currency)}</Text>
                    <Text style={[rs.hint, { color: colors.mutedForeground }]}>{t.loanPaidPct(Math.round(share * 100))}</Text>
                  </View>
                  <Feather name={forwardChevron()} size={16} color={colors.mutedForeground} />
                </View>
                <View style={[s.bar, { backgroundColor: colors.muted }]}>
                  <View style={[s.barFill, { width: `${Math.round(share * 100)}%`, backgroundColor: colors.green }]} />
                </View>
                {!!statusText && <Text style={[s.status, { color: statusColor }]}>{statusText}</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  sumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  big: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  mid: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  suggest: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  amount: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  status: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  empty: { alignItems: 'center', paddingVertical: 28 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptyHint: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
