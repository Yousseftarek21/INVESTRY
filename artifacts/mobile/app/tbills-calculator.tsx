import React, { useState, useMemo } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerField } from '@/components/DatePickerField';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { parseAmount, formatAmountInput } from '@/utils/parseAmount';

function todayISO() { return new Date().toISOString().split('T')[0]; }

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

interface Results {
  totalDays: number;
  daysElapsed: number;
  daysRemaining: number;
  purchasePrice: number;
  grossReturn: number;
  taxAmount: number;
  netReturn: number;
  netPayout: number;
  effectiveNetYield: number;
  accruedToday: number;
}

function compute(faceValue: number, annualRate: number, issueDate: string, maturityDate: string): Results | null {
  if (!faceValue || !annualRate || !issueDate || !maturityDate) return null;
  if (maturityDate <= issueDate) return null;
  const today = todayISO();
  const totalDays = daysBetween(issueDate, maturityDate);
  const daysElapsed = Math.min(daysBetween(issueDate, today), totalDays);
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  const grossReturn = faceValue * (annualRate / 100) * (totalDays / 365);
  const purchasePrice = faceValue - grossReturn;
  const taxAmount = grossReturn * 0.20;
  const netReturn = grossReturn - taxAmount;
  const netPayout = purchasePrice + netReturn;
  const effectiveNetYield = (netReturn / purchasePrice) * (365 / totalDays) * 100;
  const accruedToday = netReturn * (daysElapsed / totalDays);
  return { totalDays, daysElapsed, daysRemaining, purchasePrice, grossReturn, taxAmount, netReturn, netPayout, effectiveNetYield, accruedToday };
}

function fmt(n: number): string {
  return n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ResultRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}
function ResultRow({ label, value, highlight, muted }: ResultRowProps) {
  const colors = useColors();
  return (
    <View style={[rs.row, { borderBottomColor: colors.border }]}>
      <Text style={[rs.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[rs.value, {
        color: highlight ? colors.green : muted ? colors.mutedForeground : colors.text,
        fontFamily: highlight ? 'Inter_700Bold' : 'Inter_600SemiBold',
        fontSize: highlight ? 17 : 15,
      }]}>{value}</Text>
    </View>
  );
}
const rs = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  value: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
});

export default function TBillsCalculatorScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  const defaultIssue = todayISO();
  const defaultMaturity = addMonths(defaultIssue, 3);

  const [faceValueRaw, setFaceValueRaw] = useState('100000');
  const [yieldRaw, setYieldRaw] = useState('27.5');
  const [issueDate, setIssueDate] = useState(defaultIssue);
  const [maturityDate, setMaturityDate] = useState(defaultMaturity);

  const results = useMemo(() => {
    const fv = parseAmount(faceValueRaw);
    const rate = parseFloat(yieldRaw);
    return compute(fv, rate, issueDate, maturityDate);
  }, [faceValueRaw, yieldRaw, issueDate, maturityDate]);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name="chevron-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.tbillsCalculator}</Text>
          <View style={{ width: 22 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Inputs */}
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.mutedForeground }]}>{t.tbillsInputsTitle}</Text>

              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>{t.faceValue}</Text>
                <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    value={faceValueRaw}
                    onChangeText={v => setFaceValueRaw(formatAmountInput(v))}
                    placeholder="100,000"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[s.unit, { color: colors.mutedForeground }]}>EGP</Text>
                </View>
              </View>

              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>{t.annualYieldRate}</Text>
                <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    value={yieldRaw}
                    onChangeText={v => setYieldRaw(v.replace(/[^0-9.]/g, ''))}
                    placeholder="27.5"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[s.unit, { color: colors.mutedForeground }]}>%</Text>
                </View>
              </View>

              <View style={s.field}>
                <DatePickerField label={t.issueDateLabel} value={issueDate} onChange={setIssueDate} />
              </View>
              <View style={s.field}>
                <DatePickerField label={t.maturityDateLabel} value={maturityDate} onChange={setMaturityDate} />
              </View>
            </View>

            {/* Results */}
            {results ? (
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.cardTitle, { color: colors.mutedForeground }]}>{t.resultsTitle}</Text>

                <ResultRow label={t.totalDays}        value={`${results.totalDays} days`} muted />
                <ResultRow label={t.daysElapsed}      value={`${results.daysElapsed} days`} muted />
                <ResultRow label={t.daysRemaining}    value={`${results.daysRemaining} days`} muted />
                <ResultRow label={t.purchasePriceResult} value={`${fmt(results.purchasePrice)} EGP`} />
                <ResultRow label={t.grossReturn}      value={`${fmt(results.grossReturn)} EGP`} />
                <ResultRow label={t.withholdingTax20} value={`${fmt(results.taxAmount)} EGP`} />
                <ResultRow label={t.netReturn}        value={`${fmt(results.netReturn)} EGP`} />
                <ResultRow label={t.accruedToday}     value={`${fmt(results.accruedToday)} EGP`} />
                <ResultRow label={t.netPayoutAtMaturity} value={`${fmt(results.netPayout)} EGP`} highlight />
                <ResultRow label={t.effectiveNetYield}   value={`${results.effectiveNetYield.toFixed(2)}%`} highlight />
              </View>
            ) : (
              <View style={[s.card, s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="percent" size={32} color={colors.mutedForeground} />
                <Text style={[s.emptyText, { color: colors.mutedForeground }]}>{t.tbillsEmptyHint}</Text>
              </View>
            )}

            <Text style={[s.disclaimer, { color: colors.mutedForeground }]}>
              {t.tbillsDisclaimer}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content:     { padding: 16, gap: 14 },

  card:      { borderRadius: 18, borderWidth: 1, padding: 18, gap: 0 },
  cardTitle: { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14 },

  field:    { gap: 6, marginBottom: 14 },
  label:    { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  input:    { flex: 1, fontSize: 16, fontFamily: 'Inter_400Regular', paddingVertical: 12 },
  unit:     { fontSize: 14, fontFamily: 'Inter_500Medium', paddingLeft: 6 },

  emptyCard: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  disclaimer: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16, opacity: 0.7 },
});
