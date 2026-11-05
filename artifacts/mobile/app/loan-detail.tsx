import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useLoans } from '@/context/LoansContext';
import { useLoanPayments } from '@/hooks/useLoanPayments';
import { useCash } from '@/context/CashContext';
import { AmountInput } from '@/components/AmountInput';
import { DatePickerField } from '@/components/DatePickerField';
import { parseAmount } from '@/utils/parseAmount';
import { todayIso } from '@/utils/rentalMath';
import { loanMonthsLeft, loanPaidShare, loanRemaining, loanStatus } from '@/utils/loanMath';
import type { LoanPayment } from '@/types';
import { AccountPickerField, DeleteButton, Field, ScreenHeader, fmtMoney, rs, useDateFormat } from '@/components/rental/RentalUI';
import { LOAN_ICONS, loanKindLabel } from '@/components/loans/LoanUI';

export default function LoanDetailScreen() {
  const colors = useColors();
  const t = useT();
  const { impact, notify } = useHaptic();
  const insets = useSafeAreaInsets();
  const fmt = useDateFormat();
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const { loans, removeLoan } = useLoans();
  const { recordPayment, deletePayment } = useLoanPayments();
  const { cashAccounts } = useCash();
  const loan = loans.find(l => l.id === loanId);

  const today = todayIso();
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(today);
  const [payFrom, setPayFrom] = useState('');
  const [saving, setSaving] = useState(false);

  if (!loan) {
    return (
      <View style={[rs.screen, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title={t.loansTitle} />
      </View>
    );
  }

  const remaining = loanRemaining(loan);
  const share = loanPaidShare(loan);
  const { status, nextDue } = loanStatus(loan, today);
  const monthsLeft = loanMonthsLeft(loan);

  const openPay = () => {
    impact();
    const suggested = loan.monthlyPayment ? Math.min(loan.monthlyPayment, remaining) : remaining;
    setPayAmount(suggested > 0 ? String(Math.round(suggested * 100) / 100) : '');
    setPayDate(today);
    setPayFrom('');
    setPayOpen(true);
  };

  const savePayment = async () => {
    if (saving) return;
    const amount = parseAmount(payAmount);
    if (!payAmount.trim() || !Number.isFinite(amount) || amount <= 0) { Alert.alert(t.missingFields, t.rpAmountRequired); return; }
    setSaving(true);
    try {
      await recordPayment(loan, { amount, date: payDate, cashAccountId: payFrom || undefined });
      notify();
      setPayOpen(false);
    } catch {
      Alert.alert(t.couldNotSave, t.loanSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeletePayment = (p: LoanPayment) => {
    Alert.alert(t.delete, t.loanDeletePaymentConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive', onPress: async () => {
          try {
            await deletePayment(loan, p);
          } catch {
            Alert.alert(t.couldNotSave, t.loanSaveFailed);
          }
        },
      },
    ]);
  };

  const statusText = status === 'paid_off' ? t.loanPaidOff
    : status === 'overdue' && nextDue ? t.loanOverdue(fmt.day(nextDue))
    : status === 'due_soon' && nextDue ? t.loanDueSoon(fmt.day(nextDue))
    : nextDue ? t.loanNextDue(fmt.day(nextDue))
    : status === 'paid_this_month' ? t.loanPaidThisMonth : '';
  const statusColor = status === 'overdue' ? colors.red : status === 'due_soon' ? '#F59E0B' : status === 'paid_off' ? colors.green : colors.mutedForeground;
  const payments = [...loan.payments].sort((a, b) => b.date.localeCompare(a.date));
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  const inputStyle = [rs.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[rs.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader
          title={loan.name}
          right={
            <TouchableOpacity onPress={() => router.push({ pathname: '/loan-form', params: { loanId: loan.id } } as any)} hitSlop={10} accessibilityLabel={t.loanEdit}>
              <Feather name="edit-2" size={19} color={colors.primary} />
            </TouchableOpacity>
          }
        />
        <ScrollView contentContainerStyle={[rs.content, { paddingBottom: botPad + 32 }]}>
          <View style={[rs.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={rs.rowCenter}>
              <View style={[s.icon, { backgroundColor: colors.red + '14' }]}>
                <Feather name={LOAN_ICONS[loan.kind]} size={16} color={colors.red} />
              </View>
              <Text style={[rs.hint, { color: colors.mutedForeground, flex: 1 }]}>{loanKindLabel(loan.kind, t)}</Text>
            </View>
            <View>
              <Text style={[s.label, { color: colors.mutedForeground }]}>{t.loanRemaining}</Text>
              <Text style={[s.big, { color: status === 'paid_off' ? colors.green : colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {fmtMoney(remaining, loan.currency)}
              </Text>
            </View>
            <View style={[s.bar, { backgroundColor: colors.muted }]}>
              <View style={[s.barFill, { width: `${Math.round(share * 100)}%`, backgroundColor: colors.green }]} />
            </View>
            <View style={rs.rowBetween}>
              <Text style={[rs.hint, { color: colors.mutedForeground }]}>{t.loanPaidPct(Math.round(share * 100))}</Text>
              {monthsLeft != null && remaining > 0.5 && <Text style={[rs.hint, { color: colors.mutedForeground }]}>{t.loanMonthsLeft(monthsLeft)}</Text>}
            </View>
            {!!statusText && <Text style={[s.status, { color: statusColor }]}>{statusText}</Text>}
          </View>

          <View style={s.stats}>
            {loan.monthlyPayment != null && (
              <Stat label={t.loanMonthlyShort} value={fmtMoney(loan.monthlyPayment, loan.currency)} />
            )}
            {loan.annualRate != null && <Stat label={t.loanInterest} value={`${loan.annualRate}%`} />}
            {loan.endDate && <Stat label={t.loanEnds} value={fmt.month(loan.endDate.slice(0, 7))} />}
          </View>

          {status !== 'paid_off' && (
            <TouchableOpacity style={[s.payBtn, { backgroundColor: colors.primary }]} onPress={openPay} activeOpacity={0.85}>
              <Feather name="check-circle" size={17} color={colors.primaryForeground} />
              <Text style={[s.payBtnText, { color: colors.primaryForeground }]}>{t.loanMarkPayment}</Text>
            </TouchableOpacity>
          )}

          <View style={[rs.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[rs.sectionTitle, { color: colors.mutedForeground }]}>{t.loanPayments}</Text>
            {payments.length === 0 ? (
              <Text style={[rs.hint, { color: colors.mutedForeground }]}>{t.loanNoPayments}</Text>
            ) : payments.map(p => (
              <View key={p.id} style={rs.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.payAmount, { color: colors.text }]}>{fmtMoney(p.amount, loan.currency)}</Text>
                  <Text style={[rs.hint, { color: colors.mutedForeground }]}>
                    {fmt.full(p.date)}
                    {p.cashAccountId ? ` · ${cashAccounts.find(a => a.id === p.cashAccountId)?.accountName ?? ''}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => confirmDeletePayment(p)} hitSlop={10} accessibilityLabel={t.delete}>
                  <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <DeleteButton message={t.loanDeleteConfirm} onDelete={() => removeLoan(loan.id)} />
        </ScrollView>
      </View>

      <Modal visible={payOpen} animationType="slide" transparent onRequestClose={() => setPayOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={rs.sheetOverlay} activeOpacity={1} onPress={() => setPayOpen(false)}>
            <TouchableOpacity activeOpacity={1} style={[rs.sheet, { backgroundColor: colors.card, borderColor: colors.border, gap: 14 }]}>
              <Text style={[rs.sheetTitle, { color: colors.text }]}>{t.loanMarkPayment}</Text>
              <Field label={`${t.loanPayAmount} (${loan.currency})`}>
                <AmountInput style={inputStyle} value={payAmount} onChangeText={setPayAmount} placeholder="0" placeholderTextColor={colors.mutedForeground} />
              </Field>
              <DatePickerField label={t.loanPayDate} value={payDate} onChange={setPayDate} maxDate={new Date()} />
              <AccountPickerField value={payFrom} onChange={setPayFrom} label={t.loanPayFrom} noneLabel={t.loanPayFromNone} />
              <TouchableOpacity style={[s.payBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]} onPress={savePayment} disabled={saving} activeOpacity={0.85}>
                <Text style={[s.payBtnText, { color: colors.primaryForeground }]}>{t.save}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[s.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[s.label, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
      <Text style={[s.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  big: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  status: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 10, gap: 2, alignItems: 'center' },
  statValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15 },
  payBtnText: { fontSize: 15.5, fontFamily: 'Inter_700Bold' },
  payAmount: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
