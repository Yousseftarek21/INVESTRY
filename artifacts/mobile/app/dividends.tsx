import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerField } from '@/components/DatePickerField';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useCash } from '@/context/CashContext';
import { useHoldings } from '@/context/HoldingsContext';
import { useDividends } from '@/context/DividendsContext';
import { parseAmount } from '@/utils/parseAmount';
import { AmountInput } from '@/components/AmountInput';
import { Dividend, StockHolding } from '@/types';

const CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];

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

export default function DividendsScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { cashAccounts, updateCashAccount } = useCash();
  const { holdings } = useHoldings();
  const { dividends, addDividend, updateDividend, removeDividend } = useDividends();

  const stockHoldings = useMemo(
    () => holdings.filter((h): h is StockHolding => h.type === 'stock'),
    [holdings],
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const [symbol, setSymbol] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [holdingId, setHoldingId] = useState<string | undefined>(undefined);
  const [amountRaw, setAmountRaw] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [cashAccountId, setCashAccountId] = useState('');

  const selectedAccount = cashAccounts.find(a => a.id === cashAccountId);
  const totalReceived = useMemo(
    () => dividends.filter(d => d.currency === 'EGP').reduce((sum, d) => sum + d.amount, 0),
    [dividends],
  );

  const resetForm = useCallback(() => {
    setSymbol('');
    setCompanyName('');
    setHoldingId(undefined);
    setAmountRaw('');
    setCurrency('EGP');
    setDate(todayISO());
    setNote('');
    setCashAccountId('');
    setEditingId(null);
    setShowForm(false);
  }, []);

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (d: Dividend) => {
    setEditingId(d.id);
    setSymbol(d.symbol);
    setCompanyName(d.companyName ?? '');
    setHoldingId(d.holdingId);
    setAmountRaw(String(d.amount));
    setCurrency(d.currency);
    setDate(d.date);
    setNote(d.note ?? '');
    setCashAccountId(d.cashAccountId ?? '');
    setShowForm(true);
  };

  const pickHolding = (h: StockHolding) => {
    setSymbol(h.symbol);
    setCompanyName(h.companyName);
    setHoldingId(h.id);
  };

  const handleSave = async () => {
    const trimmedSymbol = symbol.trim().toUpperCase();
    const amount = parseAmount(amountRaw);

    if (!trimmedSymbol) {
      Alert.alert(t.dividendSymbol, t.dividendSymbolError);
      return;
    }
    if (amount <= 0) {
      Alert.alert(t.amount, t.incomeAmountError);
      return;
    }

    impact(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (editingId) {
        const existing = dividends.find(d => d.id === editingId);
        if (!existing) return;
        await updateDividend({
          ...existing,
          symbol: trimmedSymbol,
          companyName: companyName.trim() || undefined,
          holdingId,
          amount,
          currency,
          date,
          note: note.trim() || undefined,
          cashAccountId: cashAccountId || undefined,
        });
      } else {
        await addDividend({
          id: generateId(),
          symbol: trimmedSymbol,
          companyName: companyName.trim() || undefined,
          holdingId,
          amount,
          currency,
          date,
          note: note.trim() || undefined,
          cashAccountId: cashAccountId || undefined,
          createdAt: new Date().toISOString(),
        });
        // One-time bump, not tracked ongoing — same "user already knows the
        // delta" pattern as a manual cash balance edit, not a recurring
        // credit processor (dividends aren't periodic on a fixed schedule).
        if (cashAccountId) {
          const account = cashAccounts.find(a => a.id === cashAccountId);
          if (account) {
            updateCashAccount({ ...account, balance: (Number(account.balance) || 0) + amount });
          }
        }
      }
      resetForm();
    } catch {
      Alert.alert(t.couldNotSave, t.couldNotOpenLinkDesc);
    }
  };

  const handleDelete = (id: string) => {
    if (Platform.OS === 'web') { setPendingDeleteId(id); return; }
    Alert.alert(t.deleteDividend, t.deleteDividendConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => { impact(Haptics.ImpactFeedbackStyle.Medium); removeDividend(id); },
      },
    ]);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    impact(Haptics.ImpactFeedbackStyle.Medium);
    removeDividend(id);
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const sorted = useMemo(
    () => [...dividends].sort((a, b) => b.date.localeCompare(a.date)),
    [dividends],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { if (showForm) resetForm(); else router.back(); }} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            {showForm ? (editingId ? t.editDividend : t.addDividend) : t.dividendsTitle}
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
              dividends.length === 0 ? (
                <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[s.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                    <Feather name="pie-chart" size={30} color={colors.primary} />
                  </View>
                  <Text style={[s.emptyTitle, { color: colors.text }]}>{t.noDividends}</Text>
                  <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.noDividendsHint}</Text>
                  <TouchableOpacity style={[s.emptyBtn, { backgroundColor: colors.primary }]} onPress={openAdd} activeOpacity={0.85}>
                    <Feather name="plus" size={16} color={colors.primaryForeground} />
                    <Text style={[s.emptyBtnText, { color: colors.primaryForeground }]}>{t.addDividend}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={[s.summary, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '30' }]}>
                    <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>{t.totalReceived}</Text>
                    <Text style={[s.summaryValue, { color: colors.text }]}>
                      {totalReceived.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
                    </Text>
                  </View>
                  <View style={s.list}>
                    {sorted.map(d => (
                      <SwipeToDelete key={d.id} onDelete={() => handleDelete(d.id)}>
                        <TouchableOpacity
                          style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => openEdit(d)}
                          activeOpacity={0.85}
                        >
                          <View style={[s.cardIcon, { backgroundColor: colors.green + '18' }]}>
                            <Feather name="pie-chart" size={18} color={colors.green} />
                          </View>
                          <View style={s.cardBody}>
                            <Text style={[s.cardName, { color: colors.text }]} numberOfLines={1}>
                              {d.symbol}{d.companyName ? ` · ${d.companyName}` : ''}
                            </Text>
                            <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                              {formatDate(d.date)}{d.note ? ` · ${d.note}` : ''}
                            </Text>
                          </View>
                          <View style={s.cardSideCol}>
                            <Text style={[s.cardAmount, { color: colors.green }]}>
                              +{d.amount.toLocaleString('en-EG', { maximumFractionDigits: 0 })} {d.currency}
                            </Text>
                            {/* Plain RN TouchableOpacity, deliberately — this and
                                the card wrapper were briefly react-native-gesture-handler's
                                own TouchableOpacity (to fix swipe-vs-tap on the card),
                                but nesting native gesture-handler buttons two levels
                                deep inside Swipeable left this button's tap
                                registering (a visible press) without ever
                                completing — reproduced live in recurring-income.tsx,
                                reverted here for the same reason before it shipped
                                broken. See recurring-income.tsx's own delete button
                                for the full explanation. */}
                            <TouchableOpacity
                              style={[s.deleteBtn, { backgroundColor: colors.red + '12' }]}
                              onPress={() => handleDelete(d.id)}
                              hitSlop={8}
                            >
                              <Feather name="trash-2" size={13} color={colors.red} />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      </SwipeToDelete>
                    ))}
                  </View>
                </>
              )
            ) : (
              <View style={s.form}>

                {stockHoldings.length > 0 && (
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.mutedForeground }]}>{t.pickFromHoldings}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                      {stockHoldings.map(h => (
                        <TouchableOpacity
                          key={h.id}
                          style={[s.chip, {
                            backgroundColor: holdingId === h.id ? colors.primary : colors.input,
                            borderColor: holdingId === h.id ? colors.primary : colors.border,
                          }]}
                          onPress={() => pickHolding(h)}
                        >
                          <Text style={[s.chipText, { color: holdingId === h.id ? colors.primaryForeground : colors.text }]}>
                            {h.symbol}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.dividendSymbol}</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={symbol}
                    onChangeText={v => { setSymbol(v); setHoldingId(undefined); }}
                    placeholder="COMI"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="characters"
                  />
                </View>

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
                        onPress={() => setCurrency(c)}
                      >
                        <Text style={[s.chipText, { color: currency === c ? colors.primaryForeground : colors.text }]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={s.field}>
                  <DatePickerField label={t.dividendDate} value={date} onChange={setDate} maxDate={new Date()} />
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
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.dividendNoteOptional}</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={note}
                    onChangeText={setNote}
                    placeholder={t.dividendNotePlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={s.btns}>
                  <TouchableOpacity style={[s.btnCancel, { backgroundColor: colors.muted }]} onPress={resetForm} activeOpacity={0.8}>
                    <Text style={[s.btnCancelText, { color: colors.text }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btnSave, { backgroundColor: colors.primary }]} onPress={handleSave} activeOpacity={0.85}>
                    <Text style={[s.btnSaveText, { color: colors.primaryForeground }]}>{t.saveDividend}</Text>
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
              <Text style={[s.confirmTitle, { color: colors.text }]}>{t.deleteDividend}</Text>
              <Text style={[s.confirmMsg, { color: colors.mutedForeground }]}>{t.deleteDividendConfirm}</Text>
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
