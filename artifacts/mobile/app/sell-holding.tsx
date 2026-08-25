import React, { useMemo, useState } from 'react';
import {
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHaptic } from '@/hooks/useHaptic';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useMarketPrices } from '@/hooks/usePrices';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { AmountInput } from '@/components/AmountInput';
import { DatePickerField } from '@/components/DatePickerField';
import { parseAmount } from '@/utils/parseAmount';
import { computeCurrentValue, computeCost } from '@/components/HoldingCard';
import { AssetIcon } from '@/components/AssetIcon';
import { Holding } from '@/types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Mirrors add-investment.tsx's own describeHolding — same label style used
// for the "Investment Added"/"Investment Updated" activity log entries, so
// "Investment Sold" reads consistently with those in Notification History.
function describeHolding(h: Holding, t: ReturnType<typeof useT>): string {
  switch (h.type) {
    case 'gold': return `${t.gold}: ${h.grams}g`;
    case 'silver': return `${t.silver}: ${h.grams}g`;
    case 'stock': return `${h.symbol}: ${h.shares} ${t.sharesLabel}`;
    case 'real_estate': return h.propertyName;
    case 'personal_asset': return h.name;
    case 'fixed_income': return h.label;
    default: return t.egxStocksAllocLabel;
  }
}

export default function SellHoldingScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { holdingId } = useLocalSearchParams<{ holdingId: string }>();
  const { holdings, sellHolding } = useHoldings();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();
  const holding = useMemo(() => holdings.find(h => h.id === holdingId), [holdings, holdingId]);

  const { data: rawPrices } = useMarketPrices();
  const { data: egxStocks } = useEGXMarket();
  const prices = useMemo(() => {
    if (!rawPrices) return rawPrices;
    const egxPrices: Record<string, number> = {};
    egxStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
    return { ...rawPrices, egxPrices };
  }, [rawPrices, egxStocks]);

  const isFixedIncome = holding?.type === 'fixed_income';
  const currentValue = holding ? computeCurrentValue(holding, prices) : 0;
  const costBasis = holding ? computeCost(holding, prices) : 0;

  const [saleProceeds, setSaleProceeds] = useState(() => String(Math.round(currentValue)));
  const [saleDate, setSaleDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const realizedGainLoss = parseAmount(saleProceeds || '0') - costBasis;
  const isGain = realizedGainLoss >= 0;
  const gainColor = isGain ? colors.green : colors.red;

  const hasInstallmentBalance = holding?.type === 'real_estate' && (holding.remainingBalance ?? 0) > 0;

  const handleConfirm = async () => {
    if (!holding) return;
    const proceeds = parseAmount(saleProceeds || '0');
    if (!Number.isFinite(proceeds) || proceeds < 0) {
      setError(t.sellHoldingInvalidAmount);
      return;
    }
    setError(null);
    setSaving(true);
    impact();
    try {
      await sellHolding(holding.id, proceeds, saleDate, notes.trim() || undefined);
      queryClient.invalidateQueries({ queryKey: ['sold-holdings'] });
      const sign = realizedGainLoss >= 0 ? '+' : '';
      const subtitle = `${describeHolding(holding, t)} — ${sign}${Math.round(realizedGainLoss).toLocaleString('en-EG')} EGP`;
      void logActivity('holding_sold', t.activityHoldingSoldTitle, subtitle, holding.id);
      router.back();
    } catch {
      setError(t.sellHoldingFailed);
    } finally {
      setSaving(false);
    }
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  if (!holding) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.notFound}>
          <Text style={{ color: colors.mutedForeground }}>{t.holdingNotFound}</Text>
        </View>
      </View>
    );
  }

  const title = isFixedIncome ? t.redeemHoldingTitle : t.sellHoldingTitle;
  const amountLabel = isFixedIncome ? t.redemptionAmountLabel : t.saleProceedsLabel;
  const confirmLabel = isFixedIncome ? t.confirmRedeemCta : t.confirmSellCta;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Feather name={backChevron()} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Holding summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.summaryIconWrap, { backgroundColor: colors.primary + '17' }]}>
            <AssetIcon type={holding.type} size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryName, { color: colors.text }]} numberOfLines={1}>
              {holding.type === 'stock' ? holding.symbol
                : holding.type === 'real_estate' ? holding.propertyName
                : holding.type === 'personal_asset' ? holding.name
                : holding.type === 'fixed_income' ? holding.label
                : t[holding.type === 'gold' ? 'gold' : 'silver']}
            </Text>
            <Text style={[styles.summaryMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
              {t.sellCurrentValueLabel}: {Math.round(currentValue).toLocaleString('en-EG')} EGP
            </Text>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{amountLabel}</Text>
          <AmountInput
            value={saleProceeds}
            onChangeText={setSaleProceeds}
            style={[styles.amountInput, { color: colors.text, backgroundColor: colors.input, borderColor: colors.border }]}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {/* Date */}
        <View style={styles.section}>
          <DatePickerField label={t.saleDateLabel} value={saleDate} onChange={setSaleDate} />
        </View>

        {/* Realized P/L preview */}
        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.previewAccent, { backgroundColor: gainColor }]} />
          <View style={styles.previewBody}>
            <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>{t.realizedProfitLossLabel}</Text>
            <Text style={[styles.previewHero, { color: gainColor }]} numberOfLines={1} adjustsFontSizeToFit>
              {isGain ? '+' : ''}{Math.round(realizedGainLoss).toLocaleString('en-EG')} <Text style={styles.previewHeroCurrency}>EGP</Text>
            </Text>
            <Text style={[styles.previewFrom, { color: colors.mutedForeground }]}>
              {t.costBasisLabel}: {Math.round(costBasis).toLocaleString('en-EG')} EGP
            </Text>
          </View>
        </View>

        {hasInstallmentBalance && holding.type === 'real_estate' && (
          <View style={[styles.warnCard, { backgroundColor: colors.red + '0F', borderColor: colors.red + '30' }]}>
            <Feather name="alert-triangle" size={14} color={colors.red} />
            <Text style={[styles.warnText, { color: colors.red }]}>
              {t.remainingBalanceWarning(Math.round(holding.remainingBalance ?? 0).toLocaleString('en-EG'))}
            </Text>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t.notes}</Text>
          <TextInput
            style={[styles.notesInput, { color: colors.text, backgroundColor: colors.input, borderColor: colors.border }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.notesPlaceholderOptional}
            placeholderTextColor={colors.mutedForeground}
            multiline
          />
        </View>

        {error && (
          <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>
        )}

        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
          onPress={handleConfirm}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={[styles.confirmBtnText, { color: colors.primaryForeground }]}>{confirmLabel}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 20, gap: 18 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  summaryIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryName: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  summaryMeta: { fontSize: 12.5, fontFamily: 'Inter_500Medium', marginTop: 2 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
  amountInput: {
    fontSize: 20, fontFamily: 'Inter_700Bold',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  notesInput: {
    fontSize: 14, fontFamily: 'Inter_400Regular',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    minHeight: 60, textAlignVertical: 'top',
  },
  previewCard: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  previewAccent: { width: 4 },
  previewBody: { flex: 1, padding: 14, gap: 4 },
  previewLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  previewHero: { fontSize: 24, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.5 },
  previewHeroCurrency: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  previewFrom: { fontSize: 12.5, fontFamily: 'Inter_500Medium', marginTop: 4 },
  warnCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  warnText: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  confirmBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  confirmBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
