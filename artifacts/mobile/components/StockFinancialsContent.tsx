import React from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { EGXStockLive, fmtMarketCap, fmtVolume } from '@/hooks/useEGXMarket';
import { useStockNews, StockNewsItem } from '@/hooks/useStockNews';
import { RangeBar } from '@/components/RangeBar';

function timeAgo(unixSeconds: number, t: ReturnType<typeof useT>): string {
  const diffMin = Math.max(0, Math.floor((Date.now() / 1000 - unixSeconds) / 60));
  if (diffMin < 60) return t.minutesAgo.replace('{n}', String(diffMin));
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t.hoursAgo.replace('{n}', String(diffHr));
  return t.daysAgo.replace('{n}', String(Math.floor(diffHr / 24)));
}

function NewsRow({ item, colors, t }: { item: StockNewsItem; colors: ReturnType<typeof useColors>; t: ReturnType<typeof useT> }) {
  return (
    <TouchableOpacity
      style={[nr.row, { borderColor: colors.border }]}
      onPress={() => Linking.openURL(item.url).catch(() => null)}
      activeOpacity={0.7}
    >
      <View style={nr.textWrap}>
        <Text style={[nr.title, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[nr.meta, { color: colors.mutedForeground }]}>{item.source} · {timeAgo(item.publishedAt, t)}</Text>
      </View>
      <Feather name="external-link" size={14} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}
const nr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  textWrap: { flex: 1, gap: 3 },
  title: { fontSize: 13, fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  meta: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});

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

// Plain content, no Modal/animation/close-button of its own — rendered inside
// app/stock-financials.tsx, a native-modal route (same reasoning as
// FinancialTools.tsx: a real native "modal" presentation gets genuine
// swipe-to-dismiss for free, where this used to be a hand-rolled Animated +
// transparent Modal sheet whose drag handle was purely decorative — it never
// actually responded to a swipe, so the only way to close it was the X).
export function StockFinancialsContent({ stock }: { stock: EGXStockLive }) {
  const colors = useColors();
  const t = useT();

  const isPos = stock.changePercent >= 0;
  const changeColor = isPos ? colors.green : colors.red;

  return (
    <View>
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
      <FinRow label={t.currentRatioLabel} value={stock.currentRatio != null ? stock.currentRatio.toFixed(2) : '—'} colors={colors} />
      <FinRow label={t.quickRatioLabel} value={stock.quickRatio != null ? stock.quickRatio.toFixed(2) : '—'} colors={colors} />
      <FinRow label={t.returnOnAssetsLabel} value={stock.returnOnAssets != null ? `${stock.returnOnAssets.toFixed(1)}%` : '—'} colors={colors} />
      <FinRow label={t.freeCashFlowLabel} value={fmtMarketCap(stock.freeCashFlowTtm)} colors={colors} />
      <FinRow label={t.cashAndEquivalentsLabel} value={fmtMarketCap(stock.cashAndEquivalents)} colors={colors} />
      <FinRow label={t.employeesLabel} value={stock.employees != null ? stock.employees.toLocaleString('en-US') : '—'} colors={colors} />

      <StockNewsSection ticker={stock.ticker} colors={colors} t={t} />

      <Text style={[fs.disclaimer, { color: colors.mutedForeground }]}>{t.financialsSheetSubtitle}</Text>
    </View>
  );
}

function StockNewsSection({ ticker, colors, t }: { ticker: string; colors: ReturnType<typeof useColors>; t: ReturnType<typeof useT> }) {
  const { data, isLoading } = useStockNews(ticker);

  return (
    <View style={fs.newsWrap}>
      <View style={[fs.divider, { backgroundColor: colors.border, marginBottom: 4 }]} />
      <Text style={[fs.sectionTitle, { color: colors.mutedForeground, marginTop: 14 }]}>{t.recentNewsLabel}</Text>
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginTop: 10 }} />
      ) : !data || data.length === 0 ? (
        <Text style={[fr.label, { color: colors.mutedForeground, marginTop: 6 }]}>{t.noRecentNews}</Text>
      ) : (
        data.map(item => <NewsRow key={item.id} item={item} colors={colors} t={t} />)
      )}
    </View>
  );
}

const fs = StyleSheet.create({
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
  newsWrap: { marginTop: 6 },
  disclaimer: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16, marginTop: 16 },
});
