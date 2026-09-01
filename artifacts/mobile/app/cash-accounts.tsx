import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { backChevron, forwardChevron } from '@/utils/rtl';
import { BanknoteIcon } from '@/components/BanknoteIcon';
import { DatePickerField } from '@/components/DatePickerField';
import { AmountInput } from '@/components/AmountInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useCash } from '@/context/CashContext';
import { useRecurringIncome } from '@/context/RecurringIncomeContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { CashAccount, CashAccountType, IncomeKind, RecurringIncome } from '@/types';
import { parseAmount, toWesternDigits } from '@/utils/parseAmount';
import { fmtCompact } from '@/utils/formatNumber';
import { tradingDayLabel, tradingDaysAgo } from '@/utils/cairoDate';
import { useMarketPrices } from '@/hooks/usePrices';
import { useCashBalanceUpdates } from '@/hooks/useCashBalanceUpdates';
import { useCashAccountsTodayChanges } from '@/hooks/useCashAccountsTodayChanges';
import { useRecentCashUpdates } from '@/hooks/useRecentCashUpdates';
import { useActivityLog } from '@/hooks/useActivityLog';

type EntryType = CashAccountType | 'recurring_income';

const FREE_LIMIT_CASH = 1;
// Recurring income is a Pro-only feature — same policy as recurring-income.tsx.
const FREE_LIMIT_INCOME = 0;
// A genuinely short at-a-glance preview — 8 (the old default) was high
// enough that ordinary usage (a handful of edits) never hit it, so "View
// all" never had a chance to appear at all. The dedicated history screen
// is where the fuller list actually lives now.
const RECENT_UPDATES_PREVIEW_LIMIT = 5;

const CURRENCIES_DEFAULT = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];
const CURRENCIES_FOREIGN  = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP'];

const CURRENCY_FLAGS: Record<string, string> = {
  EGP: '🇪🇬', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', SAR: '🇸🇦', AED: '🇦🇪',
};

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function CashAccountsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { cashAccounts, addCashAccount, updateCashAccount, removeCashAccount, transferBetweenAccounts } = useCash();
  const { data: prices } = useMarketPrices();
  const { recurringIncomes, addRecurringIncome, updateRecurringIncome, removeRecurringIncome } = useRecurringIncome();
  const { featuresUnlocked, isLoading: subLoading, showPaywall } = useSubscription();
  const { impact, notify } = useHaptic();

  const { openAdd: openAddParam, type: typeParam } = useLocalSearchParams<{ openAdd?: string; type?: string }>();

  const initialType: EntryType = typeParam === 'recurring_income' ? 'recurring_income' : 'bank';
  const [showForm, setShowForm] = useState(openAddParam === '1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditingIncome, setIsEditingIncome] = useState(false);

  // ── Cash account form state ───────────────────────────────────────────────
  const [entryType, setEntryType] = useState<EntryType>(initialType);
  const [accountName, setAccountName] = useState('');
  const [balance, setBalance] = useState('');
  // Captured when an existing account's edit form opens — the baseline the
  // live "+/- since last time" hint and the balance-update history log are
  // both computed against. Null while adding a new account (nothing to
  // diff against yet).
  const [editingOriginalBalance, setEditingOriginalBalance] = useState<number | null>(null);
  // Only meaningful while editingOriginalBalance is set (an existing
  // account) — 'add' is the default because most updates are "I got/spent
  // this much," not "let me recompute my whole balance." 'total' stays
  // available for whenever copying the bank app's number directly is easier.
  const [balanceEntryMode, setBalanceEntryMode] = useState<'add' | 'total'>('add');
  // 'add' mode's field (AmountInput) only ever holds a positive magnitude —
  // it shares the same clean/format helpers as every other amount field in
  // the app, none of which accept a minus sign. Direction is tracked here
  // instead, via its own +/- toggle, so a withdrawal is "tap minus, type
  // 200" rather than requiring the text field itself to parse a signed
  // number.
  const [addSign, setAddSign] = useState<1 | -1>(1);
  // Only the write path (logUpdate) is used here — per-account history
  // reads happen through useRecentCashUpdates below instead, which merges
  // every account's history into one feed rather than fetching one
  // account's history in isolation (which is all this hook call gives you).
  const { logUpdate: logBalanceUpdate } = useCashBalanceUpdates(null);
  const { todayChanges, isLoading: todayChangesLoading, refresh: refreshTodayChanges } = useCashAccountsTodayChanges();
  const { updates: recentUpdates, refresh: refreshRecentUpdates } = useRecentCashUpdates(cashAccounts, RECENT_UPDATES_PREVIEW_LIMIT);
  const { logActivity } = useActivityLog();
  const [currency, setCurrency] = useState('EGP');
  const [dateAdded, setDateAdded] = useState(todayISO());
  const [notes, setNotes] = useState('');

  // ── Recurring/pending income form state ───────────────────────────────────
  // incomeKind is independent of `entryType` — the type-grid tile stays a
  // single "Recurring Income" entry point (unchanged), and this toggle
  // (shown inside that form) picks which of the two IncomeKind shapes is
  // actually being created. Mirrors app/recurring-income.tsx's own toggle.
  const [incomeKind, setIncomeKind] = useState<IncomeKind>('recurring');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [creditDay, setCreditDay] = useState('25');
  const [startDate, setStartDate] = useState(todayISO());
  const [incomeExpectedDate, setIncomeExpectedDate] = useState('');
  const [depositAccountId, setDepositAccountId] = useState('');
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteIsIncome, setPendingDeleteIsIncome] = useState(false);

  // ── Transfer between accounts state ───────────────────────────────────────
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromId, setTransferFromId] = useState<string | null>(null);
  const [transferToId, setTransferToId] = useState<string | null>(null);
  const [transferAmountRaw, setTransferAmountRaw] = useState('');
  const [transferPicker, setTransferPicker] = useState<'from' | 'to' | null>(null);

  const nameInputRef = useRef<TextInput>(null);

  const ANIM_KEYS: EntryType[] = ['bank', 'cash_home', 'foreign_currency', 'recurring_income'];
  const cardAnims = useRef<Record<EntryType, Animated.Value>>({
    bank: new Animated.Value(1),
    cash_home: new Animated.Value(1),
    foreign_currency: new Animated.Value(1),
    recurring_income: new Animated.Value(1),
  }).current;

  const CASH_TYPES: { key: EntryType; label: string }[] = [
    { key: 'bank',             label: t.bankAccount },
    { key: 'cash_home',        label: t.cashAtHome },
    { key: 'foreign_currency', label: t.foreignCurrency },
  ];

  const TYPE_ICONS: Record<EntryType, keyof typeof Feather.glyphMap> = {
    bank: 'credit-card',
    cash_home: 'dollar-sign',
    foreign_currency: 'globe',
    recurring_income: 'repeat',
  };

  const TYPE_LABELS: Record<CashAccountType, string> = {
    bank: t.bankAccount,
    cash_home: t.cashAtHome,
    foreign_currency: t.foreignCurrency,
  };

  const NAME_PLACEHOLDER: Record<EntryType, string> = {
    bank: t.cashNamePlaceholderBank,
    cash_home: t.cashNamePlaceholderCash,
    foreign_currency: t.cashNamePlaceholderForeign,
    recurring_income: t.incomeNamePlaceholder,
  };

  const BALANCE_HINT: Record<CashAccountType, string> = {
    bank: t.cashHintBank,
    cash_home: t.cashHintCash,
    foreign_currency: t.cashHintForeign,
  };

  const currencies = entryType === 'foreign_currency' ? CURRENCIES_FOREIGN : CURRENCIES_DEFAULT;
  const depositAccount = cashAccounts.find(a => a.id === depositAccountId);

  const selectType = (key: EntryType) => {
    Animated.sequence([
      Animated.timing(cardAnims[key], { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(cardAnims[key], { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
    // Only seed a default when the currency the user is on isn't offered by
    // the type they're switching to. Blindly resetting to USD/EGP meant
    // picking "Foreign currency" → EUR → 20,000 and then switching to
    // "Bank" saved 20,000 EUR as 20,000 EGP — and currency is locked on
    // edit, so it couldn't be corrected afterwards.
    const nextCurrencies = key === 'foreign_currency' ? CURRENCIES_FOREIGN : CURRENCIES_DEFAULT;
    if (!nextCurrencies.includes(currency)) {
      setCurrency(key === 'foreign_currency' ? 'USD' : 'EGP');
    }
    setEntryType(key);
    if (key !== 'recurring_income') {
      setTimeout(() => nameInputRef.current?.focus(), 150);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setIsEditingIncome(false);
    setEntryType('bank');
    setAccountName('');
    setBalance('');
    setEditingOriginalBalance(null);
    setBalanceEntryMode('add');
    setAddSign(1);
    setCurrency('EGP');
    setDateAdded(todayISO());
    setNotes('');
    setIncomeKind('recurring');
    setIncomeAmount('');
    setCreditDay('25');
    setStartDate(todayISO());
    setIncomeExpectedDate('');
    setDepositAccountId('');
  };

  const openAdd = () => {
    impact();
    resetForm();
    setShowForm(true);
  };

  const openEdit = (a: CashAccount) => {
    impact();
    setEditingId(a.id);
    setIsEditingIncome(false);
    setEntryType(a.type);
    setAccountName(a.accountName);
    setBalance('');
    setBalanceEntryMode('add');
    setAddSign(1);
    setEditingOriginalBalance(a.balance);
    setCurrency(a.currency);
    setDateAdded(a.dateAdded ?? todayISO());
    setNotes(a.notes ?? '');
    setShowForm(true);
  };

  const switchBalanceMode = (mode: 'add' | 'total') => {
    if (mode === balanceEntryMode) return;
    impact();
    setBalanceEntryMode(mode);
    setAddSign(1);
    setBalance(mode === 'total' && editingOriginalBalance !== null ? String(editingOriginalBalance) : '');
  };

  const openEditIncome = (r: RecurringIncome) => {
    impact();
    setEditingId(r.id);
    setIsEditingIncome(true);
    setEntryType('recurring_income');
    setIncomeKind(r.kind ?? 'recurring');
    setAccountName(r.name);
    setIncomeAmount(String(r.amount));
    setCurrency(r.currency);
    setCreditDay(String(r.creditDay ?? 25));
    setStartDate(r.startDate);
    setIncomeExpectedDate(r.expectedDate ?? '');
    setDepositAccountId(r.cashAccountId ?? '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (entryType === 'recurring_income') {
      const isPendingIncome = incomeKind === 'pending';
      const parsedAmount = parseAmount(incomeAmount);
      if (!accountName.trim()) {
        Alert.alert(t.incomeName, t.enterIncomeName);
        return;
      }
      if (!incomeAmount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert(t.amount, t.enterValidMonthlyAmount);
        return;
      }
      // A pending entry has no destination account yet — that's chosen
      // later, when marked collected. Saving a recurring one with no
      // linked account produced a record the processor skips forever,
      // while the UI still showed it as configured.
      if (!isPendingIncome && !depositAccountId) {
        Alert.alert(t.depositInto, cashAccounts.length > 0 ? t.selectAccount : t.incomeNeedsAccountFirst);
        return;
      }
      if (!isEditingIncome && !subLoading && !featuresUnlocked && recurringIncomes.length >= FREE_LIMIT_INCOME) {
        showPaywall();
        return;
      }
      const day = Math.min(Math.max(parseInt(creditDay) || 25, 1), 31);
      const existingIncome = isEditingIncome ? recurringIncomes.find(r => r.id === editingId) : undefined;
      const income: RecurringIncome = {
        // Spread the stored record first so fields this form doesn't edit —
        // endDate and the transactions audit trail — survive. updateRecurring
        // Income replaces wholesale, so rebuilding from only the form's
        // fields silently dropped them: an income with a December endDate
        // would start crediting forever after an unrelated name change.
        ...(existingIncome ?? {}),
        id: editingId ?? generateId(),
        kind: incomeKind,
        name: accountName.trim(),
        amount: parsedAmount,
        // Always the deposit account's own currency — recurring income has
        // no currency conversion, so letting these diverge would silently
        // corrupt the account's balance once credited. Pending entries
        // have no deposit account yet, so they keep whatever currency the
        // form's own picker was set to.
        currency: isPendingIncome ? currency : (depositAccount?.currency ?? currency),
        cashAccountId: isPendingIncome ? existingIncome?.cashAccountId : depositAccountId,
        creditDay: isPendingIncome ? existingIncome?.creditDay : day,
        startDate,
        expectedDate: isPendingIncome ? (incomeExpectedDate || undefined) : undefined,
        collected: isPendingIncome ? (existingIncome?.collected ?? false) : undefined,
        active: isPendingIncome ? (existingIncome?.active ?? true) : (existingIncome?.active ?? true),
        createdAt: isEditingIncome
          ? (recurringIncomes.find(r => r.id === editingId)?.createdAt ?? todayISO())
          : todayISO(),
        lastProcessedMonth: isEditingIncome
          ? (recurringIncomes.find(r => r.id === editingId)?.lastProcessedMonth ?? null)
          : null,
      };
      const incomeAmountText = income.amount.toLocaleString('en-EG', { maximumFractionDigits: 0 });
      if (isEditingIncome && editingId) {
        await updateRecurringIncome(income);
        logActivity('income_edited', t.activityIncomeEditedTitle, t.activityIncomeEditedSubtitle(income.name, incomeAmountText, income.currency), income.id);
      } else {
        await addRecurringIncome(income);
        logActivity('income_added', t.activityIncomeAddedTitle, t.activityIncomeAddedSubtitle(income.name, incomeAmountText, income.currency), income.id);
      }
    } else {
      const isExistingAccount = !!(editingId && !isEditingIncome);
      const isAddMode = isExistingAccount && balanceEntryMode === 'add';
      // In 'add' mode, leaving the amount blank means "no balance change" —
      // the user might just be editing the name/notes/date. Only 'total'
      // mode and brand-new accounts actually require a typed number.
      const magnitude = isAddMode && !balance.trim() ? 0 : parseAmount(balance);
      if (!accountName.trim() || (!isAddMode && !balance.trim()) || isNaN(magnitude)) {
        Alert.alert(t.enterAccountDetails);
        return;
      }
      // In 'add' mode the field holds a magnitude only (AmountInput can't
      // represent a minus sign) — direction comes from the separate addSign
      // toggle. 'total' mode and new accounts both take the input as the
      // balance directly, same as before this distinction existed.
      const rawInput = isAddMode ? addSign * magnitude : magnitude;
      const parsedBalance = isAddMode
        ? (editingOriginalBalance ?? 0) + rawInput
        : rawInput;
      const isNewAccount = !(editingId && !isEditingIncome);
      if (isNewAccount && !subLoading && !featuresUnlocked && cashAccounts.length >= FREE_LIMIT_CASH) {
        showPaywall();
        return;
      }
      // Only a genuine manual change gets a fresh lastBalanceUpdateAt/history
      // entry — re-saving the form without touching the number (e.g. just
      // editing the notes) shouldn't look like a balance update that never
      // happened.
      const balanceChanged = isExistingAccount && editingOriginalBalance !== null && parsedBalance !== editingOriginalBalance;
      const account: CashAccount = {
        id: editingId ?? generateId(),
        type: entryType as CashAccountType,
        accountName: accountName.trim(),
        balance: parsedBalance,
        currency,
        dateAdded,
        notes: notes.trim() || undefined,
        lastBalanceUpdateAt: balanceChanged
          ? new Date().toISOString()
          : (isExistingAccount ? cashAccounts.find(a => a.id === editingId)?.lastBalanceUpdateAt : undefined),
      };
      // addCashAccount/updateCashAccount update local state synchronously
      // before their network call — don't wait on the round-trip just to
      // dismiss the form (failures are handled by the context's own
      // rollback + syncError).
      if (isExistingAccount) {
        updateCashAccount(account);
        if (balanceChanged) {
          const delta = parsedBalance - (editingOriginalBalance as number);
          logBalanceUpdate(account.id, delta, parsedBalance)
            .then(() => { refreshTodayChanges(); refreshRecentUpdates(); });
          logActivity(
            'cash_edited',
            t.activityCashEditedTitle,
            t.activityCashEditedSubtitle(
              account.accountName,
              `${delta > 0 ? '+' : ''}${delta.toLocaleString('en-EG', { maximumFractionDigits: 2 })}`,
              parsedBalance.toLocaleString('en-EG', { maximumFractionDigits: 2 }),
              account.currency,
            ),
            account.id,
          );
        }
      } else {
        addCashAccount(account);
        logActivity(
          'cash_added',
          t.activityCashAddedTitle,
          t.activityCashAddedSubtitle(account.accountName, account.balance.toLocaleString('en-EG', { maximumFractionDigits: 2 }), account.currency),
          account.id,
        );
      }
    }
    notify();
    setShowForm(false);
    resetForm();
  };

  const handleDelete = (id: string, isIncome: boolean) => {
    if (Platform.OS === 'web') {
      setPendingDeleteId(id);
      setPendingDeleteIsIncome(isIncome);
      return;
    }
    Alert.alert(
      isIncome ? t.deleteRecurringIncome : t.deleteCashAccount,
      isIncome ? t.deleteRecurringIncomeConfirm : t.deleteCashAccountConfirm,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            impact(Haptics.ImpactFeedbackStyle.Medium);
            if (isIncome) removeRecurringIncome(id);
            else removeCashAccount(id);
          },
        },
      ],
    );
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    const isIncome = pendingDeleteIsIncome;
    setPendingDeleteId(null);
    setPendingDeleteIsIncome(false);
    impact(Haptics.ImpactFeedbackStyle.Medium);
    if (isIncome) removeRecurringIncome(id);
    else removeCashAccount(id);
  };

  // ── Transfer between accounts ─────────────────────────────────────────────
  const transferFrom = cashAccounts.find(a => a.id === transferFromId);
  const transferTo = cashAccounts.find(a => a.id === transferToId);

  const openTransfer = () => {
    impact();
    setTransferFromId(null);
    setTransferToId(null);
    setTransferAmountRaw('');
    setShowTransferModal(true);
  };

  const submitTransfer = async () => {
    const amount = parseAmount(transferAmountRaw);
    if (!transferFromId || !transferToId) {
      Alert.alert(t.transferAction, t.transferSelectBothAccounts);
      return;
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      Alert.alert(t.transferAction, t.invalidTransferAmount);
      return;
    }
    // Without this a typo (an extra zero) drove the source account
    // negative and credited the destination money that never existed,
    // silently inflating total cash and net worth.
    if (transferFrom && amount > transferFrom.balance) {
      Alert.alert(
        t.transferAction,
        t.transferExceedsBalance(
          transferFrom.balance.toLocaleString('en-EG', { maximumFractionDigits: 2 }),
          transferFrom.currency,
        ),
      );
      return;
    }
    impact(Haptics.ImpactFeedbackStyle.Light);
    await transferBetweenAccounts(transferFromId, transferToId, amount);
    // Transfers used to leave no trace anywhere — no activity entry, no
    // balance-update record, no "updated" timestamp — so a user reconciling
    // a balance drop had nothing explaining it.
    if (transferFrom && transferTo) {
      const amountTxt = amount.toLocaleString('en-EG', { maximumFractionDigits: 2 });
      Promise.all([
        logBalanceUpdate(transferFrom.id, -amount, transferFrom.balance - amount),
        logBalanceUpdate(transferTo.id, amount, transferTo.balance + amount),
      ]).then(() => { refreshTodayChanges(); refreshRecentUpdates(); });
      logActivity(
        'cash_edited',
        t.transferAction,
        t.activityTransferSubtitle(amountTxt, transferFrom.currency, transferFrom.accountName, transferTo.accountName),
        transferFrom.id,
      );
    }
    setShowTransferModal(false);
  };

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const byCurrency = cashAccounts.reduce<Record<string, number>>((acc, a) => {
    const bal = Number(a.balance) || 0;
    acc[a.currency] = (acc[a.currency] ?? 0) + bal;
    return acc;
  }, {});

  // Converted grand total across all currencies, using the same live rates
  // shown elsewhere in the app (Home screen, markets tab) — only shown when
  // every currency present has a resolvable rate, never a partial/guessed figure.
  const currencyRateEGP = (currency: string): number | null => {
    if (!prices) return null;
    if (currency === 'EGP') return 1;
    if (currency === 'USD') return prices.usdToEgp;
    return prices.fxRates?.[currency] ?? null;
  };
  const currencyKeys = Object.keys(byCurrency);
  const allRatesKnown = currencyKeys.length > 1 && currencyKeys.every(c => currencyRateEGP(c) !== null);
  const combinedTotalEGP = allRatesKnown
    ? currencyKeys.reduce((sum, c) => sum + byCurrency[c] * (currencyRateEGP(c) as number), 0)
    : null;

  const hasAnyEntries = cashAccounts.length > 0 || recurringIncomes.length > 0;
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
            if (showForm && !openAddParam) { setShowForm(false); resetForm(); }
            else { router.back(); }
          }}
          hitSlop={12}
        >
          <Feather name={backChevron()} size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[styles.modalTitle, { color: colors.text }]}>
          {showForm
            ? (editingId
                ? (isEditingIncome
                    ? (incomeKind === 'pending' ? t.editPendingIncome : t.editRecurringIncome)
                    : t.editCashAccount)
                : (entryType === 'recurring_income'
                    ? (incomeKind === 'pending' ? t.addPendingIncome : t.addRecurringIncome)
                    : t.addCashAccount))
            : t.cashAccounts}
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
            {/* ── Account Type (2 × 2 grid) ──────────────────────── */}
            {!isEditingIncome && (
              <View style={styles.section}>
                <Text style={labelStyle}>{t.cashAccountType}</Text>
                <View style={styles.typeGrid}>
                  {CASH_TYPES.map(ct => {
                    const active = entryType === ct.key;
                    return (
                      <Animated.View
                        key={ct.key}
                        style={[styles.typeCardWrap, { transform: [{ scale: cardAnims[ct.key] }] }]}
                      >
                        <TouchableOpacity
                          style={[styles.typeCard, {
                            borderColor: active ? colors.green : colors.border,
                            backgroundColor: active ? colors.green + '18' : colors.card,
                          }]}
                          onPress={() => selectType(ct.key)}
                          activeOpacity={0.85}
                        >
                          {active && (
                            <View style={[styles.checkmark, { backgroundColor: colors.green }]}>
                              <Feather name="check" size={9} color="#fff" />
                            </View>
                          )}
                          {ct.key === 'cash_home' ? (
                            <BanknoteIcon size={20} color={active ? colors.green : colors.mutedForeground} />
                          ) : (
                            <Feather name={TYPE_ICONS[ct.key]} size={20} color={active ? colors.green : colors.mutedForeground} />
                          )}
                          <Text style={[styles.typeLabel, { color: active ? colors.green : colors.text }]}>{ct.label}</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Recurring vs Pending — only choosable when adding; an
                 existing entry's kind is fixed once created. ─────────── */}
            {entryType === 'recurring_income' && !isEditingIncome && (
              <View style={styles.section}>
                <Text style={labelStyle}>{t.incomeKindLabel}</Text>
                <View style={styles.incomeKindToggle}>
                  {(['recurring', 'pending'] as const).map(k => (
                    <TouchableOpacity
                      key={k}
                      style={[styles.incomeKindChip, {
                        backgroundColor: incomeKind === k ? colors.primary : colors.card,
                        borderColor: incomeKind === k ? colors.primary : colors.border,
                      }]}
                      onPress={() => setIncomeKind(k)}
                    >
                      <Text style={[styles.incomeKindChipText, { color: incomeKind === k ? colors.primaryForeground : colors.text }]}>
                        {k === 'recurring' ? t.incomeKindRecurring : t.incomeKindPending}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {incomeKind === 'pending' && (
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.pendingIncomeSectionHint}</Text>
                )}
              </View>
            )}

            {/* ── Name / Income Name ──────────────────────────────── */}
            <View style={styles.section}>
              <Text style={labelStyle}>
                {entryType === 'recurring_income' ? t.incomeName : t.accountName}
              </Text>
              <TextInput
                ref={nameInputRef}
                style={inputStyle}
                placeholder={
                  entryType === 'recurring_income' && incomeKind === 'pending'
                    ? t.pendingIncomeNamePlaceholder
                    : NAME_PLACEHOLDER[entryType]
                }
                placeholderTextColor={colors.mutedForeground}
                value={accountName}
                onChangeText={setAccountName}
              />
            </View>

            {entryType === 'recurring_income' ? (
              <>
                {/* ── Amount ──────────────────────────────────────── */}
                <View style={styles.section}>
                  <Text style={labelStyle}>{t.amount}</Text>
                  <AmountInput
                    style={inputStyle}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    value={incomeAmount}
                    onChangeText={setIncomeAmount}
                  />
                </View>

                {incomeKind === 'pending' ? (
                  <>
                  {/* ── Currency — a pending entry has no deposit account
                       to infer it from (that's chosen later, when marked
                       collected), so it needs its own picker here. ────── */}
                  <View style={styles.section}>
                    <Text style={labelStyle}>{t.assetCurrency}</Text>
                    <View style={styles.chips}>
                      {CURRENCIES_DEFAULT.map(c => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.chip, {
                            borderColor: currency === c ? colors.primary : colors.border,
                            backgroundColor: currency === c ? colors.primary + '10' : colors.card,
                          }]}
                          onPress={() => setCurrency(c)}
                        >
                          <Text style={styles.chipFlag}>{CURRENCY_FLAGS[c]}</Text>
                          <Text style={[styles.chipText, { color: currency === c ? colors.primary : colors.text }]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* ── Expected Date — informational only ────────────── */}
                  <View style={styles.section}>
                    <DatePickerField
                      label={t.expectedDateOptional}
                      value={incomeExpectedDate}
                      onChange={setIncomeExpectedDate}
                      onClear={() => setIncomeExpectedDate('')}
                      placeholder={t.noExpectedDate}
                    />
                  </View>
                  </>
                ) : (
                <>
                {/* ── Credit Day ──────────────────────────────────── */}
                <View style={styles.section}>
                  <Text style={labelStyle}>{t.creditDay}</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="25"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    value={creditDay}
                    onChangeText={v => setCreditDay(toWesternDigits(v).replace(/[^0-9]/g, '').slice(0, 2))}
                  />
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.creditDayHint}</Text>
                </View>

                {/* ── Start Date ──────────────────────────────────── */}
                <View style={styles.section}>
                  <DatePickerField label={t.startDate} value={startDate} onChange={setStartDate} />
                </View>

                {/* ── Deposit Into ────────────────────────────────── */}
                <View style={styles.section}>
                  <Text style={labelStyle}>{t.depositInto}</Text>
                  {cashAccounts.length === 0 ? (
                    <View style={[styles.noAccountsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Feather name="info" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.noAccountsText, { color: colors.mutedForeground }]}>
                        {t.noCashAccounts}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[inputStyle, styles.pickerRow]}
                      onPress={() => setShowAccountPicker(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: depositAccount ? colors.text : colors.mutedForeground, flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' }} numberOfLines={1}>
                        {depositAccount ? `${depositAccount.accountName} (${depositAccount.currency})` : t.selectAccount}
                      </Text>
                      <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                  {cashAccounts.length > 0 && (
                    <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                      {t.autoMonthlyIncome}
                    </Text>
                  )}
                </View>
                </>
                )}
              </>
            ) : (
              <>
                {/* ── Balance ──────────────────────────────────────── */}
                <View style={styles.section}>
                  <Text style={labelStyle}>{t.balance}</Text>

                  {editingOriginalBalance !== null && (
                    <Text style={[styles.currentBalanceLabel, { color: colors.mutedForeground }]}>
                      {t.currentBalanceLabel(editingOriginalBalance.toLocaleString('en-EG', { maximumFractionDigits: 2 }), currency)}
                    </Text>
                  )}

                  {editingOriginalBalance !== null && (
                    <View style={[styles.balanceModeTabsWrap, { backgroundColor: colors.muted }]}>
                      <TouchableOpacity
                        style={[styles.balanceModeTabPill, balanceEntryMode === 'add' && { backgroundColor: colors.card }]}
                        onPress={() => switchBalanceMode('add')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.balanceModeTabTxt, { color: balanceEntryMode === 'add' ? colors.text : colors.mutedForeground }]}>
                          {t.balanceModeTabAdd}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.balanceModeTabPill, balanceEntryMode === 'total' && { backgroundColor: colors.card }]}
                        onPress={() => switchBalanceMode('total')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.balanceModeTabTxt, { color: balanceEntryMode === 'total' ? colors.text : colors.mutedForeground }]}>
                          {t.balanceModeTabTotal}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {editingOriginalBalance !== null && balanceEntryMode === 'add' ? (
                    <View style={styles.signInlineRow}>
                      <TouchableOpacity
                        style={[
                          styles.signSelectorBtn,
                          { borderColor: colors.green },
                          addSign === 1 && { backgroundColor: colors.green },
                        ]}
                        onPress={() => { impact(); setAddSign(1); }}
                        activeOpacity={0.7}
                      >
                        <Feather name="plus" size={16} color={addSign === 1 ? colors.primaryForeground : colors.green} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.signSelectorBtn,
                          { borderColor: colors.red },
                          addSign === -1 && { backgroundColor: colors.red },
                        ]}
                        onPress={() => { impact(); setAddSign(-1); }}
                        activeOpacity={0.7}
                      >
                        <Feather name="minus" size={16} color={addSign === -1 ? colors.primaryForeground : colors.red} />
                      </TouchableOpacity>
                      <AmountInput
                        style={[...inputStyle, styles.signInlineInput]}
                        placeholder={t.balanceModeAddPlaceholder}
                        placeholderTextColor={colors.mutedForeground}
                        value={balance}
                        onChangeText={setBalance}
                      />
                    </View>
                  ) : null}

                  {!(editingOriginalBalance !== null && balanceEntryMode === 'add') && (
                    <AmountInput
                      style={inputStyle}
                      placeholder="0.00"
                      placeholderTextColor={colors.mutedForeground}
                      value={balance}
                      onChangeText={setBalance}
                    />
                  )}

                  {editingOriginalBalance !== null && (() => {
                    const parsed = parseAmount(balance);
                    if (balance.trim() === '' || isNaN(parsed)) return null;

                    let delta: number;
                    let newTotal: number;
                    if (balanceEntryMode === 'add') {
                      if (parsed === 0) return null;
                      delta = addSign * parsed;
                      newTotal = editingOriginalBalance + delta;
                    } else {
                      if (parsed === editingOriginalBalance) return null;
                      delta = parsed - editingOriginalBalance;
                      newTotal = parsed;
                    }

                    const deltaColor = delta > 0 ? colors.green : colors.red;
                    const fmt = (n: number) => n.toLocaleString('en-EG', { maximumFractionDigits: 2 });

                    return (
                      <View style={[styles.balancePreviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.balancePreviewAccent, { backgroundColor: deltaColor }]} />
                        <View style={styles.balancePreviewBody}>
                          <Text style={[styles.balancePreviewLabel, { color: colors.mutedForeground }]}>
                            {t.newBalanceLabel}
                          </Text>
                          <Text style={[styles.balancePreviewHero, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                            {fmt(newTotal)} <Text style={styles.balancePreviewHeroCurrency}>{currency}</Text>
                          </Text>
                          <View style={styles.balancePreviewFooterRow}>
                            <Text style={[styles.balancePreviewFrom, { color: colors.mutedForeground }]}>
                              {t.balancePreviewFrom(fmt(editingOriginalBalance))}
                            </Text>
                            <View style={[styles.balancePreviewBadge, { backgroundColor: deltaColor + '18' }]}>
                              <Feather name={delta > 0 ? 'arrow-up-right' : 'arrow-down-right'} size={11} color={deltaColor} />
                              <Text style={[styles.balancePreviewBadgeTxt, { color: deltaColor }]}>
                                {delta > 0 ? '+' : ''}{fmt(delta)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })()}

                  {!(editingOriginalBalance !== null && balanceEntryMode === 'add') && (
                    <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                      {BALANCE_HINT[entryType as CashAccountType] ?? ''}
                    </Text>
                  )}
                </View>

                {/* ── Currency ─────────────────────────────────────── */}
                <View style={styles.section}>
                  <Text style={labelStyle}>{t.accountCurrency}</Text>
                  <View style={styles.chips}>
                    {currencies.map(c => {
                      const active = currency === c;
                      // Locked once an existing cash account is being edited
                      // (not created, not a recurring-income entry): a
                      // linked Goal's saved-% and any recurring income that
                      // credits this account both assume the account's
                      // balance stays in the currency it was created with —
                      // changing it afterward would silently misread the
                      // stored face value in the new currency (e.g. a
                      // 50,000 balance meant as EGP suddenly read as USD).
                      const locked = !!editingId && !isEditingIncome;
                      return (
                        <TouchableOpacity
                          key={c}
                          style={[styles.chip, {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primary + '10' : colors.card,
                            opacity: locked && !active ? 0.4 : 1,
                          }]}
                          onPress={() => { if (!locked) setCurrency(c); }}
                          disabled={locked}
                          activeOpacity={locked ? 1 : 0.8}
                        >
                          <Text style={styles.chipFlag}>{CURRENCY_FLAGS[c]}</Text>
                          <Text style={[styles.chipText, { color: active ? colors.primary : colors.text }]}>{c}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {!!editingId && !isEditingIncome && (
                    <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.accountCurrencyLockedHint}</Text>
                  )}
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
            )}
          </>
        ) : (
          <>
            {/* ── Total cash card ──────────────────────────────────── */}
            {cashAccounts.length > 0 && (
              <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>{t.totalCash}</Text>
                {Object.entries(byCurrency).map(([cur, total]) => (
                  <Text
                    key={cur}
                    style={[styles.totalValue, { color: colors.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {total.toLocaleString('en-EG', { maximumFractionDigits: 0 })} {cur}
                  </Text>
                ))}
                {combinedTotalEGP !== null && (
                  <Text style={[styles.combinedTotal, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {t.combinedTotalLabel}: {combinedTotalEGP.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
                  </Text>
                )}
              </View>
            )}

            {cashAccounts.length >= 2 && (
              <TouchableOpacity
                style={[styles.transferBtn, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
                onPress={openTransfer}
                activeOpacity={0.8}
              >
                <Feather name="repeat" size={15} color={colors.primary} />
                <Text style={[styles.transferBtnText, { color: colors.primary }]}>{t.transferAction}</Text>
              </TouchableOpacity>
            )}

            {!hasAnyEntries ? (
              <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.emptyIconWrap, { backgroundColor: colors.green + '14' }]}>
                  <BanknoteIcon size={30} color={colors.green} />
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
                {/* Cash accounts */}
                {cashAccounts.map(a => (
                  <SwipeToDelete key={a.id} onDelete={() => handleDelete(a.id, false)}>
                    <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[styles.accountIconWrap, { backgroundColor: colors.green + '16' }]}>
                        {a.type === 'cash_home' ? (
                          <BanknoteIcon size={18} color={colors.green} />
                        ) : (
                          <Feather name={TYPE_ICONS[a.type]} size={18} color={colors.green} />
                        )}
                      </View>
                      <View style={styles.accountInfo}>
                        <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>{a.accountName}</Text>
                        <Text style={[styles.accountType, { color: colors.mutedForeground }]}>{TYPE_LABELS[a.type]}</Text>
                        <View style={styles.balanceRow}>
                          <Text style={[styles.accountBalance, { color: colors.text }]} numberOfLines={1}>
                            {fmtCompact(Number(a.balance) || 0)} {a.currency}
                          </Text>
                          {todayChangesLoading ? (
                            // Same footprint as the real badge below (down to
                            // the invisible placeholder digits), reserved
                            // from the very first render — matches the
                            // portfolio hero's own Today chip, which always
                            // occupies its space rather than popping in.
                            <View style={[styles.todayBadge, { opacity: 0 }]} pointerEvents="none">
                              <Feather name="minus" size={9} color="transparent" />
                              <Text style={styles.todayBadgeText}>+12.3K</Text>
                            </View>
                          ) : (() => {
                            const delta = todayChanges[a.id] || 0;
                            const isFlat = Math.abs(delta) < 0.005;
                            const up = delta > 0;
                            const c = isFlat ? colors.mutedForeground : up ? colors.green : colors.red;
                            return (
                            <View style={[styles.todayBadge, { backgroundColor: c + '18' }]}>
                              {/* No currency code here: the balance sitting
                                  immediately to the left already carries it,
                                  and repeating it pushed the badge past the
                                  row's width — "+317.3K EGP today" truncated
                                  to "+317.3K EGP tod…", losing the one word
                                  that says what the number means.
                                  Icon + 7/3 padding + 11px text matches
                                  HoldingCard's gainPill (the investment
                                  list's own %-change pill) — same badge
                                  language across the app, not a one-off.
                                  Always rendered, even at exactly zero — same
                                  as the portfolio hero's own Today chip
                                  (isTodayFlat), so the row never reflows once
                                  loaded, matching how that chip never
                                  disappears either. */}
                              <Feather name={isFlat ? 'minus' : up ? 'arrow-up' : 'arrow-down'} size={9} color={c} />
                              <Text style={[styles.todayBadgeText, { color: c }]} numberOfLines={1}>
                                {t.todayChangeBadge(isFlat ? '0' : `${up ? '+' : '−'}${fmtCompact(Math.abs(delta))}`)}
                              </Text>
                            </View>
                            );
                          })()}
                        </View>
                        {a.lastBalanceUpdateAt && (
                          <Text style={[styles.lastUpdatedHint, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {t.updatedDaysAgo(String(tradingDaysAgo(new Date(a.lastBalanceUpdateAt))))}
                          </Text>
                        )}
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
                          onPress={() => handleDelete(a.id, false)}
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

                {/* Pending income is deliberately NOT listed here — it has its
                    own dedicated section on the Income screen, and showing it
                    here too (collected or not) made this screen read like it
                    had extra "accounts" that weren't real cash accounts. Once
                    an entry is actually collected, its effect still shows up
                    here exactly where it belongs: the destination account's
                    balance, and a "Recent updates" transaction row. */}

                {/* Recurring incomes */}
                {recurringIncomes.filter(r => r.kind !== 'pending').map(r => (
                  <SwipeToDelete key={r.id} onDelete={() => handleDelete(r.id, true)}>
                    <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[styles.accountIconWrap, { backgroundColor: '#8B5CF616' }]}>
                        <Feather name="repeat" size={18} color="#8B5CF6" />
                      </View>
                      <View style={styles.accountInfo}>
                        <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>{r.name}</Text>
                        <Text style={[styles.accountType, { color: colors.mutedForeground }]}>
                          {t.recurringIncome} · {t.creditDay} {r.creditDay}
                        </Text>
                        <Text style={[styles.accountBalance, { color: colors.text }]} numberOfLines={1}>
                          {r.amount.toLocaleString('en-EG', { maximumFractionDigits: 0 })} {r.currency}
                          <Text style={[styles.accountType, { color: colors.mutedForeground }]}> / {t.fiMonthly}</Text>
                        </Text>
                        {cashAccounts.find(a => a.id === r.cashAccountId) && (
                          <Text style={[styles.accountType, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {'→ '}{cashAccounts.find(a => a.id === r.cashAccountId)!.accountName}
                          </Text>
                        )}
                      </View>
                      <View style={styles.accountActions}>
                        <TouchableOpacity
                          onPress={() => openEditIncome(r)}
                          style={[styles.actionBtn, { backgroundColor: colors.primary + '14' }]}
                          hitSlop={8}
                          activeOpacity={0.7}
                        >
                          <Feather name="edit-2" size={14} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(r.id, true)}
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

            {/* ── Recent updates — merged across every cash account, each
                 row labeled with which one it belongs to ──────────────── */}
            {recentUpdates.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t.recentUpdatesTitle}</Text>
                <View style={[styles.recentList, { borderColor: colors.border }]}>
                  {recentUpdates.map((u, i) => {
                    const isUp = u.delta > 0;
                    return (
                      <View
                        key={u.id}
                        style={[styles.recentRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.recentAccountName, { color: colors.text }]} numberOfLines={1}>
                            {u.accountName}
                          </Text>
                          <Text style={[styles.recentDate, { color: colors.mutedForeground }]}>
                            {tradingDayLabel(new Date(u.createdAt), { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                        <Text style={[styles.recentDelta, { color: isUp ? colors.green : colors.red }]} numberOfLines={1}>
                          {isUp ? '+' : ''}{u.delta.toLocaleString('en-EG', { maximumFractionDigits: 0 })} {u.currency}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {recentUpdates.length >= RECENT_UPDATES_PREVIEW_LIMIT && (
                  <TouchableOpacity
                    onPress={() => { impact(); router.push('/cash-history' as any); }}
                    activeOpacity={0.7}
                    style={styles.viewAllBtn}
                  >
                    <Text style={[styles.viewAllText, { color: colors.primary }]}>{t.viewAllUpdates}</Text>
                    <Feather name={forwardChevron()} size={14} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Account picker — picks the deposit account for the income form.
          Marking a pending entry collected now happens only on the Income
          screen (app/recurring-income.tsx), which owns that flow exclusively
          since pending entries are no longer listed on this screen. ───── */}
      <Modal
        visible={showAccountPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAccountPicker(false)}
      >
        <TouchableOpacity
          style={confirmStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowAccountPicker(false)}
        >
          <View style={[styles.pickerSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>
              {t.selectAccount}
            </Text>
            {cashAccounts.map(a => (
              <TouchableOpacity
                key={a.id}
                style={[styles.pickerOption, {
                  borderColor: colors.border,
                  backgroundColor: depositAccountId === a.id ? colors.primary + '14' : 'transparent',
                }]}
                onPress={() => {
                  setDepositAccountId(a.id);
                  setCurrency(a.currency);
                  setShowAccountPicker(false);
                }}
              >
                <Text style={[styles.pickerOptionText, { color: depositAccountId === a.id ? colors.primary : colors.text }]} numberOfLines={1}>
                  {a.accountName}
                </Text>
                <Text style={[styles.accountType, { color: colors.mutedForeground }]}>{a.currency}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Transfer between accounts ─────────────────────────────────────
          Single Modal whose content switches between the form and the
          account-picker view — two separate stacked <Modal>s here caused
          real bugs (keyboard covering the buttons with no way back, taps
          not registering reliably between the two native presentations). */}
      <Modal visible={showTransferModal} animationType="fade" transparent onRequestClose={() => (transferPicker ? setTransferPicker(null) : setShowTransferModal(false))}>
        <KeyboardAvoidingView
          style={confirmStyles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[confirmStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {transferPicker ? (
              <>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={() => setTransferPicker(null)} hitSlop={12}>
                    <Feather name={backChevron()} size={20} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={[confirmStyles.title, { marginBottom: 0 }]}>{t.selectAccount}</Text>
                  <View style={{ width: 20 }} />
                </View>
                <ScrollView style={styles.pickerScroll} contentContainerStyle={styles.pickerScrollGap} keyboardShouldPersistTaps="handled">
                  {cashAccounts
                    .filter(a => transferPicker === 'from'
                      ? a.id !== transferToId
                      : a.id !== transferFromId && (!transferFrom || a.currency === transferFrom.currency))
                    .map(a => {
                      const selectedId = transferPicker === 'from' ? transferFromId : transferToId;
                      return (
                        <TouchableOpacity
                          key={a.id}
                          style={[styles.pickerOption, {
                            borderColor: colors.border,
                            backgroundColor: selectedId === a.id ? colors.primary + '14' : 'transparent',
                          }]}
                          onPress={() => {
                            if (transferPicker === 'from') {
                              setTransferFromId(a.id);
                              // A new "from" pick can invalidate the existing "to" if currencies no longer match.
                              if (transferTo && transferTo.currency !== a.currency) setTransferToId(null);
                            } else {
                              setTransferToId(a.id);
                            }
                            setTransferPicker(null);
                          }}
                        >
                          <Text style={[styles.pickerOptionText, { color: selectedId === a.id ? colors.primary : colors.text }]} numberOfLines={1}>
                            {a.accountName}
                          </Text>
                          <Text style={[styles.accountType, { color: colors.mutedForeground }]}>
                            {a.balance.toLocaleString('en-EG', { maximumFractionDigits: 0 })} {a.currency}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={[confirmStyles.title, { color: colors.text }]}>{t.transferBetweenAccounts}</Text>

                <View style={styles.section}>
                  <Text style={labelStyle}>{t.transferFromLabel}</Text>
                  <TouchableOpacity
                    style={[inputStyle, styles.pickerRow]}
                    onPress={() => setTransferPicker('from')}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: transferFrom ? colors.text : colors.mutedForeground, flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' }} numberOfLines={1}>
                      {transferFrom ? `${transferFrom.accountName} (${transferFrom.balance.toLocaleString('en-EG', { maximumFractionDigits: 0 })} ${transferFrom.currency})` : t.selectAccount}
                    </Text>
                    <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                <View style={styles.section}>
                  <Text style={labelStyle}>{t.transferToLabel}</Text>
                  <TouchableOpacity
                    style={[inputStyle, styles.pickerRow, !transferFrom && { opacity: 0.5 }]}
                    onPress={() => transferFrom && setTransferPicker('to')}
                    activeOpacity={0.8}
                    disabled={!transferFrom}
                  >
                    <Text style={{ color: transferTo ? colors.text : colors.mutedForeground, flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' }} numberOfLines={1}>
                      {transferTo ? `${transferTo.accountName} (${transferTo.currency})` : t.selectAccount}
                    </Text>
                    <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.transferSameCurrencyHint}</Text>
                </View>

                <View style={styles.section}>
                  <Text style={labelStyle}>{t.transferAmountLabel}</Text>
                  <AmountInput
                    style={inputStyle}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    value={transferAmountRaw}
                    onChangeText={setTransferAmountRaw}
                  />
                </View>

                <View style={confirmStyles.row}>
                  <TouchableOpacity
                    onPress={() => setShowTransferModal(false)}
                    style={[confirmStyles.btn, { backgroundColor: colors.muted }]}
                    activeOpacity={0.75}
                  >
                    <Text style={[confirmStyles.btnTxt, { color: colors.mutedForeground }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={submitTransfer}
                    style={[confirmStyles.btn, { backgroundColor: colors.primary }]}
                    activeOpacity={0.85}
                  >
                    <Text style={[confirmStyles.btnTxt, { color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }]}>{t.transferAction}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete confirmation (web) ──────────────────────────────────── */}
      <Modal visible={!!pendingDeleteId} animationType="fade" transparent onRequestClose={() => setPendingDeleteId(null)}>
        <View style={confirmStyles.overlay}>
          <View style={[confirmStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[confirmStyles.title, { color: colors.text }]}>
              {pendingDeleteIsIncome ? t.deleteRecurringIncome : t.deleteCashAccount}
            </Text>
            <Text style={[confirmStyles.msg, { color: colors.mutedForeground }]}>
              {pendingDeleteIsIncome ? t.deleteRecurringIncomeConfirm : t.deleteCashAccountConfirm}
            </Text>
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
  balanceDeltaHint: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  currentBalanceLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  // One seamless control (shared border, rounded corners, internal divider)
  // rather than two separate boxes side by side — reads as a single input
  // with a direction switch built in, not two competing widgets.
  addAmountRow: { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  signToggle: { width: 50, alignItems: 'center', justifyContent: 'center' },
  signDivider: { width: StyleSheet.hairlineWidth },
  addAmountInput: { flex: 1, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
  modeLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, alignSelf: 'flex-start' },
  modeLink: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  // Segmented pill toggle for add/subtract vs set-total mode — same visual
  // pattern as the leaderboard's Weekly/Monthly PeriodToggle.
  balanceModeTabsWrap: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3, marginBottom: 12 },
  balanceModeTabPill: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  balanceModeTabTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  // Two small +/- sign buttons inline with the amount field, replacing the
  // old single flip-toggle — same compact footprint, two explicit targets
  // instead of one that cycles.
  signInlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signSelectorBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1.5 },
  signInlineInput: { flex: 1 },
  // Before → after balance preview — a hero "new balance" figure (the thing
  // that actually matters most) with a colored accent bar and a compact
  // "from X, delta Y" footer, rather than two same-weight numbers side by
  // side.
  balancePreviewCard: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, marginTop: 14, overflow: 'hidden' },
  balancePreviewAccent: { width: 4 },
  balancePreviewBody: { flex: 1, padding: 14, gap: 4 },
  balancePreviewLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  balancePreviewHero: { fontSize: 24, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.5 },
  balancePreviewHeroCurrency: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  balancePreviewFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  balancePreviewFrom: { fontSize: 12.5, fontFamily: 'Inter_500Medium' },
  balancePreviewBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  balancePreviewBadgeTxt: { fontSize: 12.5, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  lastUpdatedHint: { fontSize: 10.5, fontFamily: 'Inter_400Regular', marginTop: 2 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCardWrap: { width: '47%' },
  typeCard: {
    borderRadius: 12, borderWidth: 1.5, padding: 14,
    alignItems: 'center', gap: 6,
  },
  checkmark: {
    position: 'absolute', top: 7, end: 7,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  typeLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  incomeKindToggle: { flexDirection: 'row', gap: 8 },
  incomeKindChip: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  incomeKindChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  chipFlag: { fontSize: 16 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  pickerRow: { flexDirection: 'row', alignItems: 'center' },
  notesInput: { minHeight: 80, paddingTop: 12 },
  noAccountsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  noAccountsText: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  totalCard: {
    borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 16,
    alignItems: 'center', gap: 6,
  },
  totalLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  totalValue: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  combinedTotal: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  transferBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1, paddingVertical: 12, marginBottom: 16,
  },
  transferBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  list: { gap: 10 },
  recentSection: { marginTop: 24 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, marginBottom: 10 },
  recentList: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  recentAccountName: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
  recentDate: { fontSize: 11.5, fontFamily: 'Inter_400Regular', marginTop: 1 },
  recentDelta: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
  viewAllText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  accountCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  accountIconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  accountInfo: { flex: 1, gap: 3 },
  accountName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  accountType: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  accountBalance: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: -0.2, marginTop: 1 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  // Matches HoldingCard's gainPill/gainText — see the comment at the call site.
  todayBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, flexShrink: 1,
  },
  todayBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  accountActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtn: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, gap: 8 },
  pickerTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pickerScroll: { maxHeight: 320 },
  pickerScrollGap: { gap: 8 },
  pickerOptionText: { fontSize: 15, fontFamily: 'Inter_500Medium', flex: 1 },
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
