import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useHaptic } from '@/hooks/useHaptic';
import { useRentalProperties } from '@/context/RentalPropertiesContext';
import { AmountInput } from '@/components/AmountInput';
import { DatePickerField } from '@/components/DatePickerField';
import { parseAmount } from '@/utils/parseAmount';
import { todayIso } from '@/utils/rentalMath';
import type { RentalLease } from '@/types';
import { ChipRow, DeleteButton, Field, RENTAL_CURRENCIES, SaveBar, ScreenHeader, generateId, rs } from '@/components/rental/RentalUI';

export default function RentalLeaseFormScreen() {
  const colors = useColors();
  const t = useT();
  const { notify } = useHaptic();
  const insets = useSafeAreaInsets();
  const { unitId, leaseId } = useLocalSearchParams<{ unitId: string; leaseId?: string }>();
  const { units, leases, add, update, remove } = useRentalProperties();
  const { logActivity } = useActivityLog();
  const unit = units.find(u => u.id === unitId);
  const existing = leaseId ? leases.find(l => l.id === leaseId) : undefined;

  const today = todayIso();
  const [tenantName, setTenantName] = useState(existing?.tenantName ?? '');
  const [tenantPhone, setTenantPhone] = useState(existing?.tenantPhone ?? '');
  const [tenantInfo, setTenantInfo] = useState(existing?.tenantInfo ?? '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [rent, setRent] = useState(existing ? String(existing.monthlyRent) : unit?.defaultMonthlyRent != null ? String(unit.defaultMonthlyRent) : '');
  const [dueDay, setDueDay] = useState(String(existing?.dueDay ?? Math.min(Number(today.slice(8, 10)), 28)));
  const [deposit, setDeposit] = useState(existing?.securityDeposit != null ? String(existing.securityDeposit) : '');
  const [increase, setIncrease] = useState(existing?.annualIncreasePct != null ? String(existing.annualIncreasePct) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? unit?.currency ?? 'EGP');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!unit) return;
    if (!tenantName.trim()) { Alert.alert(t.missingFields, t.rpTenantRequired); return; }
    const rentNum = parseAmount(rent || '');
    if (!rent.trim() || !Number.isFinite(rentNum) || rentNum < 0) { Alert.alert(t.missingFields, t.rpAmountRequired); return; }
    const due = Math.round(parseAmount(dueDay || ''));
    if (!Number.isFinite(due) || due < 1 || due > 28) { Alert.alert(t.missingFields, t.rpDueDayInvalid); return; }
    if (endDate && endDate < startDate) { Alert.alert(t.missingFields, t.rpEndBeforeStart); return; }
    const opt = (raw: string) => {
      if (!raw.trim()) return undefined;
      const n = parseAmount(raw);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    const now = new Date().toISOString();
    const lease: RentalLease = {
      ...(existing ?? { id: generateId(), createdAt: now, payments: [] }),
      unitId: unit.id,
      tenantName: tenantName.trim(),
      tenantPhone: tenantPhone.trim() || undefined,
      tenantInfo: tenantInfo.trim() || undefined,
      startDate,
      endDate: endDate || undefined,
      monthlyRent: rentNum,
      currency,
      dueDay: due,
      securityDeposit: opt(deposit),
      annualIncreasePct: opt(increase),
      notes: notes.trim() || undefined,
      ...(existing ? { updatedAt: now } : {}),
    };
    setSaving(true);
    try {
      if (existing) await update('leases', lease);
      else {
        await add('leases', lease);
        void logActivity('lease_added', t.actLeaseTitle(unit.name), t.actLeaseBody(lease.tenantName, lease.monthlyRent.toLocaleString('en-EG', { maximumFractionDigits: 0 }), lease.currency), unit.id);
      }
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
        <ScreenHeader title={existing ? t.rpEditTenancy : t.rpNewTenant} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={[rs.form, { paddingBottom: botPad + 32 }]} keyboardShouldPersistTaps="handled">
            {unit ? <Text style={[rs.hint, { color: colors.mutedForeground }]}>{unit.name}</Text> : null}

            <Field label={t.rpTenantName}>
              <TextInput style={inputStyle} value={tenantName} onChangeText={setTenantName} placeholderTextColor={colors.mutedForeground} maxLength={120} />
            </Field>
            <Field label={t.rpGuestPhone}>
              <TextInput style={inputStyle} value={tenantPhone} onChangeText={setTenantPhone} keyboardType="phone-pad" placeholderTextColor={colors.mutedForeground} maxLength={30} />
            </Field>
            <Field label={t.rpTenantInfo}>
              <TextInput style={inputStyle} value={tenantInfo} onChangeText={setTenantInfo} placeholder={t.rpGuestInfoPlaceholder} placeholderTextColor={colors.mutedForeground} maxLength={200} />
            </Field>

            <DatePickerField label={t.rpContractStart} value={startDate} onChange={setStartDate} />
            <DatePickerField
              label={t.rpContractEnd}
              value={endDate}
              onChange={setEndDate}
              onClear={() => setEndDate('')}
              placeholder={t.rpOpenEnded}
              minDate={new Date(`${startDate}T12:00:00Z`)}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 2 }}>
                <Field label={t.rpMonthlyRent}>
                  <AmountInput style={inputStyle} value={rent} onChangeText={setRent} placeholder="0" placeholderTextColor={colors.mutedForeground} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t.rpDueDay}>
                  <AmountInput style={inputStyle} value={dueDay} onChangeText={setDueDay} placeholder="1" placeholderTextColor={colors.mutedForeground} />
                </Field>
              </View>
            </View>

            <Field label={t.rpCurrency}>
              <ChipRow options={RENTAL_CURRENCIES} value={currency} onChange={setCurrency} label={v => v} />
            </Field>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label={t.rpSecurityDeposit}>
                  <AmountInput style={inputStyle} value={deposit} onChangeText={setDeposit} placeholder="0" placeholderTextColor={colors.mutedForeground} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t.rpAnnualIncrease}>
                  <AmountInput style={inputStyle} value={increase} onChangeText={setIncrease} placeholder="10" placeholderTextColor={colors.mutedForeground} />
                </Field>
              </View>
            </View>

            <Field label={t.rpNotes}>
              <TextInput style={[...inputStyle, { minHeight: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline maxLength={500} placeholderTextColor={colors.mutedForeground} />
            </Field>

            <SaveBar onSave={save} saving={saving} />
            {existing && <DeleteButton onDelete={() => remove('leases', existing.id)} />}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}
