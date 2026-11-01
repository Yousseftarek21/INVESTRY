import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useRentalProperties } from '@/context/RentalPropertiesContext';
import { AmountInput } from '@/components/AmountInput';
import { DatePickerField } from '@/components/DatePickerField';
import { parseAmount } from '@/utils/parseAmount';
import { leaseRentFor, todayIso } from '@/utils/rentalMath';
import type { RentalLease, RentalPaymentMethod } from '@/types';
import {
  AccountPickerField, ChipRow, Field, PAYMENT_METHODS, SaveBar, ScreenHeader, ToggleRow,
  fmtMoney, paymentMethodLabel, rs, useDateFormat, useDepositToCash,
} from '@/components/rental/RentalUI';

export default function RentalPaymentFormScreen() {
  const colors = useColors();
  const t = useT();
  const { notify } = useHaptic();
  const insets = useSafeAreaInsets();
  const fmt = useDateFormat();
  const deposit = useDepositToCash();
  const { leaseId, month } = useLocalSearchParams<{ leaseId: string; month: string }>();
  const { leases, update } = useRentalProperties();
  const lease = leases.find(l => l.id === leaseId);

  const due = lease ? leaseRentFor(lease, month) : 0;
  const existingPayments = useMemo(() => (lease?.payments ?? []).filter(p => p.month === month), [lease, month]);
  const alreadyPaid = existingPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const waived = existingPayments.some(p => p.waived);
  const remaining = Math.max(0, Math.round((due - alreadyPaid) * 100) / 100);

  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : '');
  const [paidDate, setPaidDate] = useState(todayIso());
  const [method, setMethod] = useState<RentalPaymentMethod>('bank_transfer');
  const [cashAccountId, setCashAccountId] = useState('');
  const [note, setNote] = useState('');
  const [waive, setWaive] = useState(false);
  const [saving, setSaving] = useState(false);

  const commit = async (next: RentalLease, after?: () => void) => {
    setSaving(true);
    try {
      await update('leases', next);
      after?.();
      notify();
      router.back();
    } catch {
      Alert.alert(t.couldNotSave, t.rpSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!lease) return;
    const now = new Date().toISOString();
    if (waive) {
      void commit({ ...lease, updatedAt: now, payments: [...lease.payments, { month, amount: 0, paidDate, waived: true, note: note.trim() || undefined }] });
      return;
    }
    const n = parseAmount(amount || '');
    if (!amount.trim() || !Number.isFinite(n) || n <= 0) { Alert.alert(t.missingFields, t.rpAmountRequired); return; }
    void commit(
      { ...lease, updatedAt: now, payments: [...lease.payments, { month, amount: n, paidDate, method, cashAccountId: cashAccountId || undefined, note: note.trim() || undefined }] },
      () => deposit(cashAccountId, n, lease.currency),
    );
  };

  const removePayment = (index: number) => {
    if (!lease) return;
    Alert.alert(t.rpUndoPayment, t.rpDeleteEntryConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive', onPress: () => {
          let seen = -1;
          const payments = lease.payments.filter(p => (p.month === month ? ++seen !== index : true));
          void commit({ ...lease, payments, updatedAt: new Date().toISOString() });
        },
      },
    ]);
  };

  const inputStyle = [rs.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }];
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  if (!lease) {
    return (
      <View style={[rs.screen, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title={t.rpRecordPayment} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[rs.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title={t.rpPaymentFor(fmt.month(month))} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={[rs.form, { paddingBottom: botPad + 32 }]} keyboardShouldPersistTaps="handled">
            <View style={[rs.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 6 }]}>
              <Text style={[rs.hint, { color: colors.mutedForeground }]}>{lease.tenantName}</Text>
              <Text style={[rs.inputText, { color: colors.text, fontSize: 20, fontFamily: 'Inter_700Bold' }]}>{fmtMoney(due, lease.currency)}</Text>
              {alreadyPaid > 0 || waived ? (
                <Text style={[rs.hint, { color: waived ? colors.mutedForeground : colors.green }]}>
                  {waived ? t.rpStatusWaived : `${t.rpStatusPaid}: ${fmtMoney(alreadyPaid, lease.currency)}`}
                </Text>
              ) : null}
              {existingPayments.map((p, i) => (
                <View key={i} style={rs.rowBetween}>
                  <Text style={[rs.hint, { color: colors.text }]}>
                    {p.waived ? t.rpStatusWaived : fmtMoney(p.amount, lease.currency)} · {fmt.full(p.paidDate)}
                    {p.method && !p.waived ? ` · ${paymentMethodLabel(p.method, t)}` : ''}
                  </Text>
                  <TouchableOpacity onPress={() => removePayment(i)} hitSlop={8} accessibilityLabel={t.rpUndoPayment}>
                    <Feather name="x-circle" size={16} color={colors.red} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {!waived && (
              <>
                <ToggleRow label={t.rpWaiveMonth} desc={t.rpWaiveMonthDesc} value={waive} onChange={setWaive} />
                {!waive && (
                  <>
                    <Field label={t.rpAmountPaid}>
                      <AmountInput style={inputStyle} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={colors.mutedForeground} />
                    </Field>
                    <DatePickerField label={t.rpPaidOn} value={paidDate} onChange={setPaidDate} />
                    <Field label={t.rpPaymentMethod}>
                      <ChipRow options={PAYMENT_METHODS} value={method} onChange={setMethod} label={m => paymentMethodLabel(m, t)} />
                    </Field>
                    <AccountPickerField value={cashAccountId} onChange={setCashAccountId} />
                  </>
                )}
                <Field label={t.rpNotes}>
                  <TextInput style={inputStyle} value={note} onChangeText={setNote} maxLength={200} placeholderTextColor={colors.mutedForeground} />
                </Field>
                <SaveBar onSave={save} saving={saving} />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}
