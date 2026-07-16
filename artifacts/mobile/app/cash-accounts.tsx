import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { BanknoteIcon } from '@/components/BanknoteIcon';
import { DatePickerField } from '@/components/DatePickerField';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useCash } from '@/context/CashContext';
import { CashAccount, CashAccountType } from '@/types';
import { parseAmount, formatAmountInput } from '@/utils/parseAmount';

const CURRENCIES_DEFAULT = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];
const CURRENCIES_FOREIGN  = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP'];

const CURRENCY_FLAGS: Record<string, string> = {
  EGP: '🇪🇬', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', SAR: '🇸🇦', AED: '🇦🇪',
};

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}


export default function CashAccountsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { cashAccounts, addCashAccount, updateCashAccount, removeCashAccount } = useCash();
  const { impact, notify } = useHaptic();

  const { openAdd: openAddParam } = useLocalSearchParams<{ openAdd?: string }>();

  const [showForm, setShowForm] = useState(openAddParam === '1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cashType, setCashType] = useState<CashAccountType>('bank');
  const [accountName, setAccountName] = useState('');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [dateAdded, setDateAdded] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const nameInputRef = useRef<TextInput>(null);
  const cardAnims = useRef<Record<CashAccountType, Animated.Value>>({
    bank: new Animated.Value(1),
    cash_home: new Animated.Value(1),
    foreign_currency: new Animated.Value(1),
  }).current;

  const CASH_TYPES: { key: CashAccountType; label: string }[] = [
    { key: 'bank',             label: t.bankAccount },
    { key: 'cash_home',        label: t.cashAtHome },
    { key: 'foreign_currency', label: t.foreignCurrency },
  ];

  const TYPE_ICONS: Record<CashAccountType, keyof typeof Feather.glyphMap> = {
    bank: 'credit-card',
    cash_home: 'dollar-sign',
    foreign_currency: 'globe',
  };

  const TYPE_LABELS: Record<CashAccountType, string> = {
    bank: t.bankAccount,
    cash_home: t.cashAtHome,
    foreign_currency: t.foreignCurrency,
  };

  const NAME_PLACEHOLDER: Record<CashAccountType, string> = {
    bank: t.cashNamePlaceholderBank,
    cash_home: t.cashNamePlaceholderCash,
    foreign_currency: t.cashNamePlaceholderForeign,
  };

  const BALANCE_HINT: Record<CashAccountType, string> = {
    bank: t.cashHintBank,
    cash_home: t.cashHintCash,
    foreign_currency: t.cashHintForeign,
  };

  const currencies = cashType === 'foreign_currency' ? CURRENCIES_FOREIGN : CURRENCIES_DEFAULT;

  const selectType = (key: CashAccountType) => {
    Animated.sequence([
      Animated.timing(cardAnims[key], { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(cardAnims[key], { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    if (key === 'foreign_currency' && cashType !== 'foreign_currency') {
      setCurrency('USD');
    } else if (key !== 'foreign_currency' && cashType === 'foreign_currency') {
      setCurrency('EGP');
    }
    setCashType(key);
    setTimeout(() => nameInputRef.current?.focus(), 150);
  };

  const resetForm = () => {
    setEditingId(null);
    setCashType('bank');
    setAccountName('');
    setBalance('');
    setCurrency('EGP');
    setDateAdded(new Date().toISOString().split('T')[0]);
    setNotes('');
  };

  const openAdd = () => {
    impact();
    resetForm();
    setShowForm(true);
  };

  const openEdit = (a: CashAccount) => {
    impact();
    setEditingId(a.id);
    setCashType(a.type);
    setAccountName(a.accountName);
    setBalance(formatAmountInput(String(a.balance)));
    setCurrency(a.currency);
    setDateAdded(a.dateAdded ?? new Date().toISOString().split('T')[0]);
    setNotes(a.notes ?? '');
    setShowForm(true);
  };

  const handleSave = async () => {
    const parsedBalance = parseAmount(balance);
    if (!accountName.trim() || !balance.trim() || isNaN(parsedBalance)) {
      Alert.alert(t.enterAccountDetails);
      return;
    }
    const account: CashAccount = {
      id: editingId ?? generateId(),
      type: cashType,
      accountName: accountName.trim(),
      balance: parsedBalance,
      currency,
      dateAdded,
      notes: notes.trim() || undefined,
    };
    if (editingId) {
      await updateCashAccount(account);
    } else {
      await addCashAccount(account);
    }
    notify();
    setShowForm(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (Platform.OS === 'web') {
      setPendingDeleteId(id);
      return;
    }
    Alert.alert(t.deleteCashAccount, t.deleteCashAccountConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          impact(Haptics.ImpactFeedbackStyle.Medium);
          removeCashAccount(id);
        },
      },
    ]);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    impact(Haptics.ImpactFeedbackStyle.Medium);
    removeCashAccount(id);
  };

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  // Group totals by currency so each currency shows its native amount.
  const byCurrency = cashAccounts.reduce<Record<string, number>>((acc, a) => {
    const bal = Number(a.balance) || 0;
    acc[a.currency] = (acc[a.currency] ?? 0) + bal;
    return acc;
  }, {});
  const labelStyle = [styles.label, { color: colors.mutedForeground }];
  const inputStyle = [styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.modalHeader, {
        paddingTop: topInsets + 10,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }]}>
        <TouchableOpacity
          onPress={() => {
            if (showForm) { setShowForm(false); resetForm(); }
            else { router.back(); }
          }}
          hitSlop={12}
        >
          <Feather name={showForm ? 'chevron-left' : 'x'} size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[styles.modalTitle, { color: colors.text }]}>
          {showForm ? (editingId ? t.editCashAccount : t.addCashAccount) : t.cashAccounts}
        </Text>
        {showForm ? (
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.saveBtnText, { color: colors.primary }]}>{t.save}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={openAdd} hitSlop={12}>
            <Feather name="plus" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botInsets + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showForm ? (
          <>
            {/* ── Account Type ─────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={labelStyle}>{t.cashAccountType}</Text>
              <View style={styles.typeGrid}>
                {CASH_TYPES.map(ct => {
                  const active = cashType === ct.key;
                  return (
                    <Animated.View
                      key={ct.key}
                      style={{ flex: 1, transform: [{ scale: cardAnims[ct.key] }] }}
                    >
                      <TouchableOpacity
                        style={[styles.typeCard, {
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primary + '18' : colors.card,
                        }]}
                        onPress={() => selectType(ct.key)}
                        activeOpacity={0.85}
                      >
                        {active && (
                          <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
                            <Feather name="check" size={9} color={colors.primaryForeground} />
                          </View>
                        )}
                        {ct.key === 'cash_home' ? (
                          <BanknoteIcon size={20} color={active ? colors.primary : colors.mutedForeground} />
                        ) : (
                          <Feather name={TYPE_ICONS[ct.key]} size={20} color={active ? colors.primary : colors.mutedForeground} />
                        )}
                        <Text style={[styles.typeLabel, { color: active ? colors.primary : colors.text }]}>{ct.label}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </View>

            {/* ── Account Name ─────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={labelStyle}>{t.accountName}</Text>
              <TextInput
                ref={nameInputRef}
                style={inputStyle}
                placeholder={NAME_PLACEHOLDER[cashType]}
                placeholderTextColor={colors.mutedForeground}
                value={accountName}
                onChangeText={setAccountName}
              />
            </View>

            {/* ── Balance ──────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={labelStyle}>{t.balance}</Text>
              <TextInput
                style={inputStyle}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                value={balance}
                onChangeText={(v) => setBalance(formatAmountInput(v))}
              />
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>{BALANCE_HINT[cashType]}</Text>
            </View>

            {/* ── Currency ─────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={labelStyle}>{t.accountCurrency}</Text>
              <View style={styles.chips}>
                {currencies.map(c => {
                  const active = currency === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary + '10' : colors.card,
                      }]}
                      onPress={() => setCurrency(c)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.chipFlag}>{CURRENCY_FLAGS[c]}</Text>
                      <Text style={[styles.chipText, { color: active ? colors.primary : colors.text }]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Date Added ──────────────────────────────────── */}
            <View style={styles.section}>
              <DatePickerField label={t.dateAdded} value={dateAdded} onChange={setDateAdded} />
            </View>

            {/* ── Notes ───────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={labelStyle}>{t.cashNotes}</Text>
              <TextInput
                style={[inputStyle, styles.notesInput]}
                placeholder={t.cashNotesPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                value={notes}
                onChangeText={v => setNotes(v.slice(0, 200))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </>
        ) : (
          <>
            {cashAccounts.length > 0 && (
              <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>{t.totalCash}</Text>
                {Object.entries(byCurrency).map(([cur, total]) => (
                  <Text key={cur} style={[styles.totalValue, { color: colors.text }]}>
                    {(total).toLocaleString('en-EG', { maximumFractionDigits: 0 })} {cur}
                  </Text>
                ))}
              </View>
            )}

            {cashAccounts.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.emptyIconWrap, { backgroundColor: colors.primary + '14' }]}>
                  <BanknoteIcon size={30} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noCashAccounts}</Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{t.tapToAddCash}</Text>
                <TouchableOpacity
                  style={[styles.inlineBtn, { backgroundColor: colors.primary }]}
                  onPress={openAdd}
                  activeOpacity={0.85}
                >
                  <Feather name="plus" size={17} color={colors.primaryForeground} />
                  <Text style={[styles.inlineBtnText, { color: colors.primaryForeground }]}>{t.addCashAccount}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.list}>
                {cashAccounts.map(a => (
                  <SwipeToDelete
                    key={a.id}
                    onDelete={() => { impact(Haptics.ImpactFeedbackStyle.Medium); removeCashAccount(a.id); }}
                    confirmTitle={t.deleteCashAccount}
                    confirmMessage={t.deleteCashAccountConfirm}
                    confirmLabel={t.delete}
                    cancelLabel={t.cancel}
                  >
                  <View
                    style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[styles.accountIconWrap, { backgroundColor: colors.primary + '16' }]}>
                      {a.type === 'cash_home' ? (
                        <BanknoteIcon size={18} color={colors.primary} />
                      ) : (
                        <Feather name={TYPE_ICONS[a.type]} size={18} color={colors.primary} />
                      )}
                    </View>
                    <View style={styles.accountInfo}>
                      <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>{a.accountName}</Text>
                      <Text style={[styles.accountType, { color: colors.mutedForeground }]}>{TYPE_LABELS[a.type]}</Text>
                      <Text style={[styles.accountBalance, { color: colors.text }]} numberOfLines={1}>
                        {(Number(a.balance) || 0).toLocaleString('en-EG', { maximumFractionDigits: 0 })} {a.currency}
                      </Text>
                    </View>
                    <View style={styles.accountActions}>
                      <TouchableOpacity
                        onPress={() => openEdit(a)}
                        style={[styles.actionBtn, { backgroundColor: colors.primary + '14' }]}
                        hitSlop={8}
                        activeOpacity={0.7}
                      >
                        <Feather name="edit-2" size={14} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(a.id)}
                        style={[styles.actionBtn, { backgroundColor: colors.red + '12' }]}
                        hitSlop={8}
                        activeOpacity={0.7}
                      >
                        <Feather name="trash-2" size={14} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  </SwipeToDelete>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={!!pendingDeleteId} animationType="fade" transparent onRequestClose={() => setPendingDeleteId(null)}>
        <View style={confirmStyles.overlay}>
          <View style={[confirmStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[confirmStyles.title, { color: colors.text }]}>{t.deleteCashAccount}</Text>
            <Text style={[confirmStyles.msg, { color: colors.mutedForeground }]}>{t.deleteCashAccountConfirm}</Text>
            <View style={confirmStyles.row}>
              <TouchableOpacity
                onPress={() => setPendingDeleteId(null)}
                style={[confirmStyles.btn, { backgroundColor: colors.muted }]}
                activeOpacity={0.75}
              >
                <Text style={[confirmStyles.btnTxt, { color: colors.mutedForeground }]}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={[confirmStyles.btn, { backgroundColor: colors.red + '18', borderWidth: 1, borderColor: colors.red + '40' }]}
                activeOpacity={0.75}
              >
                <Text style={[confirmStyles.btnTxt, { color: colors.red, fontFamily: 'Inter_600SemiBold' }]}>{t.delete}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 4 },
  section: { marginBottom: 16 },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8, letterSpacing: 0.3 },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6, lineHeight: 17 },
  typeGrid: { flexDirection: 'row', gap: 10 },
  typeCard: {
    flex: 1, borderRadius: 12, borderWidth: 1.5, padding: 14,
    alignItems: 'center', gap: 6,
  },
  checkmark: {
    position: 'absolute', top: 7, right: 7,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  typeLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  chipFlag: { fontSize: 16 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  notesInput: { minHeight: 80, paddingTop: 12 },
  totalCard: {
    borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 16,
    alignItems: 'center', gap: 6,
  },
  totalLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  totalValue: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  list: { gap: 10 },
  accountCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  accountIconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  accountInfo: { flex: 1, gap: 3 },
  accountName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  accountType: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  accountBalance: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: -0.2, marginTop: 1 },
  accountActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtn: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  empty: {
    borderRadius: 24, padding: 40, borderWidth: 1,
    alignItems: 'center', gap: 10, marginTop: 20,
  },
  emptyIconWrap: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  inlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 16, marginTop: 8,
  },
  inlineBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});

const confirmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { borderRadius: 20, borderWidth: 1, padding: 24, width: '100%', maxWidth: 360, gap: 16 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  msg: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnTxt: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
