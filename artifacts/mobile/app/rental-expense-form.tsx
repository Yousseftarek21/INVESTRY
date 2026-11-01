import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useRentalProperties } from '@/context/RentalPropertiesContext';
import { AmountInput } from '@/components/AmountInput';
import { DatePickerField } from '@/components/DatePickerField';
import { parseAmount } from '@/utils/parseAmount';
import { todayIso } from '@/utils/rentalMath';
import type { RentalExpense, RentalExpenseCategory } from '@/types';
import {
  ChipRow, DeleteButton, EXPENSE_CATEGORIES, Field, RENTAL_CURRENCIES, SaveBar, ScreenHeader, ToggleRow,
  categoryLabel, generateId, rs,
} from '@/components/rental/RentalUI';

export default function RentalExpenseFormScreen() {
  const colors = useColors();
  const t = useT();
  const { notify } = useHaptic();
  const insets = useSafeAreaInsets();
  const { unitId, expenseId } = useLocalSearchParams<{ unitId: string; expenseId?: string }>();
  const { units, expenses, add, update, remove } = useRentalProperties();
  const unit = units.find(u => u.id === unitId);
  const existing = expenseId ? expenses.find(e => e.id === expenseId) : undefined;

  const [category, setCategory] = useState<RentalExpenseCategory>(existing?.category ?? 'cleaning');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? unit?.currency ?? 'EGP');
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [monthly, setMonthly] = useState(existing?.monthly ?? false);
  const [until, setUntil] = useState(existing?.monthlyUntil ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!unit) return;
    const n = parseAmount(amount || '');
    if (!amount.trim() || !Number.isFinite(n) || n <= 0) { Alert.alert(t.missingFields, t.rpAmountRequired); return; }
    if (monthly && until && until < date) { Alert.alert(t.missingFields, t.rpEndBeforeStart); return; }
    const now = new Date().toISOString();
    const expense: RentalExpense = {
      ...(existing ?? { id: generateId(), createdAt: now }),
      unitId: unit.id,
      category,
      amount: n,
      currency,
      date,
      monthly: monthly || undefined,
      monthlyUntil: monthly && until ? until : undefined,
      note: note.trim() || undefined,
      ...(existing ? { updatedAt: now } : {}),
    };
    setSaving(true);
    try {
      if (existing) await update('expenses', expense);
      else await add('expenses', expense);
      notify();
      router.back();
    } catch {
      Alert.alert(t.couldNotSave, t.rpSaveFailed);
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
        <ScreenHeader title={existing ? t.rpEditCost : t.rpNewCost} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={[rs.form, { paddingBottom: botPad + 32 }]} keyboardShouldPersistTaps="handled">
            {unit ? <Text style={[rs.hint, { color: colors.mutedForeground }]}>{unit.name}</Text> : null}

            <Field label={t.rpCategory}>
              <ChipRow options={EXPENSE_CATEGORIES} value={category} onChange={setCategory} label={c => categoryLabel(c, t)} />
            </Field>
            <Field label={t.rpAmount}>
              <AmountInput style={inputStyle} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={colors.mutedForeground} />
            </Field>
            <Field label={t.rpCurrency}>
              <ChipRow options={RENTAL_CURRENCIES} value={currency} onChange={setCurrency} label={v => v} />
            </Field>
            <DatePickerField label={t.rpDate} value={date} onChange={setDate} />
            <ToggleRow label={t.rpRepeatsMonthly} value={monthly} onChange={setMonthly} />
            {monthly && (
              <DatePickerField
                label={t.rpRepeatsUntil}
                value={until}
                onChange={setUntil}
                onClear={() => setUntil('')}
                placeholder={t.rpOpenEnded}
                minDate={new Date(`${date}T12:00:00Z`)}
              />
            )}
            <Field label={t.rpNotes}>
              <TextInput style={inputStyle} value={note} onChangeText={setNote} maxLength={200} placeholderTextColor={colors.mutedForeground} />
            </Field>

            <SaveBar onSave={save} saving={saving} />
            {existing && <DeleteButton onDelete={() => remove('expenses', existing.id)} />}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}
