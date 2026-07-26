import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { EGXStockLive, fmtMarketCap, fmtVolume } from '@/hooks/useEGXMarket';
import { RangeBar } from '@/components/RangeBar';

// ─── Health snapshot — descriptive only ────────────────────────────────────────
// These badges classify the metrics themselves (e.g. "High P/E") rather than
// issue a buy/sell verdict on the company — deliberately, since a directive
// recommendation on a specific security would be regulated investment advice.
// See the AI Assistant's own system prompt (routes/chat.ts) for the same rule.

type Tone = 'good' | 'neutral' | 'warn';

function toneColor(tone: Tone, colors: ReturnType<typeof useColors>): string {
  return tone === 'good' ? colors.green : tone === 'warn' ? '#F59E0B' : colors.mutedForeground;
}

function valuationBadge(pe: number | undefined, t: ReturnType<typeof useT>): { label: string; tone: Tone } | null {
  if (pe == null) return null;
  if (pe < 10) return { label: t.lowPeBadge, tone: 'good' };
  if (pe > 20) return { label: t.highPeBadge, tone: 'warn' };
  return { label: t.fairPeBadge, tone: 'neutral' };
}

function profitabilityBadge(
  netMargin: number | undefined,
  roe: number | undefined,
  t: ReturnType<typeof useT>,
): { label: string; tone: Tone } | null {
  const m = netMargin ?? roe;
  if (m == null) return null;
  if (m >= 15) return { label: t.strongMarginsBadge, tone: 'good' };
  if (m < 5) return { label: t.weakMarginsBadge, tone: 'warn' };
  return { label: t.fairMarginsBadge, tone: 'neutral' };
}

function leverageBadge(debtToEquity: number | undefined, t: ReturnType<typeof useT>): { label: string; tone: Tone } | null {
  if (debtToEquity == null) return null;
  if (debtToEquity < 0.5) return { label: t.lowDebtBadge, tone: 'good' };
  if (debtToEquity > 1.5) return { label: t.highDebtBadge, tone: 'warn' };
  return { label: t.moderateDebtBadge, tone: 'neutral' };
}

function HealthBadge({ categoryLabel, badge, colors }: {
  categoryLabel: string;
  badge: { label: string; tone: Tone } | null;
  colors: ReturnType<typeof useColors>;
}) {
  const t = useT();
  const color = badge ? toneColor(badge.tone, colors) : colors.mutedForeground;
  return (
    <View style={[hb.wrap, { backgroundColor: color + '12', borderColor: color + '30' }]}>
      <Text style={[hb.category, { color: colors.mutedForeground }]}>{categoryLabel}</Text>
      <Text style={[hb.value, { color }]}>{badge ? badge.label : t.naBadge}</Text>
    </View>
  );
}
const hb = StyleSheet.create({
  wrap: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 10, gap: 3, alignItems: 'center' },
  category: { fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  value: { fontSize: 12, fontFamily: 'Inter_700Bold', textAlign: 'center' },
});

function FinRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={fr.row}>
      <Text style={[fr.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[fr.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}
const fr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9 },
  label: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  value: { fontSize: 13, fontFamily: 'Inter_700Bold' },
});

export function StockFinancialsSheet({
  stock, visible, onClose,
}: { stock: EGXStockLive | null; visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(700)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, damping: 26, stiffness: 230, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    } else {
      slideY.setValue(700);
      bgOpacity.setValue(0);
    }
  }, [visible]);

  if (!visible || !stock) return null;

  const isPos = stock.changePercent >= 0;
  const changeColor = isPos ? colors.green : colors.red;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: bgOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          fs.sheet,
          { backgroundColor: colors.card, borderColor: colors.border },
          { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={fs.dragZone}>
          <View style={[fs.handle, { backgroundColor: colors.border }]} />
        </View>

        <Pressable onPress={onClose} style={fs.closeBtn} hitSlop={16}>
          <View style={[fs.closeCircle, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </View>
        </Pressable>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={fs.scroll}>
          {/* Header */}
          <View style={fs.header}>
            <Text style={[fs.ticker, { color: colors.text }]}>{stock.ticker}</Text>
            <Text style={[fs.name, { color: colors.mutedForeground }]}>{stock.nameEn}</Text>
            <View style={fs.priceRow}>
              <Text style={[fs.price, { color: colors.text }]}>{stock.price.toFixed(2)} EGP</Text>
              <Text style={[fs.change, { color: changeColor }]}>
                {isPos ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </Text>
            </View>
          </View>

          {/* Health snapshot — descriptive badges, not a buy/sell verdict */}
          <Text style={[fs.sectionTitle, { color: colors.mutedForeground }]}>{t.financialHealthLabel}</Text>
          <View style={fs.badgeRow}>
            <HealthBadge categoryLabel={t.valuationLabel} badge={valuationBadge(stock.pe, t)} colors={colors} />
            <HealthBadge categoryLabel={t.profitabilityLabel} badge={profitabilityBadge(stock.netMargin, stock.roe, t)} colors={colors} />
            <HealthBadge categoryLabel={t.leverageLabel} badge={leverageBadge(stock.debtToEquity, t)} colors={colors} />
          </View>

          {/* 52-week range */}
          {stock.high52w != null && stock.low52w != null && (
            <View style={fs.rangeWrap}>
              <Text style={[fr.label, { color: colors.mutedForeground, marginBottom: 6 }]}>{t.weekRange52}</Text>
              <RangeBar price={stock.price} low={stock.low52w} high={stock.high52w} />
            </View>
          )}

          {/* Full financials */}
          <View style={[fs.divider, { backgroundColor: colors.border }]} />
          <FinRow label={t.sectorLabel} value={stock.sector} colors={colors} />
          <FinRow label={t.industryLabel} value={stock.industry} colors={colors} />
          <FinRow label={t.peRatio} value={stock.pe != null ? stock.pe.toFixed(1) : '—'} colors={colors} />
          <FinRow label={t.dividendYield} value={stock.dividendYield != null ? `${stock.dividendYield.toFixed(2)}%` : '—'} colors={colors} />
          <FinRow label={t.priceToBookLabel} value={stock.priceToBook != null ? stock.priceToBook.toFixed(2) : '—'} colors={colors} />
          <FinRow label={t.epsTtmLabel} value={stock.epsTtm != null ? stock.epsTtm.toFixed(2) : '—'} colors={colors} />
          <FinRow label={t.revenueGrowthLabel} value={stock.revenueGrowthYoy != null ? `${stock.revenueGrowthYoy.toFixed(1)}%` : '—'} colors={colors} />
          <FinRow label={t.netMarginLabel} value={stock.netMargin != null ? `${stock.netMargin.toFixed(1)}%` : '—'} colors={colors} />
          <FinRow label={t.roeLabel} value={stock.roe != null ? `${stock.roe.toFixed(1)}%` : '—'} colors={colors} />
          <FinRow label={t.debtToEquityLabel} value={stock.debtToEquity != null ? stock.debtToEquity.toFixed(2) : '—'} colors={colors} />
          <FinRow label={t.capLabel} value={fmtMarketCap(stock.marketCap)} colors={colors} />
          <FinRow label={t.volLabel} value={fmtVolume(stock.volume)} colors={colors} />

          <Text style={[fs.disclaimer, { color: colors.mutedForeground }]}>{t.financialsSheetSubtitle}</Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const fs = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderTopWidth: 1, maxHeight: '90%',
  },
  dragZone: { width: 160, alignSelf: 'center', alignItems: 'center', paddingTop: 12, paddingBottom: 10 },
  handle: { width: 42, height: 4, borderRadius: 2 },
  closeBtn: { position: 'absolute', top: 16, end: 18, zIndex: 10 },
  closeCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 12 },
  header: { alignItems: 'center', gap: 4, paddingBottom: 18 },
  ticker: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  price: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  change: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  rangeWrap: { marginBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 4 },
  disclaimer: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16, marginTop: 16 },
});
