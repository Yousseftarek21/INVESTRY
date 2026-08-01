import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { usePortfolioTargets, AllocationClass, TargetAllocation } from '@/hooks/usePortfolioTargets';

interface ClassMeta {
  key: AllocationClass;
  color: string;
  icon: { lib: 'feather'; name: keyof typeof Feather.glyphMap } | { lib: 'mci'; name: string };
}

export default function TargetAllocationScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { configured, targets, driftAlertsEnabled: savedDriftEnabled, isLoading, save } = usePortfolioTargets();

  const CLASSES: ClassMeta[] = useMemo(() => [
    { key: 'gold', color: colors.primary, icon: { lib: 'mci', name: 'gold' } },
    { key: 'silver', color: colors.silverColor, icon: { lib: 'mci', name: 'gold' } },
    { key: 'stock', color: '#4A9EFF', icon: { lib: 'feather', name: 'bar-chart-2' } },
    { key: 'realEstate', color: '#A47FCA', icon: { lib: 'mci', name: 'home-city' } },
    { key: 'personalAsset', color: '#E08E45', icon: { lib: 'mci', name: 'tag-multiple' } },
    { key: 'fixedIncome', color: '#22C55E', icon: { lib: 'mci', name: 'bank-transfer' } },
  ], [colors]);

  const CLASS_LABEL: Record<AllocationClass, string> = {
    gold: t.gold, silver: t.silver, stock: t.egxStocksAllocLabel,
    realEstate: t.realEstate, personalAsset: t.personalAssetsAllocLabel, fixedIncome: t.fixedIncome,
  };

  const [values, setValues] = useState<Record<AllocationClass, string>>({
    gold: '', silver: '', stock: '', realEstate: '', personalAsset: '', fixedIncome: '',
  });
  const [driftAlertsEnabled, setDriftAlertsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Seed local input state from the server once, the first time it loads —
  // never again after, so the user's in-progress edits can't be clobbered
  // by a background refetch.
  useEffect(() => {
    if (hydrated || isLoading) return;
    if (configured) {
      const next: Record<AllocationClass, string> = { gold: '', silver: '', stock: '', realEstate: '', personalAsset: '', fixedIncome: '' };
      (Object.keys(next) as AllocationClass[]).forEach(k => {
        const v = targets[k];
        if (v !== undefined) next[k] = String(v);
      });
      setValues(next);
      setDriftAlertsEnabled(savedDriftEnabled);
    }
    setHydrated(true);
  }, [isLoading, configured, targets, savedDriftEnabled, hydrated]);

  const sum = useMemo(() => (Object.values(values) as string[]).reduce((acc, v) => acc + (parseFloat(v) || 0), 0), [values]);
  const overLimit = sum > 100.5;

  const setValue = (key: AllocationClass, raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setValues(prev => ({ ...prev, [key]: cleaned }));
  };

  const handleSave = async () => {
    const clean: TargetAllocation = {};
    (Object.keys(values) as AllocationClass[]).forEach(k => {
      const n = parseFloat(values[k]);
      if (Number.isFinite(n) && n > 0) clean[k] = Math.min(100, n);
    });
    if (Object.keys(clean).length === 0) {
      Alert.alert(t.targetAllocationTitle, t.targetSumWarning);
      return;
    }
    if (overLimit) {
      Alert.alert(t.targetAllocationTitle, t.targetSumWarning);
      return;
    }
    impact();
    setSaving(true);
    const ok = await save(clean, driftAlertsEnabled);
    setSaving(false);
    if (ok) {
      router.back();
    } else {
      Alert.alert(t.targetAllocationTitle, t.targetsSaveFailed);
    }
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name="chevron-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.targetAllocationTitle}</Text>
          <View style={{ width: 22 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]} keyboardShouldPersistTaps="handled">
            <Text style={[s.hint, { color: colors.mutedForeground }]}>{t.targetAllocationHint}</Text>

            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {CLASSES.map((c, i) => (
                <View key={c.key} style={[s.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <View style={[s.iconBox, { backgroundColor: c.color + '1A' }]}>
                    {c.icon.lib === 'mci'
                      ? <MaterialCommunityIcons name={c.icon.name as any} size={17} color={c.color} />
                      : <Feather name={c.icon.name} size={17} color={c.color} />}
                  </View>
                  <Text style={[s.rowLabel, { color: colors.text }]}>{CLASS_LABEL[c.key]}</Text>
                  <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                    <TextInput
                      style={[s.input, { color: colors.text }]}
                      value={values[c.key]}
                      onChangeText={v => setValue(c.key, v)}
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      maxLength={5}
                    />
                    <Text style={[s.pct, { color: colors.mutedForeground }]}>%</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={s.sumRow}>
              <Text style={[s.sumText, { color: overLimit ? colors.red : colors.mutedForeground }]}>
                {t.targetSumLabel(sum.toFixed(0))}
              </Text>
              {overLimit && (
                <Text style={[s.sumWarning, { color: colors.red }]}>{t.targetSumWarning}</Text>
              )}
            </View>

            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
              <View style={s.toggleRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[s.rowLabel, { color: colors.text }]}>{t.driftAlertsToggleLabel}</Text>
                  <Text style={[s.toggleDesc, { color: colors.mutedForeground }]}>{t.driftAlertsToggleDesc}</Text>
                </View>
                <Switch
                  value={driftAlertsEnabled} onValueChange={setDriftAlertsEnabled}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor={Platform.OS === 'android' ? (driftAlertsEnabled ? colors.primary : colors.mutedForeground) : undefined}
                  ios_backgroundColor={colors.muted}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={[s.saveBtnText, { color: colors.primaryForeground }]}>{t.saveTargets}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 4 },
  hint: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 14 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, width: 84 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', paddingVertical: 8, textAlign: 'right' },
  pct: { fontSize: 13, fontFamily: 'Inter_500Medium', marginLeft: 4 },
  sumRow: { paddingHorizontal: 6, paddingTop: 10, gap: 2 },
  sumText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  sumWarning: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  toggleDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  saveBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
