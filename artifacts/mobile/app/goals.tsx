import React, { useState, useCallback } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
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
import { Goal, useGoals } from '@/context/GoalsContext';
import { parseAmount, formatAmountInput } from '@/utils/parseAmount';

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${clampedPct}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.10)', overflow: 'hidden', marginVertical: 6 },
  fill:  { height: '100%', borderRadius: 3 },
});

export default function GoalsScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { goals, addGoal, updateGoal, removeGoal } = useGoals();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressGoalId, setProgressGoalId] = useState<string | null>(null);
  const [progressRaw, setProgressRaw] = useState('');

  const [name, setName] = useState('');
  const [targetRaw, setTargetRaw] = useState('');
  const [savedRaw, setSavedRaw] = useState('');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');

  const resetForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setTargetRaw('');
    setSavedRaw('');
    setDeadline('');
    setNote('');
  }, []);

  const openAdd = () => { resetForm(); setShowForm(true); };
  const openEdit = (g: Goal) => {
    setEditingId(g.id);
    setName(g.name);
    setTargetRaw(String(g.targetAmount));
    setSavedRaw(String(g.savedAmount));
    setDeadline(g.deadline ?? '');
    setNote(g.note ?? '');
    setShowForm(true);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    const target = parseAmount(targetRaw);
    const saved = parseAmount(savedRaw);
    if (!trimmed) { Alert.alert(t.goalName, t.goalNameError); return; }
    if (target <= 0) { Alert.alert(t.targetAmount, t.goalTargetError); return; }
    impact(Haptics.ImpactFeedbackStyle.Light);
    if (editingId) {
      const existing = goals.find(g => g.id === editingId);
      if (!existing) return;
      await updateGoal({ ...existing, name: trimmed, targetAmount: target, savedAmount: saved, deadline: deadline || undefined, note: note.trim() || undefined });
    } else {
      await addGoal({ id: generateId(), name: trimmed, targetAmount: target, savedAmount: saved, deadline: deadline || undefined, note: note.trim() || undefined, createdAt: new Date().toISOString() });
    }
    resetForm();
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
    setProgressRaw(g.savedAmount > 0 ? String(g.savedAmount) : '');
    setShowProgressModal(true);
  };

  const saveProgress = async () => {
    if (!progressGoalId) return;
    const g = goals.find(x => x.id === progressGoalId);
    if (!g) return;
    const amount = parseAmount(progressRaw);
    impact(Haptics.ImpactFeedbackStyle.Light);
    await updateGoal({ ...g, savedAmount: amount });
    setShowProgressModal(false);
    setProgressGoalId(null);
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { if (showForm) resetForm(); else router.back(); }} hitSlop={8}>
            <Feather name="chevron-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            {showForm ? (editingId ? t.editGoal : t.addGoal) : t.goals}
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
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]} keyboardShouldPersistTaps="handled">
            {!showForm ? (
              goals.length === 0 ? (
                <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[s.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                    <Feather name="target" size={30} color={colors.primary} />
                  </View>
                  <Text style={[s.emptyTitle, { color: colors.text }]}>{t.noGoals}</Text>
                  <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.noGoalsHint}</Text>
                  <TouchableOpacity style={[s.emptyBtn, { backgroundColor: colors.primary }]} onPress={openAdd} activeOpacity={0.85}>
                    <Feather name="plus" size={16} color={colors.primaryForeground} />
                    <Text style={[s.emptyBtnText, { color: colors.primaryForeground }]}>{t.addGoal}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.list}>
                  {goals.map(g => {
                    const pct = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0;
                    const done = pct >= 100;
                    const goalColor = done ? colors.green : colors.primary;
                    const remaining = Math.max(0, g.targetAmount - g.savedAmount);
                    return (
                      <SwipeToDelete key={g.id} onDelete={() => handleDelete(g.id)}>
                        <View style={[s.card, { backgroundColor: colors.card, borderColor: done ? colors.green + '40' : colors.border }]}>
                          <View style={s.cardTop}>
                            <View style={[s.cardIcon, { backgroundColor: goalColor + '18' }]}>
                              <Feather name={done ? 'check-circle' : 'target'} size={18} color={goalColor} />
                            </View>
                            <View style={s.cardBody}>
                              <Text style={[s.cardName, { color: colors.text }]} numberOfLines={1}>{g.name}</Text>
                              {g.deadline && (
                                <Text style={[s.cardDeadline, { color: colors.mutedForeground }]}>
                                  <Feather name="calendar" size={11} /> {new Date(g.deadline).toLocaleDateString('en-EG', { month: 'short', year: 'numeric', day: 'numeric' })}
                                </Text>
                              )}
                            </View>
                            <View style={[s.pctBadge, { backgroundColor: goalColor + '18' }]}>
                              <Text style={[s.pctText, { color: goalColor }]}>{Math.round(pct)}%</Text>
                            </View>
                          </View>

                          <ProgressBar pct={pct} color={goalColor} />

                          <View style={s.cardNums}>
                            <Text style={[s.savedNum, { color: goalColor }]}>
                              {g.savedAmount.toLocaleString('en-EG', { maximumFractionDigits: 0 })} <Text style={s.numUnit}>EGP saved</Text>
                            </Text>
                            <Text style={[s.targetNum, { color: colors.mutedForeground }]}>
                              of {g.targetAmount.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
                            </Text>
                          </View>

                          {!done && (
                            <Text style={[s.remaining, { color: colors.mutedForeground }]}>
                              {remaining.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP {t.remaining}
                            </Text>
                          )}
                          {done && (
                            <Text style={[s.achieved, { color: colors.green }]}>{t.achieved}</Text>
                          )}

                          <View style={s.cardActions}>
                            <TouchableOpacity
                              style={[s.actionBtn, { backgroundColor: colors.muted }]}
                              onPress={() => openProgress(g)}
                            >
                              <Feather name="trending-up" size={13} color={colors.mutedForeground} />
                              <Text style={[s.actionBtnText, { color: colors.mutedForeground }]}>{t.updateProgress}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[s.actionBtn, { backgroundColor: colors.muted }]}
                              onPress={() => openEdit(g)}
                            >
                              <Feather name="edit-2" size={13} color={colors.mutedForeground} />
                              <Text style={[s.actionBtnText, { color: colors.mutedForeground }]}>{t.editGoal}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </SwipeToDelete>
                    );
                  })}
                </View>
              )
            ) : (
              <View style={s.form}>
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.goalName}</Text>
                  <TextInput style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]} value={name} onChangeText={setName} placeholder={t.goalNamePlaceholder} placeholderTextColor={colors.mutedForeground} returnKeyType="next" />
                </View>
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.targetAmount}</Text>
                  <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                    <TextInput style={[s.inputFlex, { color: colors.text }]} value={targetRaw} onChangeText={v => setTargetRaw(formatAmountInput(v))} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
                    <Text style={[s.unit, { color: colors.mutedForeground }]}>EGP</Text>
                  </View>
                </View>
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.goalSaved}</Text>
                  <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                    <TextInput style={[s.inputFlex, { color: colors.text }]} value={savedRaw} onChangeText={v => setSavedRaw(formatAmountInput(v))} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
                    <Text style={[s.unit, { color: colors.mutedForeground }]}>EGP</Text>
                  </View>
                </View>
                <View style={s.field}>
                  <DatePickerField label={t.goalDeadlineOptional} value={deadline} onChange={setDeadline} onClear={() => setDeadline('')} placeholder={t.noEndDate} />
                </View>
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.notes}</Text>
                  <TextInput style={[s.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border, height: 72, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} placeholder={t.addNote} placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} />
                </View>
                <View style={s.btns}>
                  <TouchableOpacity style={[s.btnCancel, { backgroundColor: colors.muted }]} onPress={resetForm} activeOpacity={0.8}>
                    <Text style={[s.btnCancelText, { color: colors.text }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btnSave, { backgroundColor: colors.primary }]} onPress={handleSave} activeOpacity={0.85}>
                    <Text style={[s.btnSaveText, { color: colors.primaryForeground }]}>{t.save}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Update Progress Modal */}
        <Modal visible={showProgressModal} transparent animationType="fade" onRequestClose={() => setShowProgressModal(false)}>
          <View style={s.overlay}>
            <View style={[s.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.progressTitle, { color: colors.text }]}>{t.updateProgress}</Text>
              <Text style={[s.progressSub, { color: colors.mutedForeground }]}>{t.goalSaved}</Text>
              <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.border, marginTop: 12 }]}>
                <TextInput
                  style={[s.inputFlex, { color: colors.text, fontSize: 18 }]}
                  value={progressRaw}
                  onChangeText={v => setProgressRaw(formatAmountInput(v))}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <Text style={[s.unit, { color: colors.mutedForeground }]}>EGP</Text>
              </View>
              <View style={[s.btns, { marginTop: 16 }]}>
                <TouchableOpacity style={[s.btnCancel, { backgroundColor: colors.muted }]} onPress={() => setShowProgressModal(false)}>
                  <Text style={[s.btnCancelText, { color: colors.text }]}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnSave, { backgroundColor: colors.primary }]} onPress={saveProgress}>
                  <Text style={[s.btnSaveText, { color: colors.primaryForeground }]}>{t.save}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete confirm (web) */}
        <Modal visible={!!pendingDeleteId} transparent animationType="fade" onRequestClose={() => setPendingDeleteId(null)}>
          <View style={s.overlay}>
            <View style={[s.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.progressTitle, { color: colors.text }]}>{t.deleteGoal}</Text>
              <Text style={[s.progressSub, { color: colors.mutedForeground }]}>{t.deleteGoalConfirm}</Text>
              <View style={[s.btns, { marginTop: 16 }]}>
                <TouchableOpacity style={[s.btnCancel, { backgroundColor: colors.muted }]} onPress={() => setPendingDeleteId(null)}>
                  <Text style={[s.btnCancelText, { color: colors.text }]}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnSave, { backgroundColor: colors.red }]} onPress={() => { const id = pendingDeleteId!; setPendingDeleteId(null); removeGoal(id); }}>
                  <Text style={[s.btnSaveText, { color: '#fff' }]}>{t.delete}</Text>
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
  screen:  { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 0 },

  empty:      { borderRadius: 18, borderWidth: 1, padding: 32, alignItems: 'center', gap: 10, marginTop: 8 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyHint:  { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 6 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  list: { gap: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  cardIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 3 },
  cardName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardDeadline: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  pctBadge: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  pctText:  { fontSize: 12, fontFamily: 'Inter_700Bold' },
  cardNums: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 },
  savedNum: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  numUnit:  { fontSize: 12, fontFamily: 'Inter_400Regular' },
  targetNum: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  remaining: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 3 },
  achieved:  { fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 3 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7 },
  actionBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  form:  { gap: 16, paddingTop: 8 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  inputFlex: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', paddingVertical: 12 },
  unit: { fontSize: 14, fontFamily: 'Inter_500Medium', paddingLeft: 6 },

  btns:          { flexDirection: 'row', gap: 10 },
  btnCancel:     { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnCancelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  btnSave:       { flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnSaveText:   { fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  overlay:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
  progressCard:  { width: '100%', borderRadius: 18, borderWidth: 1, padding: 22 },
  progressTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  progressSub:   { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
