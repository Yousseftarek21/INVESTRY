import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useLoans } from '@/context/LoansContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { loanAddedText } from '@/utils/activityText';
import { useHoldings } from '@/context/HoldingsContext';
import { AmountInput } from '@/components/AmountInput';
import { DatePickerField } from '@/components/DatePickerField';
import { parseAmount } from '@/utils/parseAmount';
import { todayIso } from '@/utils/rentalMath';
import type { Loan, LoanKind } from '@/types';
import { ChipRow, Field, RENTAL_CURRENCIES, SaveBar, ScreenHeader, generateId, rs } from '@/components/rental/RentalUI';
import { LOAN_KINDS, loanKindLabel } from '@/components/loans/LoanUI';

const str = (n: number | undefined) => (n != null && Number.isFinite(n) ? String(n) : '');

export default function LoanFormScreen() {
  const colors = useColors();
  const t = useT();
  const { notify } = useHaptic();
  const insets = useSafeAreaInsets();
  const { loanId, holdingId } = useLocalSearchParams<{ loanId?: string; holdingId?: string }>();
  const { loans, addLoan, updateLoan } = useLoans();
  const { logActivity } = useActivityLog();
  const { holdings } = useHoldings();
  const existing = loanId ? loans.find(l => l.id === loanId) : undefined;
  // "Track installments" from a property: prefill from its installment plan.
  const property = !existing && holdingId ? holdings.find(h => h.id === holdingId && h.type === 'real_estate') : undefined;
  const plan = property?.type === 'real_estate' ? property : undefined;

  const today = todayIso();
  const [kind, setKind] = useState<LoanKind>(existing?.kind ?? (plan ? 'installment' : 'personal'));
  const [name, setName] = useState(existing?.name ?? plan?.propertyName ?? '');
  const [currency, setCurrency] = useState(existing?.currency ?? 'EGP');
  const [balance, setBalance] = useState(str(existing?.startBalance ?? plan?.remainingBalance));
  const [original, setOriginal] = useState(str(existing?.originalAmount ?? (plan && plan.purchasePrice && plan.downPayment != null ? plan.purchasePrice - plan.downPayment : undefined)));
  const [monthly, setMonthly] = useState(str(existing?.monthlyPayment ?? plan?.monthlyInstallment));
  const [dueDay, setDueDay] = useState(str(existing?.dueDay));
  const [rate, setRate] = useState(str(existing?.annualRate));
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [endDate, setEndDate] = useState(existing?.endDate ?? plan?.installmentEndDate ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    if (!name.trim()) { Alert.alert(t.missingFields, t.loanNameRequired); return; }
    const bal = parseAmount(balance);
    if (!balance.trim() || !Number.isFinite(bal) || bal < 0) { Alert.alert(t.missingFields, t.loanBalanceRequired); return; }
    const opt = (raw: string) => {
      if (!raw.trim()) return undefined;
      const n = parseAmount(raw);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    let due: number | undefined;
    if (dueDay.trim()) {
      due = Math.round(parseAmount(dueDay));
      if (!Number.isFinite(due) || due < 1 || due > 28) { Alert.alert(t.missingFields, t.loanDueDayInvalid); return; }
    }
    if (endDate && endDate < startDate) { Alert.alert(t.missingFields, t.rpEndBeforeStart); return; }

    const now = new Date().toISOString();
    const loan: Loan = {
      ...(existing ?? { id: generateId(), createdAt: now, payments: [] }),
      kind,
      name: name.trim(),
      currency,
      startBalance: bal,
      originalAmount: opt(original),
      monthlyPayment: opt(monthly),
      dueDay: due,
      annualRate: opt(rate),
      startDate,
      endDate: endDate || undefined,
      holdingId: existing?.holdingId ?? plan?.id,
      notes: notes.trim() || undefined,
      ...(existing ? { updatedAt: now } : {}),
    };
    setSaving(true);
    try {
      if (existing) await updateLoan(loan);
      else {
        await addLoan(loan);
        const text = loanAddedText(loan, t);
        void logActivity('loan_added', text.title, text.body, loan.id);
      }
      notify();
      router.back();
    } catch {
      Alert.alert(t.couldNotSave, t.loanSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [rs.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }];
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[rs.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title={existing ? t.loanEdit : t.loanNew} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={[rs.form, { paddingBottom: botPad + 32 }]} keyboardShouldPersistTaps="handled">
            <Field label={t.loanType}>
              {/* Wrapped, not scrolled, so the selected type is always visible. */}
              <View style={s.wrap}>
                {LOAN_KINDS.map(k => {
                  const active = kind === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      onPress={() => setKind(k)}
                      style={[rs.chip, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border }]}
                      activeOpacity={0.8}
                    >
                      <Text style={[rs.chipText, { color: active ? colors.primaryForeground : colors.text }]}>{loanKindLabel(k, t)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>
            <Field label={t.loanName}>
              <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder={t.loanNamePlaceholder} placeholderTextColor={colors.mutedForeground} maxLength={120} />
            </Field>
            <Field label={t.loanStillOwed}>
              <AmountInput style={inputStyle} value={balance} onChangeText={setBalance} placeholder="0" placeholderTextColor={colors.mutedForeground} />
            </Field>
            <Field label={t.rpCurrency}>
              <ChipRow options={RENTAL_CURRENCIES} value={currency} onChange={setCurrency} label={v => v} />
            </Field>
            <Field label={t.loanOriginal} hint={t.loanOriginalHint}>
              <AmountInput style={inputStyle} value={original} onChangeText={setOriginal} placeholder="0" placeholderTextColor={colors.mutedForeground} />
            </Field>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 2 }}>
                <Field label={t.loanMonthly}>
                  <AmountInput style={inputStyle} value={monthly} onChangeText={setMonthly} placeholder="0" placeholderTextColor={colors.mutedForeground} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t.loanDueDay}>
                  <AmountInput style={inputStyle} value={dueDay} onChangeText={setDueDay} placeholder="1–28" placeholderTextColor={colors.mutedForeground} />
                </Field>
              </View>
            </View>
            <Field label={t.loanRate}>
              <AmountInput style={inputStyle} value={rate} onChangeText={setRate} placeholder="0" placeholderTextColor={colors.mutedForeground} />
            </Field>
            <DatePickerField label={t.loanStart} value={startDate} onChange={setStartDate} />
            <DatePickerField
              label={t.loanEnd}
              value={endDate}
              onChange={setEndDate}
              onClear={() => setEndDate('')}
              minDate={new Date(`${startDate}T12:00:00Z`)}
            />
            <Field label={t.rpNotes}>
              <TextInput style={[...inputStyle, { minHeight: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline maxLength={500} placeholderTextColor={colors.mutedForeground} />
            </Field>
            <SaveBar onSave={save} saving={saving} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
