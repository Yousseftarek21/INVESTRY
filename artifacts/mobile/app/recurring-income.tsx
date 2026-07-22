import React, { useCallback, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerField } from '@/components/DatePickerField';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useCash } from '@/context/CashContext';
import { useRecurringIncome } from '@/context/RecurringIncomeContext';
import { parseAmount } from '@/utils/parseAmount';
import { AmountInput } from '@/components/AmountInput';
import { RecurringIncome } from '@/types';

const CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/** '2026-07' → 'July 2026' */
function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export default function RecurringIncomeScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { cashAccounts } = useCash();
  const {
    recurringIncomes,
    addRecurringIncome,
    updateRecurringIncome,
    removeRecurringIncome,
  } = useRecurringIncome();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const [name, setName] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [cashAccountId, setCashAccountId] = useState('');
  const [creditDayRaw, setCreditDayRaw] = useState('25');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState(true);

  const selectedAccount = cashAccounts.find(a => a.id === cashAccountId);

  const resetForm = useCallback(() => {
    setName('');
    setAmountRaw('');
    setCurrency('EGP');
    setCashAccountId('');
    setCreditDayRaw('25');
    setStartDate(todayISO());
    setEndDate('');
    setActive(true);
    setEditingId(null);
    setShowForm(false);
  }, []);

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (inc: RecurringIncome) => {
    setEditingId(inc.id);
    setName(inc.name);
    setAmountRaw(String(inc.amount));
    setCurrency(inc.currency);
    setCashAccountId(inc.cashAccountId);
    setCreditDayRaw(String(inc.creditDay));
    setStartDate(inc.startDate);
    setEndDate(inc.endDate ?? '');
    setActive(inc.active);
    setShowForm(true);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    const amount = parseAmount(amountRaw);
    const creditDay = Math.min(31, Math.max(1, parseInt(creditDayRaw, 10) || 1));

    if (!trimmed) {
      Alert.alert(t.incomeName, t.incomeNameError);
      return;
    }
    if (amount <= 0) {
      Alert.alert(t.amount, t.incomeAmountError);
      return;
    }
    if (!cashAccountId) {
      Alert.alert(t.depositInto, t.incomeAccountError);
      return;
    }

    impact(Haptics.ImpactFeedbackStyle.Light);

    if (editingId) {
      const existing = recurringIncomes.find(r => r.id === editingId);
      if (!existing) return;
      await updateRecurringIncome({
        ...existing,
        name: trimmed,
        amount,
        currency,
        cashAccountId,
        creditDay,
        startDate,
        endDate: endDate || undefined,
        active,
      });
    } else {
      await addRecurringIncome({
        id: generateId(),
        name: trimmed,
        amount,
        currency,
        cashAccountId,
        creditDay,
        startDate,
        endDate: endDate || undefined,
        active,
        lastProcessedMonth: null,
        createdAt: new Date().toISOString(),
      });
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (Platform.OS === 'web') {
      setPendingDeleteId(id);
      return;
    }
    Alert.alert(t.deleteRecurringIncome, t.deleteRecurringIncomeConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          impact(Haptics.ImpactFeedbackStyle.Medium);
          removeRecurringIncome(id);
        },
      },
    ]);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    impact(Haptics.ImpactFeedbackStyle.Medium);
    removeRecurringIncome(id);
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        {/* ── Header ── */}
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => { if (showForm) resetForm(); else router.back(); }}
            hitSlop={8}
          >
            <Feather name="chevron-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            {showForm
              ? (editingId ? t.editRecurringIncome : t.addRecurringIncome)
              : t.recurringIncome}
          </Text>
          {!showForm ? (
            <TouchableOpacity onPress={openAdd} hitSlop={8}>
              <Feather name="plus" size={22} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 22 }} />
          )}
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]}
            keyboardShouldPersistTaps="handled"
          >
            {!showForm ? (
              /* ── LIST ── */
              recurringIncomes.length === 0 ? (
                <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[s.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                    <Feather name="repeat" size={30} color={colors.primary} />
                  </View>
                  <Text style={[s.emptyTitle, { color: colors.text }]}>{t.noRecurringIncomes}</Text>
                  <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.noRecurringIncomesHint}</Text>
                  <TouchableOpacity
                    style={[s.emptyBtn, { backgroundColor: colors.primary }]}
                    onPress={openAdd}
                    activeOpacity={0.85}
                  >
                    <Feather name="plus" size={16} color={colors.primaryForeground} />
                    <Text style={[s.emptyBtnText, { color: colors.primaryForeground }]}>{t.addRecurringIncome}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.list}>
                  {recurringIncomes.map(inc => (
                    <SwipeToDelete key={inc.id} onDelete={() => handleDelete(inc.id)}>
                      <TouchableOpacity
                        style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => openEdit(inc)}
                        activeOpacity={0.85}
                      >
                        <View style={[s.cardIcon, { backgroundColor: colors.primary + '18' }]}>
                          <Feather name="repeat" size={18} color={colors.primary} />
                        </View>
                        <View style={s.cardBody}>
                          <Text style={[s.cardName, { color: colors.text }]} numberOfLines={1}>
                            {inc.name}
                          </Text>
                          <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {inc.amount.toLocaleString('en-EG', { maximumFractionDigits: 0 })} {inc.currency}
                            {' · '}{t.monthlyOnDay} {inc.creditDay}
                          </Text>
                          <Text style={[s.cardAccount, { color: colors.mutedForeground }]} numberOfLines={1}>
                            → {cashAccounts.find(a => a.id === inc.cashAccountId)?.accountName ?? '—'}
                          </Text>
                          {(inc.transactions?.length ?? 0) > 0 ? (
                            <Text style={[s.cardLastCredited, { color: colors.mutedForeground }]} numberOfLines={1}>
                              {t.lastCredited}: {formatMonth(inc.transactions![inc.transactions!.length - 1].month)}
                            </Text>
                          ) : (
                            <Text style={[s.cardLastCredited, { color: colors.mutedForeground, opacity: 0.6 }]} numberOfLines={1}>
                              {t.notYetCredited}
                            </Text>
                          )}
                        </View>
                        <View style={s.cardSideCol}>
                          <View style={[s.badge, {
                            backgroundColor: inc.active ? colors.primary + '18' : colors.muted,
                          }]}>
                            <Text style={[s.badgeText, {
                              color: inc.active ? colors.primary : colors.mutedForeground,
                            }]}>
                              {inc.active ? t.active : t.paused}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[s.deleteBtn, { backgroundColor: colors.red + '12' }]}
                            onPress={() => handleDelete(inc.id)}
                            hitSlop={8}
                          >
                            <Feather name="trash-2" size={13} color={colors.red} />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </SwipeToDelete>
                  ))}
                </View>
              )
            ) : (
              /* ── FORM ── */
              <View style={s.form}>

                {/* Income Name */}
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.incomeName}</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={name}
                    onChangeText={setName}
                    placeholder={t.incomeNamePlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="next"
                  />
                </View>

                {/* Amount */}
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.amount}</Text>
                  <AmountInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={amountRaw}
                    onChangeText={setAmountRaw}
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                {/* Currency */}
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.assetCurrency}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                    {CURRENCIES.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[s.chip, {
                          backgroundColor: currency === c ? colors.primary : colors.input,
                          borderColor: currency === c ? colors.primary : colors.border,
                        }]}
                        onPress={() => { setCurrency(c); setCashAccountId(''); }}
                      >
                        <Text style={[s.chipText, { color: currency === c ? colors.primaryForeground : colors.text }]}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Deposit Into */}
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.depositInto}</Text>
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
                      <Text
                        style={[s.pickerText, { color: cashAccountId ? colors.text : colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {selectedAccount?.accountName ?? t.selectAccount}
                      </Text>
                      <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Credit Day */}
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.creditDay}</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={creditDayRaw}
                    onChangeText={v => setCreditDayRaw(v.replace(/[^0-9]/g, ''))}
                    onBlur={() => {
                      const n = parseInt(creditDayRaw, 10);
                      if (!n || n < 1) setCreditDayRaw('1');
                      else if (n > 31) setCreditDayRaw('31');
                      else setCreditDayRaw(String(n));
                    }}
                    placeholder="25"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                  />
                  <Text style={[s.hint, { color: colors.mutedForeground }]}>{t.creditDayHint}</Text>
                </View>

                {/* Start Date */}
                <View style={s.field}>
                  <DatePickerField label={t.startDate} value={startDate} onChange={setStartDate} maxDate={new Date()} />
                </View>

                {/* End Date */}
                <View style={s.field}>
                  <DatePickerField
                    label={t.endDateOptional}
                    value={endDate}
                    onChange={setEndDate}
                    onClear={() => setEndDate('')}
                    placeholder={t.noEndDate}
                  />
                </View>

                {/* Active toggle */}
                <View style={[s.toggleRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Text style={[s.toggleLabel, { color: colors.text }]}>{t.active}</Text>
                  <Switch
                    value={active}
                    onValueChange={setActive}
                    trackColor={{ false: colors.muted, true: colors.primary + 'AA' }}
                    thumbColor={active ? colors.primary : colors.mutedForeground}
                  />
                </View>

                {/* Credit History (edit mode only) */}
                {editingId && (() => {
                  const editing = recurringIncomes.find(r => r.id === editingId);
                  const txs = editing?.transactions ?? [];
                  return (
                    <View style={[s.historySection, { borderColor: colors.border, backgroundColor: colors.card }]}>
                      <View style={s.historyHeader}>
                        <Feather name="clock" size={14} color={colors.mutedForeground} />
                        <Text style={[s.historyTitle, { color: colors.mutedForeground }]}>{t.creditHistory}</Text>
                      </View>
                      {txs.length === 0 ? (
                        <Text style={[s.historyEmpty, { color: colors.mutedForeground }]}>{t.noCreditHistory}</Text>
                      ) : (
                        [...txs].reverse().map((tx, i) => (
                          <View key={`${tx.month}-${i}`} style={[s.historyRow, i < txs.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                            <Text style={[s.historyMonth, { color: colors.text }]}>{formatMonth(tx.month)}</Text>
                            <Text style={[s.historyAmount, { color: colors.green }]}>
                              +{tx.amount.toLocaleString('en-EG', { maximumFractionDigits: 0 })} {editing!.currency}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  );
                })()}

                {/* Action buttons */}
                <View style={s.btns}>
                  <TouchableOpacity
                    style={[s.btnCancel, { backgroundColor: colors.muted }]}
                    onPress={resetForm}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.btnCancelText, { color: colors.text }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btnSave, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.btnSaveText, { color: colors.primaryForeground }]}>{t.saveIncome}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Account Picker Modal ── */}
        <Modal
          visible={showAccountPicker}
          animationType="slide"
          transparent
          onRequestClose={() => setShowAccountPicker(false)}
        >
          <TouchableOpacity
            style={s.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowAccountPicker(false)}
          >
            <View style={[s.pickerSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.pickerSheetTitle, { color: colors.text }]}>{t.selectAccount}</Text>
              {cashAccounts.length === 0 ? (
                <Text style={[s.pickerOptionSub, { color: colors.mutedForeground, textAlign: 'center', paddingVertical: 16 }]}>
                  {t.noCashAccounts}
                </Text>
              ) : (
                cashAccounts.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={[s.pickerOption, {
                      borderColor: colors.border,
                      backgroundColor: cashAccountId === a.id ? colors.primary + '14' : 'transparent',
                    }]}
                    onPress={() => {
                      setCashAccountId(a.id);
                      setCurrency(a.currency);
                      setShowAccountPicker(false);
                    }}
                  >
                    <Text style={[s.pickerOptionText, {
                      color: cashAccountId === a.id ? colors.primary : colors.text,
                    }]}>
                      {a.accountName}
                    </Text>
                    <Text style={[s.pickerOptionSub, { color: colors.mutedForeground }]}>{a.currency}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Delete Confirm Modal (web fallback) ── */}
        <Modal
          visible={!!pendingDeleteId}
          animationType="fade"
          transparent
          onRequestClose={() => setPendingDeleteId(null)}
        >
          <View style={s.confirmOverlay}>
            <View style={[s.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.confirmTitle, { color: colors.text }]}>{t.deleteRecurringIncome}</Text>
              <Text style={[s.confirmMsg, { color: colors.mutedForeground }]}>{t.deleteRecurringIncomeConfirm}</Text>
              <View style={s.confirmRow}>
                <TouchableOpacity
                  style={[s.confirmBtn, { backgroundColor: colors.muted }]}
                  onPress={() => setPendingDeleteId(null)}
                >
                  <Text style={[s.confirmBtnText, { color: colors.text }]}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmBtn, { backgroundColor: colors.red }]}
                  onPress={confirmDelete}
                >
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
  cardAccount:     { fontSize: 12, fontFamily: 'Inter_400Regular' },
  cardLastCredited:{ fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  badge:           { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:   { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  cardSideCol: { alignItems: 'flex-end', gap: 8 },
  deleteBtn:   { borderRadius: 8, padding: 6 },

  form:    { gap: 16, paddingTop: 8 },
  field:   { gap: 6 },
  label:   { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  input:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  hint:    { fontSize: 11, fontFamily: 'Inter_400Regular' },
  chips:   { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip:    { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  noAccounts:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 14 },
  noAccountsText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },

  picker:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  pickerText: { fontSize: 15, fontFamily: 'Inter_400Regular', flex: 1 },

  toggleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  toggleLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },

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

  historySection:  { borderRadius: 14, borderWidth: 1, padding: 14, gap: 0 },
  historyHeader:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  historyTitle:    { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3, textTransform: 'uppercase' },
  historyEmpty:    { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 8 },
  historyRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  historyMonth:    { fontSize: 14, fontFamily: 'Inter_500Medium' },
  historyAmount:   { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  confirmOverlay:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
  confirmCard:     { width: '100%', borderRadius: 18, borderWidth: 1, padding: 24, gap: 10 },
  confirmTitle:    { fontSize: 16, fontFamily: 'Inter_700Bold' },
  confirmMsg:      { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  confirmRow:      { flexDirection: 'row', gap: 10, marginTop: 4 },
  confirmBtn:      { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  confirmBtnText:  { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
