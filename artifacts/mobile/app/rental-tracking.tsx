import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { ConceptIcon } from '@/components/ConceptIcon';
import { ICON_RENTAL_INCOME } from '@/constants/conceptIcons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerField } from '@/components/DatePickerField';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useCash } from '@/context/CashContext';
import { useHoldings } from '@/context/HoldingsContext';
import { useRentalRecords } from '@/context/RentalContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { parseAmount } from '@/utils/parseAmount';
import { AmountInput } from '@/components/AmountInput';
import { useSubscription } from '@/context/SubscriptionContext';
import { RentalRecord, RentalChannel, RentalPaymentMethod, RealEstateHolding } from '@/types';
import type { Translations } from '@/i18n';

// Pro feature from day one — same 0-free shape as Dividends/Recurring
// Income (see dividends.tsx's own comment on why that's the standard now).
const FREE_LIMIT = 0;

const CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];
const CHANNELS: RentalChannel[] = ['direct_lease', 'airbnb', 'booking_com', 'other'];
const PAYMENT_METHODS: RentalPaymentMethod[] = ['cash', 'bank_transfer', 'instapay', 'vodafone_cash', 'other'];

function channelLabel(c: RentalChannel, t: ReturnType<typeof useT>): string {
  if (c === 'direct_lease') return t.channelDirectLease;
  if (c === 'airbnb') return t.channelAirbnb;
  if (c === 'booking_com') return t.channelBookingCom;
  return t.channelOther;
}
function paymentMethodLabel(m: RentalPaymentMethod, t: ReturnType<typeof useT>): string {
  if (m === 'cash') return t.paymentMethodCash;
  if (m === 'bank_transfer') return t.paymentMethodBankTransfer;
  if (m === 'instapay') return t.paymentMethodInstapay;
  if (m === 'vodafone_cash') return t.paymentMethodVodafoneCash;
  return t.channelOther;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Airbnb's own convention: checkout minus checkin, not an inclusive day count.
function nightsBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.round((end - start) / 86_400_000);
}

export default function RentalTrackingScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { cashAccounts, updateCashAccount } = useCash();
  const { holdings } = useHoldings();
  const { rentals, addRental, updateRental, removeRental } = useRentalRecords();
  const { logActivity } = useActivityLog();
  // A modal route (see app/_layout.tsx) — must use showPaywallFromModal(),
  // not showPaywall(), same reasoning as dividends.tsx's own comment.
  const { featuresUnlocked, isLoading: subLoading, showPaywallFromModal } = useSubscription();

  const realEstateHoldings = useMemo(
    () => holdings.filter((h): h is RealEstateHolding => h.type === 'real_estate'),
    [holdings],
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const [holdingId, setHoldingId] = useState<string | undefined>(undefined);
  const [propertyName, setPropertyName] = useState('');
  const [propertyArea, setPropertyArea] = useState<number | undefined>(undefined);
  const [tenantName, setTenantName] = useState('');
  const [tenantInfo, setTenantInfo] = useState('');
  const [channel, setChannel] = useState<RentalChannel>('direct_lease');
  const [channelOther, setChannelOther] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [paymentMethod, setPaymentMethod] = useState<RentalPaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [cashAccountId, setCashAccountId] = useState('');

  const selectedAccount = cashAccounts.find(a => a.id === cashAccountId);

  const totalsByCurrency = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const r of rentals) totals[r.currency] = (totals[r.currency] ?? 0) + r.amount;
    return totals;
  }, [rentals]);

  const resetForm = useCallback(() => {
    setHoldingId(undefined);
    setPropertyName('');
    setPropertyArea(undefined);
    setTenantName('');
    setTenantInfo('');
    setChannel('direct_lease');
    setChannelOther('');
    setStartDate(todayISO());
    setEndDate('');
    setAmountRaw('');
    setCurrency('EGP');
    setPaymentMethod('cash');
    setNote('');
    setCashAccountId('');
    setEditingId(null);
    setShowForm(false);
  }, []);

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (r: RentalRecord) => {
    setEditingId(r.id);
    setHoldingId(r.holdingId);
    setPropertyName(r.propertyName);
    setPropertyArea(r.propertyArea);
    setTenantName(r.tenantName ?? '');
    setTenantInfo(r.tenantInfo ?? '');
    setChannel(r.channel);
    setChannelOther(r.channelOther ?? '');
    setStartDate(r.startDate);
    setEndDate(r.endDate ?? '');
    setAmountRaw(String(r.amount));
    setCurrency(r.currency);
    setPaymentMethod(r.paymentMethod ?? 'cash');
    setNote(r.note ?? '');
    setCashAccountId(r.cashAccountId ?? '');
    setShowForm(true);
  };

  const pickProperty = (h: RealEstateHolding) => {
    setHoldingId(h.id);
    setPropertyName(h.propertyName);
    setPropertyArea(h.area);
  };

  // Free typing after a quick-fill pick means the name no longer matches
  // that holding — drop the link rather than silently keep pointing a
  // renamed record at the wrong property. Only fires on user keystrokes,
  // never on the programmatic setPropertyName() calls above/in openEdit.
  const onPropertyNameChange = (v: string) => {
    setPropertyName(v);
    if (holdingId) { setHoldingId(undefined); setPropertyArea(undefined); }
  };

  const handleSave = async () => {
    const amount = parseAmount(amountRaw);

    if (!propertyName.trim()) {
      Alert.alert(t.missingFields, t.rentalPropertyNameRequired);
      return;
    }
    if (amount <= 0) {
      Alert.alert(t.amount, t.incomeAmountError);
      return;
    }
    if (endDate && endDate < startDate) {
      Alert.alert(t.rentalStartDate, t.rentalEndBeforeStartError);
      return;
    }
    if (!editingId && !subLoading && !featuresUnlocked && rentals.length >= FREE_LIMIT) {
      showPaywallFromModal();
      return;
    }

    impact(Haptics.ImpactFeedbackStyle.Light);

    const amountText = amount.toLocaleString('en-EG', { maximumFractionDigits: 0 });
    const trimmedPropertyName = propertyName.trim();

    try {
      if (editingId) {
        const existing = rentals.find(r => r.id === editingId);
        if (!existing) return;
        await updateRental({
          ...existing,
          holdingId, propertyName: trimmedPropertyName, propertyArea,
          tenantName: tenantName.trim() || undefined,
          tenantInfo: tenantInfo.trim() || undefined,
          channel, channelOther: channel === 'other' ? channelOther.trim() || undefined : undefined,
          startDate, endDate: endDate || undefined,
          amount, currency, paymentMethod,
          note: note.trim() || undefined,
          cashAccountId: cashAccountId || undefined,
          updatedAt: new Date().toISOString(),
        });
        logActivity('rental_edited', t.activityRentalEditedTitle, t.activityRentalEditedSubtitle(trimmedPropertyName, amountText, currency), existing.id);
      } else {
        const id = generateId();
        await addRental({
          id, holdingId, propertyName: trimmedPropertyName, propertyArea,
          tenantName: tenantName.trim() || undefined,
          tenantInfo: tenantInfo.trim() || undefined,
          channel, channelOther: channel === 'other' ? channelOther.trim() || undefined : undefined,
          startDate, endDate: endDate || undefined,
          amount, currency, paymentMethod,
          note: note.trim() || undefined,
          cashAccountId: cashAccountId || undefined,
          createdAt: new Date().toISOString(),
        });
        // One-time bump, not tracked ongoing — same pattern as
        // dividends.tsx's own cash-account deposit.
        if (cashAccountId) {
          const account = cashAccounts.find(a => a.id === cashAccountId);
          if (account) {
            updateCashAccount({ ...account, balance: (Number(account.balance) || 0) + amount });
          }
        }
        logActivity('rental_added', t.activityRentalAddedTitle, t.activityRentalAddedSubtitle(trimmedPropertyName, amountText, currency), id);
      }
      resetForm();
    } catch {
      Alert.alert(t.couldNotSave, t.couldNotOpenLinkDesc);
    }
  };

  const handleDelete = (id: string) => {
    if (Platform.OS === 'web') { setPendingDeleteId(id); return; }
    Alert.alert(t.deleteRentalPayment, t.deleteRentalPaymentConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => { impact(Haptics.ImpactFeedbackStyle.Medium); removeRental(id); },
      },
    ]);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    impact(Haptics.ImpactFeedbackStyle.Medium);
    removeRental(id);
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const sorted = useMemo(
    () => [...rentals].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [rentals],
  );

  const nights = startDate && endDate && endDate > startDate ? nightsBetween(startDate, endDate) : null;
  const amountNum = parseAmount(amountRaw);
  const perNight = nights && nights > 0 && amountNum > 0 ? amountNum / nights : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { if (showForm) resetForm(); else router.back(); }} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            {showForm ? (editingId ? t.editRentalPayment : t.addRentalPayment) : t.rentalTrackingTitle}
          </Text>
          {!showForm ? (
            <TouchableOpacity onPress={openAdd} hitSlop={8}>
              <Feather name="plus" size={22} color={colors.primary} />
            </TouchableOpacity>
          ) : <View style={{ width: 22 }} />}
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]}
            keyboardShouldPersistTaps="handled"
          >
            {!showForm ? (
              rentals.length === 0 ? (
                <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[s.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                    <ConceptIcon icon={ICON_RENTAL_INCOME} size={30} color={colors.primary} />
                  </View>
                  <Text style={[s.emptyTitle, { color: colors.text }]}>{t.noRentalRecords}</Text>
                  <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.noRentalRecordsHint}</Text>
                  <TouchableOpacity style={[s.emptyBtn, { backgroundColor: colors.primary }]} onPress={openAdd} activeOpacity={0.85}>
                    <Feather name="plus" size={16} color={colors.primaryForeground} />
                    <Text style={[s.emptyBtnText, { color: colors.primaryForeground }]}>{t.addRentalPayment}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={[s.summary, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '30' }]}>
                    <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>{t.totalReceived}</Text>
                    {Object.entries(totalsByCurrency).map(([cur, total]) => (
                      <Text key={cur} style={[s.summaryValue, { color: colors.text }]}>
                        {total.toLocaleString('en-EG', { maximumFractionDigits: 0 })} {cur}
                      </Text>
                    ))}
                    <Text style={[s.summaryCount, { color: colors.mutedForeground }]}>{t.rentalEntryCount(rentals.length)}</Text>
                  </View>
                  <View style={s.list}>
                    {sorted.map(r => {
                      // Real fix for swipe losing to a tap on real devices —
                      // see SwipeToDelete.tsx's own comment.
                      const cardTapGesture = Gesture.Tap().runOnJS(true).onEnd((_e, success) => {
                        if (success) { impact(); openEdit(r); }
                      });
                      return (
                      <SwipeToDelete key={r.id} onDelete={() => handleDelete(r.id)} tapGesture={cardTapGesture}>
                        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <GestureDetector gesture={cardTapGesture}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                              <View style={[s.cardIcon, { backgroundColor: colors.green + '18' }]}>
                                <ConceptIcon icon={ICON_RENTAL_INCOME} size={18} color={colors.green} />
                              </View>
                              <View style={s.cardBody}>
                                <Text style={[s.cardName, { color: colors.text }]} numberOfLines={1}>
                                  {r.propertyName}{r.tenantName ? ` · ${r.tenantName}` : ''}
                                </Text>
                                <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                                  {formatDate(r.startDate)}{r.endDate ? ` – ${formatDate(r.endDate)}` : ''}
                                  {' · '}{channel === r.channel ? '' : ''}{r.channel === 'other' && r.channelOther ? r.channelOther : channelLabel(r.channel, t)}
                                </Text>
                              </View>
                            </View>
                          </GestureDetector>
                          <View style={s.cardSideCol}>
                            <Text style={[s.cardAmount, { color: colors.green }]}>
                              +{r.amount.toLocaleString('en-EG', { maximumFractionDigits: 0 })} {r.currency}
                            </Text>
                            <TouchableOpacity
                              style={[s.deleteBtn, { backgroundColor: colors.red + '12' }]}
                              onPress={() => handleDelete(r.id)}
                              hitSlop={8}
                            >
                              <Feather name="trash-2" size={13} color={colors.red} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </SwipeToDelete>
                      );
                    })}
                  </View>
                </>
              )
            ) : (
              <View style={s.form}>

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rentalPropertyName}</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={propertyName}
                    onChangeText={onPropertyNameChange}
                    placeholder={t.rentalPropertyNamePlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                {realEstateHoldings.length > 0 && (
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.mutedForeground }]}>{t.quickFillFromProperties}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                      {realEstateHoldings.map(h => (
                        <TouchableOpacity
                          key={h.id}
                          style={[s.chip, {
                            backgroundColor: holdingId === h.id ? colors.primary : colors.input,
                            borderColor: holdingId === h.id ? colors.primary : colors.border,
                          }]}
                          onPress={() => pickProperty(h)}
                        >
                          <Text style={[s.chipText, { color: holdingId === h.id ? colors.primaryForeground : colors.text }]} numberOfLines={1}>
                            {h.propertyName}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rentalPropertyAreaOptional}</Text>
                  <AmountInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={propertyArea ? String(propertyArea) : ''}
                    onChangeText={(v) => setPropertyArea(v ? parseAmount(v) : undefined)}
                    placeholder={t.rentalPropertyAreaPlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rentalTenantName}</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={tenantName}
                    onChangeText={setTenantName}
                    placeholder={t.rentalTenantNamePlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rentalTenantInfoOptional}</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={tenantInfo}
                    onChangeText={setTenantInfo}
                    placeholder={t.rentalTenantInfoPlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rentalChannel}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                    {CHANNELS.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[s.chip, {
                          backgroundColor: channel === c ? colors.primary : colors.input,
                          borderColor: channel === c ? colors.primary : colors.border,
                        }]}
                        onPress={() => setChannel(c)}
                      >
                        <Text style={[s.chipText, { color: channel === c ? colors.primaryForeground : colors.text }]}>
                          {channelLabel(c, t)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {channel === 'other' && (
                    <TextInput
                      style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border, marginTop: 8 }]}
                      value={channelOther}
                      onChangeText={setChannelOther}
                      placeholder={t.channelOtherPlaceholder}
                      placeholderTextColor={colors.mutedForeground}
                    />
                  )}
                </View>

                <View style={s.field}>
                  <DatePickerField label={t.rentalStartDate} value={startDate} onChange={setStartDate} maxDate={new Date()} />
                </View>
                <View style={s.field}>
                  <DatePickerField
                    label={t.rentalEndDateOptional}
                    value={endDate}
                    onChange={setEndDate}
                    onClear={() => setEndDate('')}
                    placeholder={t.noEndDate}
                    minDate={new Date(startDate)}
                  />
                </View>

                {nights !== null && (
                  <Text style={[s.hint, { color: colors.mutedForeground }]}>
                    {t.rentalNights(nights)}{perNight !== null ? ` · ${perNight.toLocaleString('en-EG', { maximumFractionDigits: 0 })} ${currency}${t.perNightSuffix}` : ''}
                  </Text>
                )}

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rentalAmount}</Text>
                  <AmountInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={amountRaw}
                    onChangeText={setAmountRaw}
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rentalCurrency}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                    {CURRENCIES.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[s.chip, {
                          backgroundColor: currency === c ? colors.primary : colors.input,
                          borderColor: currency === c ? colors.primary : colors.border,
                        }]}
                        onPress={() => setCurrency(c)}
                      >
                        <Text style={[s.chipText, { color: currency === c ? colors.primaryForeground : colors.text }]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rentalPaymentMethod}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                    {PAYMENT_METHODS.map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[s.chip, {
                          backgroundColor: paymentMethod === m ? colors.primary : colors.input,
                          borderColor: paymentMethod === m ? colors.primary : colors.border,
                        }]}
                        onPress={() => setPaymentMethod(m)}
                      >
                        <Text style={[s.chipText, { color: paymentMethod === m ? colors.primaryForeground : colors.text }]}>
                          {paymentMethodLabel(m, t)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.depositIntoOptional}</Text>
                  {cashAccounts.length === 0 ? (
                    <View style={[s.noAccounts, { backgroundColor: colors.input, borderColor: colors.border }]}>
                      <Feather name="alert-circle" size={14} color={colors.mutedForeground} />
                      <Text style={[s.noAccountsText, { color: colors.mutedForeground }]}>{t.noCashAccounts}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[s.picker, { backgroundColor: colors.input, borderColor: colors.border }]}
                      onPress={() => setShowAccountPicker(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.pickerText, { color: cashAccountId ? colors.text : colors.mutedForeground }]} numberOfLines={1}>
                        {selectedAccount?.accountName ?? t.dontAddToCash}
                      </Text>
                      <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.rentalNoteOptional}</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={note}
                    onChangeText={setNote}
                    placeholder={t.rentalNotePlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={s.btns}>
                  <TouchableOpacity style={[s.btnCancel, { backgroundColor: colors.muted }]} onPress={resetForm} activeOpacity={0.8}>
                    <Text style={[s.btnCancelText, { color: colors.text }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btnSave, { backgroundColor: colors.primary }]} onPress={handleSave} activeOpacity={0.85}>
                    <Text style={[s.btnSaveText, { color: colors.primaryForeground }]}>{t.saveRentalPayment}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={showAccountPicker} animationType="slide" transparent onRequestClose={() => setShowAccountPicker(false)}>
          <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowAccountPicker(false)}>
            <View style={[s.pickerSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.pickerSheetTitle, { color: colors.text }]}>{t.depositIntoOptional}</Text>
              <TouchableOpacity
                style={[s.pickerOption, { borderColor: colors.border, backgroundColor: !cashAccountId ? colors.primary + '14' : 'transparent' }]}
                onPress={() => { setCashAccountId(''); setShowAccountPicker(false); }}
              >
                <Text style={[s.pickerOptionText, { color: !cashAccountId ? colors.primary : colors.text }]}>{t.dontAddToCash}</Text>
              </TouchableOpacity>
              {cashAccounts.map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={[s.pickerOption, { borderColor: colors.border, backgroundColor: cashAccountId === a.id ? colors.primary + '14' : 'transparent' }]}
                  onPress={() => { setCashAccountId(a.id); setShowAccountPicker(false); }}
                >
                  <Text style={[s.pickerOptionText, { color: cashAccountId === a.id ? colors.primary : colors.text }]}>{a.accountName}</Text>
                  <Text style={[s.pickerOptionSub, { color: colors.mutedForeground }]}>{a.currency}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={!!pendingDeleteId} animationType="fade" transparent onRequestClose={() => setPendingDeleteId(null)}>
          <View style={s.confirmOverlay}>
            <View style={[s.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.confirmTitle, { color: colors.text }]}>{t.deleteRentalPayment}</Text>
              <Text style={[s.confirmMsg, { color: colors.mutedForeground }]}>{t.deleteRentalPaymentConfirm}</Text>
              <View style={s.confirmRow}>
                <TouchableOpacity style={[s.confirmBtn, { backgroundColor: colors.muted }]} onPress={() => setPendingDeleteId(null)}>
                  <Text style={[s.confirmBtnText, { color: colors.text }]}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.confirmBtn, { backgroundColor: colors.red }]} onPress={confirmDelete}>
                  <Text style={[s.confirmBtnText, { color: '#fff' }]}>{t.delete}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content:     { padding: 16, gap: 0 },

  summary:      { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14, gap: 4 },
  summaryLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3, textTransform: 'uppercase' },
  summaryValue: { fontSize: 24, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.3 },
  summaryCount: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },

  empty:      { borderRadius: 18, borderWidth: 1, padding: 32, alignItems: 'center', gap: 10, marginTop: 8 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyHint:  { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 6 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  list: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  cardIcon:    { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody:    { flex: 1, gap: 2 },
  cardName:    { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardSub:     { fontSize: 12, fontFamily: 'Inter_400Regular' },
  cardSideCol: { alignItems: 'flex-end', gap: 8 },
  cardAmount:  { fontSize: 14, fontFamily: 'Inter_700Bold' },
  deleteBtn:   { borderRadius: 8, padding: 6 },

  form:    { gap: 16, paddingTop: 8 },
  field:   { gap: 6 },
  label:   { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  input:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  chips:   { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip:    { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  noAccounts:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 14 },
  noAccountsText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },

  picker:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  pickerText: { fontSize: 15, fontFamily: 'Inter_400Regular', flex: 1 },

  btns:         { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancel:    { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnCancelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  btnSave:      { flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnSaveText:  { fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  pickerOverlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet:       { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, gap: 4 },
  pickerSheetTitle:  { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  pickerOption:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  pickerOptionText:  { fontSize: 15, fontFamily: 'Inter_500Medium' },
  pickerOptionSub:   { fontSize: 13, fontFamily: 'Inter_400Regular' },

  confirmOverlay:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
  confirmCard:     { width: '100%', borderRadius: 18, borderWidth: 1, padding: 24, gap: 10 },
  confirmTitle:    { fontSize: 16, fontFamily: 'Inter_700Bold' },
  confirmMsg:      { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  confirmRow:      { flexDirection: 'row', gap: 10, marginTop: 4 },
  confirmBtn:      { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  confirmBtnText:  { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
