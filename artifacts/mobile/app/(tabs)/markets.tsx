import React from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useMarketPrices, useEGXStocks, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';

function SectionLabel({ label, icon }: { label: string; icon: keyof typeof Feather.glyphMap }) {
  const colors = useColors();
  return (
    <View style={styles.sectionLabelRow}>
      <View style={[styles.sectionLabelIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={12} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function MetalCard({
  label, sublabel, price, changePercent, accentColor, large,
}: {
  label: string; sublabel?: string; price: number;
  changePercent?: number; accentColor: string; large?: boolean;
}) {
  const colors = useColors();
  const hasChange = changePercent !== undefined;
  const isPos = (changePercent ?? 0) >= 0;
  const chgColor = isPos ? colors.green : colors.red;

  return (
    <View style={[
      styles.metalCard,
      { backgroundColor: colors.card, borderColor: colors.border },
      large && styles.metalCardLarge,
    ]}>
      <View style={[styles.metalAccentDot, { backgroundColor: accentColor + '30', borderColor: accentColor + '50' }]}>
        <View style={[styles.metalDot, { backgroundColor: accentColor }]} />
      </View>
      <View style={styles.metalBody}>
        <Text style={[styles.metalLabel, { color: colors.text }]}>{label}</Text>
        {sublabel ? <Text style={[styles.metalSublabel, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
      </View>
      <Text style={[styles.metalPrice, { color: colors.text }, large && styles.metalPriceLarge]}>
        {price.toLocaleString('en-EG', { maximumFractionDigits: 0 })}
        <Text style={[styles.metalUnit, { color: colors.mutedForeground }]}> EGP</Text>
      </Text>
      {hasChange && (
        <View style={[styles.metalChange, { backgroundColor: chgColor + '15' }]}>
          <Feather name={isPos ? 'arrow-up' : 'arrow-down'} size={10} color={chgColor} />
          <Text style={[styles.metalChangeTxt, { color: chgColor }]}>
            {isPos ? '+' : ''}{(changePercent ?? 0).toFixed(2)}%
          </Text>
        </View>
      )}
    </View>
  );
}

function CurrencyCard({ price, label, pair }: { price: number; label: string; pair: string }) {
  const colors = useColors();
  return (
    <View style={[styles.currencyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.currencyLeft}>
        <View style={[styles.currencyFlag, { backgroundColor: '#4A9EFF18' }]}>
          <Text style={styles.currencyFlagText}>🇺🇸</Text>
        </View>
        <View>
          <Text style={[styles.currencyName, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.currencyPair, { color: colors.mutedForeground }]}>{pair}</Text>
        </View>
      </View>
      <View style={styles.currencyRight}>
        <Text style={[styles.currencyPrice, { color: colors.text }]}>{price.toFixed(2)}</Text>
        <Text style={[styles.currencyUnit, { color: colors.mutedForeground }]}>EGP</Text>
      </View>
    </View>
  );
}

function StockRow({ symbol, name, price, changePercent, index, total }: {
  symbol: string; name: string; price: number; change: number;
  changePercent: number; index: number; total: number;
}) {
  const colors = useColors();
  const isPos = changePercent >= 0;
  const color = isPos ? colors.green : colors.red;

  return (
    <View style={[
      styles.stockRow,
      index < total - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <View style={[styles.stockAvatar, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '30' }]}>
        <Text style={[styles.stockAvatarText, { color: colors.primary }]}>
          {symbol.length <= 4 ? symbol : symbol.substring(0, 4)}
        </Text>
      </View>
      <View style={styles.stockInfo}>
        <Text style={[styles.stockSymbol, { color: colors.text }]}>{symbol}</Text>
        <Text style={[styles.stockName, { color: colors.mutedForeground }]} numberOfLines={1}>{name}</Text>
      </View>
      <View style={styles.stockRight}>
        <Text style={[styles.stockPrice, { color: colors.text }]}>{price.toFixed(2)}</Text>
        <View style={[styles.changePill, { backgroundColor: color + '15' }]}>
          <Feather name={isPos ? 'arrow-up' : 'arrow-down'} size={9} color={color} />
          <Text style={[styles.changePillTxt, { color }]}>{Math.abs(changePercent).toFixed(2)}%</Text>
        </View>
      </View>
    </View>
  );
}

export default function MarketsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { data: prices, isLoading: lP, refetch: rP } = useMarketPrices();
  const { data: stocks, isLoading: lS, refetch: rS } = useEGXStocks();

  const isLoading = lP || lS;
  const refetch = () => { rP(); rS(); };

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const gold24 = prices ? Math.round(goldPricePerGram(prices, '24k')) : 0;
  const gold22 = prices ? Math.round(goldPricePerGram(prices, '22k')) : 0;
  const gold21 = prices ? Math.round(goldPricePerGram(prices, '21k')) : 0;
  const gold18 = prices ? Math.round(goldPricePerGram(prices, '18k')) : 0;
  const goldOz = prices ? Math.round(prices.goldUsd * prices.usdToEgp) : 0;
  const silverG = prices ? parseFloat(silverPricePerGram(prices).toFixed(2)) : 0;
  const silverOz = prices ? Math.round(prices.silverUsd * prices.usdToEgp) : 0;

  const goldChangePct = prices?.goldChangePercent;
  const silverChangePct = prices?.silverChangePercent;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topInsets + 20, paddingBottom: botInsets + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>{t.markets}</Text>
        <View style={[styles.livePill, { backgroundColor: colors.green + '15', borderColor: colors.green + '30' }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.green }]} />
          <Text style={[styles.liveTxt, { color: colors.green }]}>{t.live}</Text>
        </View>
      </View>

      {/* Currency */}
      <View style={styles.group}>
        <SectionLabel label={t.currency} icon="dollar-sign" />
        {prices && (
          <CurrencyCard
            price={parseFloat(prices.usdToEgp.toFixed(2))}
            label={t.usDollar}
            pair="USD / EGP"
          />
        )}
      </View>

      {/* Gold */}
      <View style={styles.group}>
        <SectionLabel label={t.goldSection} icon="award" />
        <View style={styles.goldGrid}>
          <MetalCard label={t.karat24label} sublabel={t.perGram} price={gold24}
            changePercent={goldChangePct} accentColor={colors.primary} />
          <MetalCard label={t.karat22label} sublabel={t.perGram} price={gold22}
            accentColor={colors.primary} />
          <MetalCard label={t.karat21label} sublabel={t.perGram} price={gold21}
            accentColor={colors.primary} />
          <MetalCard label={t.karat18label} sublabel={t.perGram} price={gold18}
            accentColor={colors.goldDark} />
        </View>
        <MetalCard label={t.goldOzLabel} sublabel={t.perOunce} price={goldOz}
          changePercent={goldChangePct} accentColor={colors.primary} large />
      </View>

      {/* Silver */}
      <View style={styles.group}>
        <SectionLabel label={t.silverSection} icon="circle" />
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <MetalCard label={t.silverGramLabel} sublabel={t.perGram} price={silverG}
              changePercent={silverChangePct} accentColor={colors.silverColor} />
          </View>
          <View style={styles.col}>
            <MetalCard label={t.silverOzLabel} sublabel={t.perOunce} price={silverOz}
              accentColor={colors.silverColor} />
          </View>
        </View>
      </View>

      {/* EGX Stocks */}
      <View style={styles.group}>
        <SectionLabel label={t.egxSection} icon="bar-chart-2" />
        <View style={[styles.stockTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.tableHeaderLeft, { color: colors.mutedForeground }]}>{t.stockCol}</Text>
            <Text style={[styles.tableHeaderRight, { color: colors.mutedForeground }]}>{t.priceCol}</Text>
          </View>
          {(stocks ?? []).map((s, i) => (
            <StockRow key={s.symbol} {...s} index={i} total={(stocks ?? []).length} />
          ))}
        </View>
      </View>

      {prices?.lastUpdated && (
        <View style={styles.timestampRow}>
          <Feather name="clock" size={11} color={colors.mutedForeground} />
          <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
            {t.updated} {new Date(prices.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  screenTitle: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveTxt: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  group: { gap: 10 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabelIcon: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  currencyCard: {
    borderRadius: 18, padding: 18, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  currencyLeft: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  currencyFlag: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  currencyFlagText: { fontSize: 22 },
  currencyName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  currencyPair: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  currencyRight: { alignItems: 'flex-end' },
  currencyPrice: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  currencyUnit: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  goldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metalCard: {
    borderRadius: 16, padding: 14, borderWidth: 1, gap: 6,
    width: '48%', flexGrow: 1,
  },
  metalCardLarge: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  metalAccentDot: {
    width: 30, height: 30, borderRadius: 9, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
  },
  metalDot: { width: 10, height: 10, borderRadius: 5 },
  metalBody: { flex: 1, gap: 2 },
  metalLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  metalSublabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  metalPrice: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  metalPriceLarge: { fontSize: 22 },
  metalUnit: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  metalChange: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start',
  },
  metalChangeTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  twoCol: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  stockTable: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  tableHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeaderLeft: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  tableHeaderRight: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  stockRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  stockAvatar: {
    width: 42, height: 42, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  stockAvatarText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
  stockInfo: { flex: 1, gap: 2 },
  stockSymbol: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  stockName: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  stockRight: { alignItems: 'flex-end', gap: 4 },
  stockPrice: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  changePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  changePillTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  timestampRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  timestamp: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
