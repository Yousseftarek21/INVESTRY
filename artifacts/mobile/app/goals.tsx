import React, { useState, useCallback } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerField } from '@/components/DatePickerField';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { Goal, useGoals } from '@/context/GoalsContext';
import { useCash } from '@/context/CashContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { parseAmount } from '@/utils/parseAmount';
import { AmountInput } from '@/components/AmountInput';
import { GoalCelebration } from '@/components/GoalCelebration';
import { CashAccountType } from '@/types';

const FREE_LIMIT = 0;

const ACCOUNT_TYPE_ICONS: Record<CashAccountType, keyof typeof Feather.glyphMap> = {
  bank: 'credit-card',
  cash_home: 'dollar-sign',
  foreign_currency: 'globe',
};

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Gradient fill (not a flat block) so a goal card's progress bar carries the
// same "identity" treatment as the rest of the app's accent surfaces, and a
// themed track (not a fixed black overlay) so it actually reads on a dark
// card, not just a light one.
function ProgressBar({ pct, color, trackColor }: { pct: number; color: string; trackColor: string }) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  return (
    <View style={[pb.track, { backgroundColor: trackColor }]}>
      <ExpoLinearGradient
        colors={[color + 'B0', color]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[pb.fill, { width: `${clampedPct}%` as any }]}
      />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10, marginBottom: 8 },
  fill:  { height: '100%', borderRadius: 4 },
});

// Answers the question a goal actually raises but the card never did: will
// this be met on time? Required pace is pure arithmetic and always correct.
// The verdict is only offered once there's a month of history to measure
// against — before that, observed pace is noise, and a confident "behind"
// derived from three days of data would be worse than saying nothing.
function goalPacing(g: { targetAmount: number; deadline?: string; createdAt: string }, saved: number) {
  const remaining = Math.max(0, g.targetAmount - saved);
  if (remaining <= 0 || !g.deadline) return null;

  const now = Date.now();
  const due = new Date(g.deadline).getTime();
  if (!Number.isFinite(due)) return null;

  const MS_MONTH = 30.44 * 86_400_000;
  const monthsLeft = (due - now) / MS_MONTH;
  if (monthsLeft <= 0) return { overdue: true as const };

  const requiredPerMonth = remaining / monthsLeft;

  const created = new Date(g.createdAt).getTime();
  const monthsElapsed = Number.isFinite(created) ? (now - created) / MS_MONTH : 0;
  // Under a month of history, or nothing saved yet, gives no usable rate.
  if (monthsElapsed < 1 || saved <= 0) return { overdue: false as const, requiredPerMonth, behindMonths: null };

  const observedPerMonth = saved / monthsElapsed;
  const monthsNeeded = observedPerMonth > 0 ? remaining / observedPerMonth : Infinity;
  const behindMonths = Math.round(monthsNeeded - monthsLeft);
  return { overdue: false as const, requiredPerMonth, behindMonths };
}

export default function GoalsScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { goals, addGoal, updateGoal, removeGoal } = useGoals();
  const { cashAccounts } = useCash();
  const egpCashAccounts = cashAccounts.filter(a => a.currency === 'EGP');
  const { featuresUnlocked, isLoading: subLoading, showPaywallFromModal } = useSubscription();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressGoalId, setProgressGoalId] = useState<string | null>(null);
  const [progressRaw, setProgressRaw] = useState('');
  // Set only at the moment a save/edit actually crosses a goal from
  // not-yet-funded to funded — never re-derived from the list on render, so
  // reopening this screen with an already-completed goal doesn't replay it.
  const [celebrateGoalName, setCelebrateGoalName] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [targetRaw, setTargetRaw] = useState('');
  const [savedRaw, setSavedRaw] = useState('');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);

  // A goal linked to a cash account tracks that account's live balance
  // instead of the manually-entered savedAmount — falls back to the last
  // stored snapshot if the account was since deleted.
  // ?? 0 guards: savedAmount is typed as a plain number but has come
  // through null at runtime (same gap the Overview hero card's
  // effectiveGoalSaved hit and was fixed for) — an unguarded null here
  // crashes every .toLocaleString() call below that reads from it.
  const effectiveSaved = useCallback((g: Goal) => {
    if (!g.linkedCashAccountId) return g.savedAmount ?? 0;
    const account = cashAccounts.find(a => a.id === g.linkedCashAccountId);
    return (account ? account.balance : g.savedAmount) ?? 0;
  }, [cashAccounts]);

  const resetForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setTargetRaw('');
    setSavedRaw('');
    setDeadline('');
    setNote('');
    setLinkedAccountId(null);
  }, []);

  const openAdd = () => { resetForm(); setShowForm(true); };
  const openEdit = (g: Goal) => {
    setEditingId(g.id);
    setName(g.name);
    // ?? 0 — a null here isn't a crash (String(null) is "null"), but it
    // put the literal word "null" into the edit field instead of 0.
    setTargetRaw(String(g.targetAmount ?? 0));
    setSavedRaw(String(g.savedAmount ?? 0));
    setDeadline(g.deadline ?? '');
    setNote(g.note ?? '');
    setLinkedAccountId(g.linkedCashAccountId ?? null);
    setShowForm(true);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    const target = parseAmount(targetRaw);
    const linkedAccount = linkedAccountId ? cashAccounts.find(a => a.id === linkedAccountId) : undefined;
    const saved = linkedAccount ? linkedAccount.balance : parseAmount(savedRaw);
    if (!trimmed) { Alert.alert(t.goalName, t.goalNameError); return; }
    if (target <= 0) { Alert.alert(t.targetAmount, t.goalTargetError); return; }
    if (!editingId && !subLoading && !featuresUnlocked && goals.length >= FREE_LIMIT) {
      showPaywallFromModal();
      return;
    }
    impact(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (editingId) {
        const existing = goals.find(g => g.id === editingId);
        if (!existing) return;
        const wasDone = existing.targetAmount > 0 && existing.savedAmount >= existing.targetAmount;
        const nowDone = target > 0 && saved >= target;
        await updateGoal({ ...existing, name: trimmed, targetAmount: target, savedAmount: saved, deadline: deadline || undefined, note: note.trim() || undefined, linkedCashAccountId: linkedAccountId ?? undefined });
        if (!wasDone && nowDone) setCelebrateGoalName(trimmed);
      } else {
        await addGoal({ id: generateId(), name: trimmed, targetAmount: target, savedAmount: saved, deadline: deadline || undefined, note: note.trim() || undefined, createdAt: new Date().toISOString(), linkedCashAccountId: linkedAccountId ?? undefined });
      }
      resetForm();
    } catch {
      Alert.alert(t.couldNotSave, t.couldNotOpenLinkDesc);
    }
  };

  const handleDelete = (id: string) => {
    if (Platform.OS === 'web') { setPendingDeleteId(id); return; }
    Alert.alert(t.deleteGoal, t.deleteGoalConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => { impact(Haptics.ImpactFeedbackStyle.Medium); removeGoal(id); } },
    ]);
  };

  const openProgress = (g: Goal) => {
    setProgressGoalId(g.id);
    setProgressRaw('');
    setShowProgressModal(true);
  };

  // Adds to the goal's existing savedAmount rather than overwriting it — the
  // old behavior required mentally computing (old total + new deposit)
  // before typing anything, which is exactly the kind of manual math that
  // produces wrong numbers. To set an absolute value instead (e.g. correcting
  // a mistake), use Edit Goal.
  const saveProgress = async () => {
    if (!progressGoalId) return;
    const g = goals.find(x => x.id === progressGoalId);
    if (!g) return;
    const amount = parseAmount(progressRaw);
    if (!amount || isNaN(amount) || amount <= 0) {
      Alert.alert(t.amountToAddLabel, t.invalidAddAmount);
      return;
    }
    impact(Haptics.ImpactFeedbackStyle.Light);
    const wasDone = g.targetAmount > 0 && g.savedAmount >= g.targetAmount;
    const newSaved = g.savedAmount + amount;
    const nowDone = g.targetAmount > 0 && newSaved >= g.targetAmount;
    try {
      await updateGoal({ ...g, savedAmount: newSaved });
      setShowProgressModal(false);
      setProgressGoalId(null);
      if (!wasDone && nowDone) setCelebrateGoalName(g.name);
    } catch {
      Alert.alert(t.couldNotSave, t.couldNotOpenLinkDesc);
    }
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        {/* Ambient bloom — same identity wash the Home tab opens with, just
            more subdued here since this is a secondary screen, not the hub. */}
        <ExpoLinearGradient
          colors={[colors.primary + '20', colors.primary + '0A', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.bloom}
          pointerEvents="none"
        />

        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => { if (showForm) resetForm(); else router.back(); }} hitSlop={8} style={[s.headerIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name={backChevron()} size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            {showForm ? (editingId ? t.editGoal : t.addGoal) : t.goals}
          </Text>
          {!showForm ? (
            <TouchableOpacity onPress={openAdd} hitSlop={8} style={[s.headerIconBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '30' }]}>
              <Feather name="plus" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={s.headerIconBtn} />
          )}
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]} keyboardShouldPersistTaps="handled">
            {!showForm ? (
              goals.length === 0 ? (
                <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <ExpoLinearGradient
                    colors={[colors.primary + '00', colors.primary + 'CC', colors.primary + '00']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.cardAccent}
                  />
                  <View style={s.emptyBody}>
                    <ExpoLinearGradient
                      colors={[colors.primary + '30', colors.primary + '10']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.emptyIcon}
                    >
                      <Feather name="target" size={30} color={colors.primary} />
                    </ExpoLinearGradient>
                    <Text style={[s.emptyTitle, { color: colors.text }]}>{t.noGoals}</Text>
                    <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.noGoalsHint}</Text>
                    <TouchableOpacity onPress={openAdd} activeOpacity={0.85} style={s.emptyBtnWrap}>
                      <ExpoLinearGradient
                        colors={[colors.goldLight, colors.primary]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={s.emptyBtn}
                      >
                        <Feather name="plus" size={16} color={colors.primaryForeground} />
                        <Text style={[s.emptyBtnText, { color: colors.primaryForeground }]}>{t.addGoal}</Text>
                      </ExpoLinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={s.list}>
                  {goals.map(g => {
                    const saved = effectiveSaved(g);
                    const pct = g.targetAmount > 0 ? (saved / g.targetAmount) * 100 : 0;
                    const done = pct >= 100;
                    const goalColor = done ? colors.green : colors.primary;
                    const remaining = Math.max(0, g.targetAmount - saved);
                    const linkedAccount = g.linkedCashAccountId ? cashAccounts.find(a => a.id === g.linkedCashAccountId) : undefined;
                    return (
                      <SwipeToDelete key={g.id} onDelete={() => handleDelete(g.id)}>
                        <View style={[s.card, { backgroundColor: colors.card, borderColor: done ? colors.green + '40' : colors.border }]}>
                          <ExpoLinearGradient
                            colors={[goalColor + '00', goalColor + 'CC', goalColor + '00']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={s.cardAccent}
                          />
                          <View style={s.cardBody}>
                            <View style={s.cardTop}>
                              <ExpoLinearGradient
                                colors={[goalColor + '38', goalColor + '14']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={s.cardIcon}
                              >
                                <Feather name={done ? 'check-circle' : 'target'} size={19} color={goalColor} />
                              </ExpoLinearGradient>
                              <View style={s.cardInfo}>
                                <Text style={[s.cardName, { color: colors.text }]} numberOfLines={1}>{g.name}</Text>
                                {g.deadline && (
                                  <View style={s.cardDeadlineRow}>
                                    <Feather name="calendar" size={11} color={colors.mutedForeground} />
                                    <Text style={[s.cardDeadline, { color: colors.mutedForeground }]}>
                                      {new Date(g.deadline).toLocaleDateString('en-EG', { month: 'short', year: 'numeric', day: 'numeric' })}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <View style={[s.pctBadge, { backgroundColor: goalColor + '18', borderColor: goalColor + '30' }]}>
                                <Text style={[s.pctText, { color: goalColor }]}>{Math.round(pct)}%</Text>
                              </View>
                            </View>

                            <ProgressBar pct={pct} color={goalColor} trackColor={colors.muted} />

                            <View style={s.cardNums}>
                              <Text style={[s.savedNum, { color: goalColor, flexShrink: 1 }]} numberOfLines={1}>
                                {saved.toLocaleString('en-EG', { maximumFractionDigits: 0 })}
                                <Text style={[s.numUnit, { color: colors.mutedForeground }]}>  {linkedAccount?.currency ?? 'EGP'} saved</Text>
                              </Text>
                              <Text style={[s.targetNum, { color: colors.mutedForeground, flexShrink: 1 }]} numberOfLines={1}>
                                of {(g.targetAmount ?? 0).toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
                              </Text>
                            </View>

                            {!done && (
                              <Text style={[s.remaining, { color: colors.mutedForeground }]}>
                                {remaining.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP {t.remaining}
                              </Text>
                            )}
                            {done && (
                              <View style={[s.achievedRow, { backgroundColor: colors.green + '14' }]}>
                                <Feather name="award" size={12} color={colors.green} />
                                <Text style={[s.achieved, { color: colors.green }]}>{t.achieved}</Text>
                              </View>
                            )}
                            {!done && (() => {
                              const pace = goalPacing(g, saved);
                              if (!pace) return null;
                              if (pace.overdue) {
                                return (
                                  <Text style={[s.pacing, { color: colors.red }]} numberOfLines={2}>
                                    {t.goalDeadlinePassed}
                                  </Text>
                                );
                              }
                              const behind = pace.behindMonths;
                              const onTrack = behind !== null && behind <= 0;
                              return (
                                <Text
                                  style={[s.pacing, { color: onTrack ? colors.green : colors.mutedForeground }]}
                                  numberOfLines={2}
                                >
                                  {t.goalNeedPerMonth(pace.requiredPerMonth.toLocaleString('en-EG', { maximumFractionDigits: 0 }))}
                                  {behind !== null && (onTrack ? ` · ${t.goalOnTrack}` : ` · ${t.goalBehindBy(behind)}`)}
                                </Text>
                              );
                            })()}

                            {linkedAccount && (
                              <View style={[s.syncedRow, { backgroundColor: colors.primary + '12' }]}>
                                <Feather name="refresh-cw" size={11} color={colors.primary} />
                                <Text style={[s.syncedText, { color: colors.primary }]} numberOfLines={1}>
                                  {t.syncedWith} {linkedAccount.accountName}
                                </Text>
                              </View>
                            )}

                            <View style={s.cardActions}>
                              {!linkedAccount && (
                                <TouchableOpacity
                                  style={[s.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                                  onPress={() => openProgress(g)}
                                  activeOpacity={0.75}
                                >
                                  <Feather name="trending-up" size={13} color={colors.text} />
                                  <Text style={[s.actionBtnText, { color: colors.text }]}>{t.updateProgress}</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                style={[s.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                                onPress={() => openEdit(g)}
                                activeOpacity={0.75}
                              >
                                <Feather name="edit-2" size={13} color={colors.text} />
                                <Text style={[s.actionBtnText, { color: colors.text }]}>{t.editGoal}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[s.deleteBtn, { backgroundColor: colors.red + '12', borderColor: colors.red + '28' }]}
                                onPress={() => handleDelete(g.id)}
                                hitSlop={8}
                                activeOpacity={0.75}
                              >
                                <Feather name="trash-2" size={14} color={colors.red} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </SwipeToDelete>
                    );
                  })}
                </View>
              )
            ) : (
              <View style={s.form}>
                <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.mutedForeground }]}>{t.goalName}</Text>
                    <TextInput style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]} value={name} onChangeText={setName} placeholder={t.goalNamePlaceholder} placeholderTextColor={colors.mutedForeground} returnKeyType="next" />
                  </View>
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.mutedForeground }]}>{t.targetAmount}</Text>
                    <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                      <AmountInput style={[s.inputFlex, { color: colors.text }]} value={targetRaw} onChangeText={setTargetRaw} placeholder="0" placeholderTextColor={colors.mutedForeground} />
                      <Text style={[s.unit, { color: colors.mutedForeground }]}>EGP</Text>
                    </View>
                  </View>
                </View>

                <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.mutedForeground }]}>{t.linkCashAccount}</Text>
                    <Text style={[s.hint, { color: colors.mutedForeground }]}>{t.linkCashAccountHint}</Text>
                    {/* Only EGP accounts are linkable — the target amount is always
                        entered in EGP (no currency picker on that field), so linking
                        a foreign-currency account would compare mismatched units:
                        the "saved" figure and the % progress would silently be wrong,
                        not just mislabeled. */}
                    {egpCashAccounts.length === 0 ? (
                      <Text style={[s.hint, { color: colors.mutedForeground, marginTop: 4 }]}>
                        {cashAccounts.length === 0 ? t.noCashAccountsToLink : t.noEgpAccountsToLink}
                      </Text>
                    ) : (
                      <View style={s.accountPicker}>
                        <TouchableOpacity
                          style={[s.accountRow, { backgroundColor: colors.background, borderColor: linkedAccountId === null ? colors.primary : colors.border }]}
                          onPress={() => setLinkedAccountId(null)}
                          activeOpacity={0.7}
                        >
                          <View style={[s.accountRowIcon, { backgroundColor: colors.muted }]}>
                            <Feather name="edit-3" size={16} color={colors.mutedForeground} />
                          </View>
                          <Text style={[s.accountRowName, { color: colors.text, flex: 1 }]}>{t.noLinkManualEntry}</Text>
                          <View style={[s.radio, { borderColor: linkedAccountId === null ? colors.primary : colors.border }]}>
                            {linkedAccountId === null && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
                          </View>
                        </TouchableOpacity>
                        {egpCashAccounts.map(a => {
                          const selected = linkedAccountId === a.id;
                          return (
                            <TouchableOpacity
                              key={a.id}
                              style={[s.accountRow, { backgroundColor: colors.background, borderColor: selected ? colors.primary : colors.border }]}
                              onPress={() => setLinkedAccountId(a.id)}
                              activeOpacity={0.7}
                            >
                              <View style={[s.accountRowIcon, { backgroundColor: colors.primary + '16' }]}>
                                <Feather name={ACCOUNT_TYPE_ICONS[a.type] ?? 'credit-card'} size={16} color={colors.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[s.accountRowName, { color: colors.text }]} numberOfLines={1}>{a.accountName}</Text>
                                <Text style={[s.accountRowBalance, { color: colors.mutedForeground }]} numberOfLines={1}>
                                  {a.balance.toLocaleString('en-EG', { maximumFractionDigits: 0 })} {a.currency}
                                </Text>
                              </View>
                              <View style={[s.radio, { borderColor: selected ? colors.primary : colors.border }]}>
                                {selected && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>

                <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {linkedAccountId ? (
                    <View style={s.field}>
                      <Text style={[s.label, { color: colors.mutedForeground }]}>{t.goalSaved}</Text>
                      <View style={[s.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                        <Text style={[s.inputFlex, { color: colors.text, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' }]}>
                          {(cashAccounts.find(a => a.id === linkedAccountId)?.balance ?? 0).toLocaleString('en-EG', { maximumFractionDigits: 0 })}
                        </Text>
                        <Text style={[s.unit, { color: colors.mutedForeground }]}>EGP</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={s.field}>
                      <Text style={[s.label, { color: colors.mutedForeground }]}>{t.goalSaved}</Text>
                      <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                        <AmountInput style={[s.inputFlex, { color: colors.text }]} value={savedRaw} onChangeText={setSavedRaw} placeholder="0" placeholderTextColor={colors.mutedForeground} />
                        <Text style={[s.unit, { color: colors.mutedForeground }]}>EGP</Text>
                      </View>
                    </View>
                  )}
                  <View style={s.field}>
                    <DatePickerField label={t.goalDeadlineOptional} value={deadline} onChange={setDeadline} onClear={() => setDeadline('')} placeholder={t.noEndDate} />
                  </View>
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.mutedForeground }]}>{t.notes}</Text>
                    <TextInput style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border, height: 72, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} placeholder={t.addNote} placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} />
                  </View>
                </View>

                <View style={s.btns}>
                  <TouchableOpacity style={[s.btnCancel, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={resetForm} activeOpacity={0.8}>
                    <Text style={[s.btnCancelText, { color: colors.text }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} activeOpacity={0.85} style={s.btnSaveWrap}>
                    <ExpoLinearGradient colors={[colors.goldLight, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btnSave}>
                      <Text style={[s.btnSaveText, { color: colors.primaryForeground }]}>{t.save}</Text>
                    </ExpoLinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Add Savings Modal — adds to the existing total, doesn't overwrite it */}
        <Modal visible={showProgressModal} transparent animationType="fade" onRequestClose={() => setShowProgressModal(false)}>
          <View style={s.overlay}>
            <View style={[s.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ExpoLinearGradient
                colors={[colors.primary + '00', colors.primary + 'CC', colors.primary + '00']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.cardAccent}
              />
              <View style={s.progressCardBody}>
                <Text style={[s.progressTitle, { color: colors.text }]}>{t.updateProgress}</Text>
                {progressGoalId && (() => {
                  const g = goals.find(x => x.id === progressGoalId);
                  if (!g) return null;
                  return (
                    <Text style={[s.progressSub, { color: colors.mutedForeground, marginBottom: 4 }]}>
                      {t.currentlySavedLabel}: {(g.savedAmount ?? 0).toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
                    </Text>
                  );
                })()}
                <Text style={[s.progressSub, { color: colors.mutedForeground }]}>{t.amountToAddLabel}</Text>
                <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.border, marginTop: 12 }]}>
                  <AmountInput
                    style={[s.inputFlex, { color: colors.text, fontSize: 18 }]}
                    value={progressRaw}
                    onChangeText={setProgressRaw}
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    autoFocus
                  />
                  <Text style={[s.unit, { color: colors.mutedForeground }]}>EGP</Text>
                </View>
                <View style={[s.btns, { marginTop: 16 }]}>
                  <TouchableOpacity style={[s.btnCancel, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setShowProgressModal(false)}>
                    <Text style={[s.btnCancelText, { color: colors.text }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveProgress} activeOpacity={0.85} style={s.btnSaveWrap}>
                    <ExpoLinearGradient colors={[colors.goldLight, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btnSave}>
                      <Text style={[s.btnSaveText, { color: colors.primaryForeground }]}>{t.save}</Text>
                    </ExpoLinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete confirm (web) */}
        <Modal visible={!!pendingDeleteId} transparent animationType="fade" onRequestClose={() => setPendingDeleteId(null)}>
          <View style={s.overlay}>
            <View style={[s.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ExpoLinearGradient
                colors={[colors.red + '00', colors.red + 'CC', colors.red + '00']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.cardAccent}
              />
              <View style={s.progressCardBody}>
                <Text style={[s.progressTitle, { color: colors.text }]}>{t.deleteGoal}</Text>
                <Text style={[s.progressSub, { color: colors.mutedForeground }]}>{t.deleteGoalConfirm}</Text>
                <View style={[s.btns, { marginTop: 16 }]}>
                  <TouchableOpacity style={[s.btnCancel, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setPendingDeleteId(null)}>
                    <Text style={[s.btnCancelText, { color: colors.text }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btnSave, { backgroundColor: colors.red }]} onPress={() => { const id = pendingDeleteId!; setPendingDeleteId(null); removeGoal(id); }}>
                    <Text style={[s.btnSaveText, { color: '#fff' }]}>{t.delete}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        <GoalCelebration goalName={celebrateGoalName} onDismiss={() => setCelebrateGoalName(null)} />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1 },
  bloom:   { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },

  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  headerIconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.2 },
  content: { padding: 16, gap: 0 },

  // Shared thin accent line that opens every card family on this screen —
  // same treatment as the Home tab's hero card, scaled down.
  cardAccent: { height: 1.5 },

  empty:      { borderRadius: 24, borderWidth: 1, overflow: 'hidden', marginTop: 8 },
  emptyBody:  { padding: 32, alignItems: 'center', gap: 10 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyHint:  { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19, maxWidth: 260 },
  emptyBtnWrap: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  list: { gap: 14 },
  card: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  cardBody: { padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 3 },
  cardName: { fontSize: 15.5, fontFamily: 'Inter_600SemiBold' },
  cardDeadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDeadline: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  pctBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  pctText:  { fontSize: 12.5, fontFamily: 'Inter_700Bold' },
  cardNums: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  savedNum: { fontSize: 19, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  numUnit:  { fontSize: 12, fontFamily: 'Inter_500Medium' },
  targetNum: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  remaining: { fontSize: 12.5, fontFamily: 'Inter_400Regular', marginTop: 4 },
  pacing:      { fontSize: 11.5, fontFamily: 'Inter_500Medium', marginTop: 5, lineHeight: 15.5 },
  achievedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 3 },
  achieved:  { fontSize: 12.5, fontFamily: 'Inter_700Bold' },
  syncedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, marginTop: 8 },
  syncedText: { fontSize: 11.5, fontFamily: 'Inter_500Medium' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10 },
  actionBtnText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  deleteBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },

  form:  { gap: 14, paddingTop: 8 },
  section: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3, textTransform: 'uppercase' },
  hint:  { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  accountPicker: { gap: 8, marginTop: 4 },
  accountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5, padding: 12,
  },
  accountRowIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  accountRowName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  accountRowBalance: { fontSize: 12.5, fontFamily: 'Inter_400Regular', marginTop: 1, fontVariant: ['tabular-nums'] },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  inputFlex: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', paddingVertical: 12 },
  unit: { fontSize: 14, fontFamily: 'Inter_500Medium', paddingLeft: 6 },

  btns:          { flexDirection: 'row', gap: 10 },
  btnCancel:     { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14, alignItems: 'center' },
  btnCancelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  btnSaveWrap:   { flex: 2, borderRadius: 14, overflow: 'hidden' },
  btnSave:       { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnSaveText:   { fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  overlay:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
  progressCard:  { width: '100%', borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  progressCardBody: { padding: 22 },
  progressTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  progressSub:   { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
