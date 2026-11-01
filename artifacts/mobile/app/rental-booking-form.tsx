import React, { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useRentalProperties } from '@/context/RentalPropertiesContext';
import { AmountInput } from '@/components/AmountInput';
import { DatePickerField } from '@/components/DatePickerField';
import { parseAmount } from '@/utils/parseAmount';
import { bookingNights, bookingPayout, dayIso, dayNum, overlappingBookings, todayIso } from '@/utils/rentalMath';
import type { BookingPlatform, RentalBooking, RentalPaymentMethod } from '@/types';
import {
  AccountPickerField, ChipRow, DeleteButton, Field, PAYMENT_METHODS, PLATFORMS, RENTAL_CURRENCIES, SaveBar, ScreenHeader, ToggleRow,
  fmtMoney, generateId, paymentMethodLabel, platformLabel, rs, useDateFormat, useDepositToCash,
} from '@/components/rental/RentalUI';

export default function RentalBookingFormScreen() {
  const colors = useColors();
  const t = useT();
  const { notify } = useHaptic();
  const insets = useSafeAreaInsets();
  const fmt = useDateFormat();
  const { logActivity } = useActivityLog();
  const deposit = useDepositToCash();
  const { unitId, bookingId } = useLocalSearchParams<{ unitId: string; bookingId?: string }>();
  const { units, bookings, add, update, remove } = useRentalProperties();
  const unit = units.find(u => u.id === unitId);
  const existing = bookingId ? bookings.find(b => b.id === bookingId) : undefined;
  const alreadyDeposited = !!(existing?.received && existing.cashAccountId);

  const today = todayIso();
  const [guestName, setGuestName] = useState(existing?.guestName ?? '');
  const [guestPhone, setGuestPhone] = useState(existing?.guestPhone ?? '');
  const [guests, setGuests] = useState(existing?.guests != null ? String(existing.guests) : '');
  const [guestInfo, setGuestInfo] = useState(existing?.guestInfo ?? '');
  const [checkIn, setCheckIn] = useState(existing?.checkIn ?? today);
  const [checkOut, setCheckOut] = useState(existing?.checkOut ?? dayIso(dayNum(today) + 1));
  const [platform, setPlatform] = useState<BookingPlatform>(existing?.platform ?? 'airbnb');
  const [platformOther, setPlatformOther] = useState(existing?.platformOther ?? '');
  const [total, setTotal] = useState(existing ? String(existing.totalAmount) : '');
  const [cleaning, setCleaning] = useState(existing?.cleaningFee != null ? String(existing.cleaningFee) : unit?.defaultCleaningFee != null ? String(unit.defaultCleaningFee) : '');
  const [fee, setFee] = useState(existing?.platformFee != null ? String(existing.platformFee) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? unit?.currency ?? 'EGP');
  const [cancelled, setCancelled] = useState(existing?.status === 'cancelled');
  const [received, setReceived] = useState(existing?.received ?? false);
  const [receivedDate, setReceivedDate] = useState(existing?.receivedDate ?? today);
  const [method, setMethod] = useState<RentalPaymentMethod>(existing?.paymentMethod ?? 'bank_transfer');
  const [cashAccountId, setCashAccountId] = useState('');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const totalTouched = useRef(!!existing);

  const nights = bookingNights({ checkIn, checkOut });

  // Until the owner types a total, suggest one from the unit's usual rates.
  const suggestTotal = (inDate: string, outDate: string, cleaningRaw: string) => {
    if (totalTouched.current || !unit?.defaultNightlyRate) return;
    const n = bookingNights({ checkIn: inDate, checkOut: outDate });
    if (n <= 0) return;
    const c = cleaningRaw.trim() ? parseAmount(cleaningRaw) : 0;
    setTotal(String(Math.round(unit.defaultNightlyRate * n + (Number.isFinite(c) ? c : 0))));
  };
  const onCheckIn = (v: string) => {
    setCheckIn(v);
    const out = v >= checkOut ? dayIso(dayNum(v) + 1) : checkOut;
    if (out !== checkOut) setCheckOut(out);
    suggestTotal(v, out, cleaning);
  };
  const onCheckOut = (v: string) => { setCheckOut(v); suggestTotal(checkIn, v, cleaning); };

  const totalNum = parseAmount(total || '0');
  const feeNum = fee.trim() ? parseAmount(fee) : 0;
  const payout = Math.max(0, (Number.isFinite(totalNum) ? totalNum : 0) - (Number.isFinite(feeNum) ? feeNum : 0));
  const preview = useMemo(() => {
    if (!(totalNum > 0)) return null;
    return t.rpPayoutPreview(fmtMoney(payout, currency), nights > 0 ? fmtMoney(payout / nights, currency) : '');
  }, [totalNum, payout, nights, currency, t]);

  const persist = async (booking: RentalBooking) => {
    setSaving(true);
    try {
      if (existing) await update('bookings', booking);
      else await add('bookings', booking);
      // Deposit once: only an account picked in this form, and only if this
      // stay was never deposited before (the picker is hidden after that).
      if (booking.received && booking.status !== 'cancelled' && cashAccountId && !alreadyDeposited) {
        deposit(cashAccountId, bookingPayout(booking), booking.currency);
      }
      if (!existing && unit) {
        logActivity('rental_added', t.activityRentalAddedTitle, t.activityRentalAddedSubtitle(unit.name, Math.round(booking.totalAmount).toLocaleString('en-EG'), booking.currency), booking.id);
      }
      notify();
      router.back();
    } catch {
      Alert.alert(t.couldNotSave, t.rpSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!unit) return;
    if (checkOut < checkIn) { Alert.alert(t.missingFields, t.rpCheckoutBeforeCheckin); return; }
    if (!(Number.isFinite(totalNum) && totalNum >= 0) || !total.trim()) { Alert.alert(t.missingFields, t.rpAmountRequired); return; }
    if (!Number.isFinite(feeNum) || feeNum < 0) { Alert.alert(t.missingFields, t.rpAmountRequired); return; }
    if (feeNum > totalNum) { Alert.alert(t.missingFields, t.rpFeeTooHigh); return; }
    const cleaningNum = cleaning.trim() ? parseAmount(cleaning) : undefined;
    const guestsNum = guests.trim() ? Math.round(parseAmount(guests)) : undefined;
    const now = new Date().toISOString();
    const booking: RentalBooking = {
      ...(existing ?? { id: generateId(), createdAt: now }),
      unitId: unit.id,
      guestName: guestName.trim() || undefined,
      guestPhone: guestPhone.trim() || undefined,
      guestInfo: guestInfo.trim() || undefined,
      guests: guestsNum != null && Number.isFinite(guestsNum) && guestsNum > 0 ? guestsNum : undefined,
      checkIn,
      checkOut,
      platform,
      platformOther: platform === 'other' ? platformOther.trim() || undefined : undefined,
      totalAmount: totalNum,
      platformFee: feeNum > 0 ? feeNum : undefined,
      cleaningFee: cleaningNum != null && Number.isFinite(cleaningNum) && cleaningNum > 0 ? cleaningNum : undefined,
      currency,
      status: cancelled ? 'cancelled' : 'confirmed',
      received,
      receivedDate: received ? receivedDate : undefined,
      paymentMethod: received ? method : undefined,
      cashAccountId: received ? (cashAccountId || existing?.cashAccountId) : existing?.cashAccountId,
      notes: notes.trim() || undefined,
      ...(existing ? { updatedAt: now } : {}),
    };

    const clash = cancelled ? [] : overlappingBookings(booking, bookings);
    if (clash.length > 0) {
      const other = clash[0];
      Alert.alert(t.rpOverlapTitle, t.rpOverlapDesc(`${other.guestName ? other.guestName + ', ' : ''}${fmt.day(other.checkIn)} – ${fmt.day(other.checkOut)}`), [
        { text: t.cancel, style: 'cancel' },
        { text: t.rpSaveAnyway, onPress: () => { void persist(booking); } },
      ]);
      return;
    }
    void persist(booking);
  };

  const inputStyle = [rs.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }];
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[rs.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title={existing ? t.rpEditStay : t.rpNewStay} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={[rs.form, { paddingBottom: botPad + 32 }]} keyboardShouldPersistTaps="handled">
            {unit ? <Text style={[rs.hint, { color: colors.mutedForeground }]}>{unit.name}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <DatePickerField label={t.rpCheckIn} value={checkIn} onChange={onCheckIn} />
              </View>
              <View style={{ flex: 1 }}>
                <DatePickerField label={t.rpCheckOut} value={checkOut} onChange={onCheckOut} minDate={new Date(`${checkIn}T12:00:00Z`)} />
              </View>
            </View>
            <Text style={[rs.hint, { color: colors.mutedForeground }]}>{t.rpNights(nights)}</Text>

            <Field label={t.rpPlatform}>
              <ChipRow options={PLATFORMS} value={platform} onChange={setPlatform} label={p => platformLabel(p, t)} />
              {platform === 'other' && (
                <TextInput style={[...inputStyle, { marginTop: 8 }]} value={platformOther} onChangeText={setPlatformOther} placeholder={t.rpPlatformOtherPlaceholder} placeholderTextColor={colors.mutedForeground} maxLength={60} />
              )}
            </Field>

            <Field label={t.rpTotalPaid}>
              <AmountInput style={inputStyle} value={total} onChangeText={v => { totalTouched.current = true; setTotal(v); }} placeholder="0" placeholderTextColor={colors.mutedForeground} />
            </Field>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label={t.rpCleaningIncluded}>
                  <AmountInput style={inputStyle} value={cleaning} onChangeText={v => { setCleaning(v); suggestTotal(checkIn, checkOut, v); }} placeholder="0" placeholderTextColor={colors.mutedForeground} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t.rpPlatformFee}>
                  <AmountInput style={inputStyle} value={fee} onChangeText={setFee} placeholder="0" placeholderTextColor={colors.mutedForeground} />
                </Field>
              </View>
            </View>
            {preview ? <Text style={[rs.inputText, { color: colors.green }]}>{preview}</Text> : null}

            <Field label={t.rpCurrency}>
              <ChipRow options={RENTAL_CURRENCIES} value={currency} onChange={setCurrency} label={v => v} />
            </Field>

            <Field label={t.rpGuestName}>
              <TextInput style={inputStyle} value={guestName} onChangeText={setGuestName} placeholderTextColor={colors.mutedForeground} maxLength={120} />
            </Field>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 2 }}>
                <Field label={t.rpGuestPhone}>
                  <TextInput style={inputStyle} value={guestPhone} onChangeText={setGuestPhone} keyboardType="phone-pad" placeholderTextColor={colors.mutedForeground} maxLength={30} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t.rpGuestCount}>
                  <AmountInput style={inputStyle} value={guests} onChangeText={setGuests} placeholder="2" placeholderTextColor={colors.mutedForeground} />
                </Field>
              </View>
            </View>
            <Field label={t.rpGuestInfo}>
              <TextInput style={inputStyle} value={guestInfo} onChangeText={setGuestInfo} placeholder={t.rpGuestInfoPlaceholder} placeholderTextColor={colors.mutedForeground} maxLength={200} />
            </Field>

            <ToggleRow label={t.rpPaymentReceived} value={received} onChange={setReceived} />
            {received && (
              <>
                <DatePickerField label={t.rpReceivedDate} value={receivedDate} onChange={setReceivedDate} />
                <Field label={t.rpPaymentMethod}>
                  <ChipRow options={PAYMENT_METHODS} value={method} onChange={setMethod} label={m => paymentMethodLabel(m, t)} />
                </Field>
                {!alreadyDeposited && <AccountPickerField value={cashAccountId} onChange={setCashAccountId} />}
              </>
            )}

            {existing && (
              <ToggleRow label={t.rpStayCancelled} desc={t.rpStayCancelledDesc} value={cancelled} onChange={setCancelled} />
            )}

            <Field label={t.rpNotes}>
              <TextInput style={[...inputStyle, { minHeight: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline maxLength={500} placeholderTextColor={colors.mutedForeground} />
            </Field>

            <SaveBar onSave={save} saving={saving} />
            {existing && <DeleteButton onDelete={() => remove('bookings', existing.id)} />}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

