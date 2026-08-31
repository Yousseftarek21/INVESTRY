import React, { useCallback, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { backChevron, forwardArrow } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerField } from '@/components/DatePickerField';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useCash } from '@/context/CashContext';
import { useRecurringIncome } from '@/context/RecurringIncomeContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { parseAmount, toWesternDigits } from '@/utils/parseAmount';
import { AmountInput } from '@/components/AmountInput';
import { IncomeKind, RecurringIncome } from '@/types';

// Recurring income tracking is a Pro-only feature — Free shows the screen
// (so an existing entry from before a downgrade is still visible) but
// can't add a new one.
const FREE_LIMIT = 0;

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
    markIncomeCollected,
  } = useRecurringIncome();
  const { featuresUnlocked, isLoading: subLoading, showPaywall } = useSubscription();
  const { logActivity } = useActivityLog();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  // Set while the account picker is open to collect a pending entry instead
  // of to pick the deposit account on the form — same modal, two purposes.
  const [collectingId, setCollectingId] = useState<string | null>(null);

  const [kind, setKind] = useState<IncomeKind>('recurring');
  const [name, setName] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [cashAccountId, setCashAccountId] = useState('');
  const [creditDayRaw, setCreditDayRaw] = useState('25');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [active, setActive] = useState(true);

  const recurringEntries = recurringIncomes.filter(inc => inc.kind !== 'pending');
  const pendingEntries = recurringIncomes.filter(inc => inc.kind === 'pending');

  const selectedAccount = cashAccounts.find(a => a.id === cashAccountId);

  const resetForm = useCallback(() => {
    setKind('recurring');
    setName('');
    setAmountRaw('');
    setCurrency('EGP');
    setCashAccountId('');
    setCreditDayRaw('25');
    setStartDate(todayISO());
    setEndDate('');
    setExpectedDate('');
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
    setKind(inc.kind ?? 'recurring');
    setName(inc.name);
    setAmountRaw(String(inc.amount));
    setCurrency(inc.currency);
    setCashAccountId(inc.cashAccountId ?? '');
    setCreditDayRaw(String(inc.creditDay ?? 25));
    setStartDate(inc.startDate);
    setEndDate(inc.endDate ?? '');
    setExpectedDate(inc.expectedDate ?? '');
    setActive(inc.active);
    setShowForm(true);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    const amount = parseAmount(amountRaw);
    const creditDay = Math.min(31, Math.max(1, parseInt(creditDayRaw, 10) || 1));
    const isPending = kind === 'pending';

    if (!trimmed) {
      Alert.alert(t.incomeName, t.incomeNameError);
      return;
    }
    if (amount <= 0) {
      Alert.alert(t.amount, t.incomeAmountError);
      return;
    }
    // A pending entry doesn't have a destination account yet — that's
    // chosen later, when the user marks it collected.
    if (!isPending && !cashAccountId) {
      Alert.alert(t.depositInto, t.incomeAccountError);
      return;
    }
    if (!editingId && !subLoading && !featuresUnlocked && recurringIncomes.length >= FREE_LIMIT) {
      showPaywall();
      return;
    }

    impact(Haptics.ImpactFeedbackStyle.Light);

    const amountText = amount.toLocaleString('en-EG', { maximumFractionDigits: 0 });

    try {
      if (editingId) {
        const existing = recurringIncomes.find(r => r.id === editingId);
        if (!existing) return;
        await updateRecurringIncome({
          ...existing,
          kind,
          name: trimmed,
          amount,
          currency,
          cashAccountId: isPending ? existing.cashAccountId : cashAccountId,
          creditDay: isPending ? existing.creditDay : creditDay,
          startDate,
          endDate: isPending ? undefined : (endDate || undefined),
          expectedDate: isPending ? (expectedDate || undefined) : undefined,
          active: isPending ? existing.active : active,
        });
        logActivity('income_edited', t.activityIncomeEditedTitle, t.activityIncomeEditedSubtitle(trimmed, amountText, currency), editingId);
      } else {
        const id = generateId();
        await addRecurringIncome({
          id,
          kind,
          name: trimmed,
          amount,
          currency,
          cashAccountId: isPending ? undefined : cashAccountId,
          creditDay: isPending ? undefined : creditDay,
          startDate,
          endDate: isPending ? undefined : (endDate || undefined),
          expectedDate: isPending ? (expectedDate || undefined) : undefined,
          collected: isPending ? false : undefined,
          active: true,
          lastProcessedMonth: null,
          createdAt: new Date().toISOString(),
        });
        logActivity('income_added', t.activityIncomeAddedTitle, t.activityIncomeAddedSubtitle(trimmed, amountText, currency), id);
      }
      resetForm();
    } catch {
      Alert.alert(t.couldNotSave, t.couldNotOpenLinkDesc);
    }
  };

  const handleMarkCollected = (id: string) => {
    setCollectingId(id);
    setShowAccountPicker(true);
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
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            {showForm
              ? (editingId
                  ? (kind === 'pending' ? t.editPendingIncome : t.editRecurringIncome)
                  : (kind === 'pending' ? t.addPendingIncome : t.addRecurringIncome))
              : t.incomeScreenTitle}
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
                    <Text style={[s.emptyBtnText, { color: colors.primaryForeground }]}>{t.addIncomeEntry}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.list}>
                  {pendingEntries.length > 0 && (
                    <>
                      {recurringEntries.length > 0 && (
                        <Text style={[s.sectionHeader, { color: colors.mutedForeground }]}>{t.pendingIncomeLabel}</Text>
                      )}
                      {pendingEntries.map(inc => {
                        const stateColor = inc.collected ? colors.green : '#F59E0B';
                        const destAccount = inc.collected ? cashAccounts.find(a => a.id === inc.cashAccountId) : undefined;
                        return (
                        <SwipeToDelete key={inc.id} onDelete={() => handleDelete(inc.id)}>
                          <TouchableOpacity
                            style={[s.pendingCard, {
                              backgroundColor: colors.card, borderColor: colors.border,
                              borderStartWidth: 3, borderStartColor: stateColor,
                            }]}
                            onPress={() => openEdit(inc)}
                            activeOpacity={0.85}
                          >
                            <View style={s.pendingHeaderRow}>
                              <View style={[s.cardIcon, { backgroundColor: stateColor + '18' }]}>
                                <Feather name={inc.collected ? 'check-circle' : 'clock'} size={18} color={stateColor} />
                              </View>
                              <View style={s.cardBody}>
                                <Text style={[s.cardName, { color: colors.text }]} numberOfLines={1}>
                                  {inc.name}
                                </Text>
                                <View style={s.pendingAmountRow}>
                                  <Text style={[s.pendingAmount, { color: colors.text }]} numberOfLines={1}>
                                    {inc.amount.toLocaleString('en-EG', { maximumFractionDigits: 0 })}
                                  </Text>
                                  <Text style={[s.pendingCurrency, { color: colors.mutedForeground }]}>{inc.currency}</Text>
                                </View>
                              </View>
                              <View style={s.cardSideCol}>
                                <View style={[s.pendingBadge, { backgroundColor: stateColor + '1F', borderColor: stateColor + '40' }]}>
                                  <Text style={[s.pendingBadgeText, { color: stateColor }]}>
                                    {inc.collected ? t.collectedLabel : t.incomeKindPending}
                                  </Text>
                                </View>
                                {/* Explicit delete affordance, not just swipe — a
                                    pending entry may simply never arrive (deal fell
                                    through, client backed out), and a user shouldn't
                                    have to discover swipe-to-delete to remove it. */}
                                <TouchableOpacity
                                  style={[s.deleteBtn, { backgroundColor: colors.red + '12' }]}
                                  onPress={() => handleDelete(inc.id)}
                                  hitSlop={8}
                                >
                                  <Feather name="trash-2" size={13} color={colors.red} />
                                </TouchableOpacity>
                              </View>
                            </View>

                            {(inc.expectedDate || destAccount || !inc.collected) && (
                              <View style={[s.pendingFooterRow, { borderTopColor: colors.border }]}>
                                <View style={s.pendingCaption}>
                                  {inc.collected ? (
                                    destAccount && (
                                      <>
                                        <Feather name={forwardArrow()} size={11} color={colors.mutedForeground} />
                                        <Text style={[s.pendingCaptionText, { color: colors.mutedForeground }]} numberOfLines={1}>
                                          {destAccount.accountName}
                                        </Text>
                                      </>
                                    )
                                  ) : inc.expectedDate ? (
                                    <>
                                      <Feather name="calendar" size={11} color={colors.mutedForeground} />
                                      <Text style={[s.pendingCaptionText, { color: colors.mutedForeground }]} numberOfLines={1}>
                                        {t.expectedDate}: {inc.expectedDate}
                                      </Text>
                                    </>
                                  ) : null}
                                </View>
                                {!inc.collected && (
                                  <TouchableOpacity
                                    style={[s.collectBtn, { backgroundColor: colors.green }]}
                                    onPress={() => handleMarkCollected(inc.id)}
                                    hitSlop={8}
                                    activeOpacity={0.85}
                                  >
                                    <Feather name="check" size={12} color={colors.primaryForeground} />
                                    <Text style={[s.collectBtnText, { color: colors.primaryForeground }]}>{t.markCollected}</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}
                          </TouchableOpacity>
                        </SwipeToDelete>
                        );
                      })}
                    </>
                  )}

                  {recurringEntries.length > 0 && (
                    <>
                      {pendingEntries.length > 0 && (
                        <Text style={[s.sectionHeader, { color: colors.mutedForeground }]}>{t.incomeKindRecurring}</Text>
                      )}
                      {recurringEntries.map(inc => (
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
                    </>
                  )}
                </View>
              )
            ) : (
              /* ── FORM ── */
              <View style={s.form}>

                {/* Recurring vs Pending — only choosable when adding; an
                    existing entry's kind is fixed once created (converting
                    a live recurring schedule into a one-off receivable, or
                    back, isn't a meaningful edit). */}
                {!editingId && (
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.mutedForeground }]}>{t.incomeKindLabel}</Text>
                    <View style={s.kindToggle}>
                      {(['recurring', 'pending'] as const).map(k => (
                        <TouchableOpacity
                          key={k}
                          style={[s.kindChip, {
                            backgroundColor: kind === k ? colors.primary : colors.input,
                            borderColor: kind === k ? colors.primary : colors.border,
                          }]}
                          onPress={() => setKind(k)}
                        >
                          <Text style={[s.kindChipText, { color: kind === k ? colors.primaryForeground : colors.text }]}>
                            {k === 'recurring' ? t.incomeKindRecurring : t.incomeKindPending}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {kind === 'pending' && (
                      <Text style={[s.hint, { color: colors.mutedForeground }]}>{t.pendingIncomeSectionHint}</Text>
                    )}
                  </View>
                )}

                {/* Income Name */}
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.incomeName}</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    value={name}
                    onChangeText={setName}
                    placeholder={kind === 'pending' ? t.pendingIncomeNamePlaceholder : t.incomeNamePlaceholder}
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

                {kind === 'pending' ? (
                  /* Expected Date — informational only, no cron/processor
                     depends on it. No account picker: which account this
                     lands in is chosen later, when marked collected. */
                  <View style={s.field}>
                    <DatePickerField
                      label={t.expectedDateOptional}
                      value={expectedDate}
                      onChange={setExpectedDate}
                      onClear={() => setExpectedDate('')}
                      placeholder={t.noExpectedDate}
                    />
                  </View>
                ) : (
                <>
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
                    onChangeText={v => setCreditDayRaw(toWesternDigits(v).replace(/[^0-9]/g, ''))}
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
                </>
                )}

                {/* Credit History (edit mode only, recurring entries only —
                    pending entries have no monthly credit schedule). */}
                {editingId && kind === 'recurring' && (() => {
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

        {/* ── Account Picker Modal ──
            Doubles as "pick a deposit account for the form" (collectingId
            null) and "pick which account this pending entry landed in"
            (collectingId set) — same list, different action on select. */}
        <Modal
          visible={showAccountPicker}
          animationType="slide"
          transparent
          onRequestClose={() => { setShowAccountPicker(false); setCollectingId(null); }}
        >
          <TouchableOpacity
            style={s.pickerOverlay}
            activeOpacity={1}
            onPress={() => { setShowAccountPicker(false); setCollectingId(null); }}
          >
            <View style={[s.pickerSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.pickerSheetHeaderRow}>
                {!!collectingId && (
                  <View style={[s.pickerSheetIcon, { backgroundColor: colors.green + '18' }]}>
                    <Feather name="check" size={14} color={colors.green} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[s.pickerSheetTitle, { color: colors.text }]}>
                    {collectingId ? t.markCollected : t.selectAccount}
                  </Text>
                  {!!collectingId && (
                    <Text style={[s.pickerSheetSubtitle, { color: colors.mutedForeground }]}>
                      {t.markCollectedPickAccountHint}
                    </Text>
                  )}
                </View>
              </View>
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
                      backgroundColor: !collectingId && cashAccountId === a.id ? colors.primary + '14' : 'transparent',
                    }]}
                    onPress={() => {
                      if (collectingId) {
                        impact(Haptics.ImpactFeedbackStyle.Medium);
                        const collected = recurringIncomes.find(r => r.id === collectingId);
                        markIncomeCollected(collectingId, a.id)
                          .then(() => {
                            if (!collected) return;
                            logActivity(
                              'income_collected',
                              t.activityIncomeCollectedTitle,
                              t.activityIncomeCollectedSubtitle(
                                collected.name,
                                collected.amount.toLocaleString('en-EG', { maximumFractionDigits: 0 }),
                                collected.currency,
                                a.accountName,
                              ),
                              collectingId,
                            );
                          })
                          .catch(() => {
                            Alert.alert(t.couldNotSave, t.couldNotOpenLinkDesc);
                          });
                        setCollectingId(null);
                      } else {
                        setCashAccountId(a.id);
                        setCurrency(a.currency);
                      }
                      setShowAccountPicker(false);
                    }}
                  >
                    <Text style={[s.pickerOptionText, {
                      color: !collectingId && cashAccountId === a.id ? colors.primary : colors.text,
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
  sectionHeader: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 4, marginBottom: 2 },
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

  // Pending-income card — a distinct two-row shape (stat header + a
  // footer that's either the expected date or the Mark Collected action)
  // rather than the recurring card's single row, since a receivable has
  // a lifecycle (pending → collected) the recurring card doesn't.
  pendingCard:       { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  pendingHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  pendingAmountRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 1 },
  pendingAmount:     { fontSize: 17, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  pendingCurrency:   { fontSize: 12, fontFamily: 'Inter_500Medium' },
  pendingBadge:      { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' },
  pendingBadgeText:  { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  pendingFooterRow:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  pendingCaption:     { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 },
  pendingCaptionText: { fontSize: 12, fontFamily: 'Inter_400Regular', flexShrink: 1 },
  collectBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  collectBtnText:  { fontSize: 12, fontFamily: 'Inter_700Bold' },

  form:    { gap: 16, paddingTop: 8 },
  field:   { gap: 6 },
  label:   { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  input:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  hint:    { fontSize: 11, fontFamily: 'Inter_400Regular' },
  chips:   { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip:    { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  kindToggle:  { flexDirection: 'row', gap: 8 },
  kindChip:    { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  kindChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

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
  pickerSheetHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pickerSheetIcon:   { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pickerSheetTitle:  { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  pickerSheetSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
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
