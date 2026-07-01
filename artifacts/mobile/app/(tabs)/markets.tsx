import React from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useMarketPrices, useEGXStocks, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label, icon }: { label: string; icon: keyof typeof Feather.glyphMap }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={[styles.sectionHeaderIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={12} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.sectionHeaderText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ─── USD/EGP currency card ────────────────────────────────────────────────────

function CurrencyCard({ rate }: { rate: number }) {
  const colors = useColors();
  return (
    <View style={[styles.currencyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.currencyLeft}>
        <View style={[styles.currencyIconWrap, { backgroundColor: '#4A9EFF14', borderColor: '#4A9EFF25' }]}>
          <Text style={styles.currencyFlag}>🇺🇸</Text>
        </View>
        <View>
          <Text style={[styles.currencyName, { color: colors.text }]}>US Dollar</Text>
          <Text style={[styles.currencyPair, { color: colors.mutedForeground }]}>USD / EGP</Text>
        </View>
      </View>
      <View style={styles.currencyRight}>
        <Text style={[styles.currencyRate, { color: colors.text }]}>{rate.toFixed(3)}</Text>
        <Text style={[styles.currencyUnit, { color: colors.mutedForeground }]}>Egyptian Pound</Text>
      </View>
    </View>
  );
}

// ─── Metal row (inside a table card) ─────────────────────────────────────────

function MetalRow({
  accentColor, label, sublabel, price, unit = 'EGP/g',
  changePercent, isLast, bold,
}: {
  accentColor: string; label: string; sublabel?: string;
  price: number; unit?: string; changePercent?: number; isLast?: boolean; bold?: boolean;
}) {
  const colors = useColors();
  const hasChange = changePercent !== undefined;
  const isPos = (changePercent ?? 0) >= 0;
  const chgColor = isPos ? colors.green : colors.red;

  return (
    <View style={[
      styles.metalRow,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      {/* Left: dot + labels */}
      <View style={styles.metalRowLeft}>
        <View style={[styles.metalDotWrap, { backgroundColor: accentColor + '20', borderColor: accentColor + '40' }]}>
          <View style={[styles.metalDot, { backgroundColor: accentColor }]} />
        </View>
        <View style={styles.metalRowLabels}>
          <Text style={[styles.metalRowLabel, { color: colors.text }, bold && styles.metalRowLabelBold]}>
            {label}
          </Text>
          {sublabel ? (
            <Text style={[styles.metalRowSublabel, { color: colors.mutedForeground }]}>{sublabel}</Text>
          ) : null}
        </View>
      </View>

      {/* Right: price + change */}
      <View style={styles.metalRowRight}>
        <Text style={[styles.metalRowPrice, { color: colors.text }, bold && styles.metalRowPriceBold]}>
          {price.toLocaleString('en-EG', { maximumFractionDigits: price < 10 ? 2 : 0 })}
          <Text style={[styles.metalRowUnit, { color: colors.mutedForeground }]}> {unit}</Text>
        </Text>
        {hasChange && (
          <View style={[styles.changeBadge, { backgroundColor: chgColor + '15' }]}>
            <Feather name={isPos ? 'arrow-up' : 'arrow-down'} size={9} color={chgColor} />
            <Text style={[styles.changeBadgeTxt, { color: chgColor }]}>
              {isPos ? '+' : ''}{(changePercent ?? 0).toFixed(2)}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Metal table (card wrapping rows) ────────────────────────────────────────

function MetalTable({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.metalTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

// ─── EGX stock row ────────────────────────────────────────────────────────────

function StockRow({ symbol, name, price, changePercent, index, total }: {
  symbol: string; name: string; price: number; change: number;
  changePercent: number; index: number; total: number;
}) {
  const colors = useColors();
  const isPos = changePercent >= 0;
  const color = isPos ? colors.green : colors.red;
  const isLast = index === total - 1;

  return (
    <View style={[
      styles.stockRow,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <View style={[styles.stockAvatar, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '28' }]}>
        <Text style={[styles.stockAvatarTxt, { color: colors.primary }]}>
          {symbol.length <= 4 ? symbol : symbol.substring(0, 4)}
        </Text>
      </View>
      <View style={styles.stockInfo}>
        <Text style={[styles.stockSymbol, { color: colors.text }]}>{symbol}</Text>
        <Text style={[styles.stockName, { color: colors.mutedForeground }]} numberOfLines={1}>{name}</Text>
      </View>
      <View style={styles.stockRight}>
        <Text style={[styles.stockPrice, { color: colors.text }]}>
          {price > 0 ? price.toFixed(2) : '—'}
        </Text>
        {price > 0 && (
          <View style={[styles.changePill, { backgroundColor: color + '15' }]}>
            <Feather name={isPos ? 'arrow-up' : 'arrow-down'} size={9} color={color} />
            <Text style={[styles.changePillTxt, { color }]}>{Math.abs(changePercent).toFixed(2)}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

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

  // Gold prices per gram
  const gold24 = prices ? Math.round(goldPricePerGram(prices, '24k')) : 0;
  const gold22 = prices ? Math.round(goldPricePerGram(prices, '22k')) : 0;
  const gold21 = prices ? Math.round(goldPricePerGram(prices, '21k')) : 0;
  const gold18 = prices ? Math.round(goldPricePerGram(prices, '18k')) : 0;
  const goldOz = prices ? Math.round(prices.goldUsd * prices.usdToEgp) : 0;

  // Silver prices — XAG spot is 99.9% pure silver
  const silverPure  = prices ? silverPricePerGram(prices) : 0;           // per gram, pure
  const silver999   = prices ? parseFloat((silverPure * 0.999).toFixed(2)) : 0;   // 999 fine
  const silver925   = prices ? parseFloat((silverPure * 0.925).toFixed(2)) : 0;   // 925 sterling
  const silverOz    = prices ? Math.round(prices.silverUsd * prices.usdToEgp) : 0;

  const goldChg    = prices?.goldChangePercent;
  const silverChg  = prices?.silverChangePercent;
  const usdRate    = prices ? parseFloat(prices.usdToEgp.toFixed(3)) : 0;

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
        <View style={[styles.livePill, { backgroundColor: colors.green + '18', borderColor: colors.green + '35' }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.green }]} />
          <Text style={[styles.liveTxt, { color: colors.green }]}>{t.live}</Text>
        </View>
      </View>

      {/* Currency */}
      <View style={styles.group}>
        <SectionHeader label={t.currency} icon="dollar-sign" />
        {usdRate > 0 && <CurrencyCard rate={usdRate} />}
      </View>

      {/* Gold */}
      <View style={styles.group}>
        <SectionHeader label={t.goldSection} icon="award" />
        <MetalTable>
          <MetalRow
            accentColor={colors.primary}
            label="24K · Pure Gold"
            sublabel="99.9% · Per gram"
            price={gold24}
            changePercent={goldChg}
          />
          <MetalRow
            accentColor={colors.primary}
            label="22K Gold"
            sublabel="91.67% · Per gram"
            price={gold22}
          />
          <MetalRow
            accentColor={colors.primary}
            label="21K Gold"
            sublabel="87.5% · Per gram"
            price={gold21}
          />
          <MetalRow
            accentColor={colors.goldDark ?? '#A68700'}
            label="18K Gold"
            sublabel="75.0% · Per gram"
            price={gold18}
          />
          <MetalRow
            accentColor={colors.primary}
            label="Gold · Troy Ounce"
            sublabel="31.10 g · XAU/EGP"
            price={goldOz}
            unit="EGP"
            changePercent={goldChg}
            isLast
            bold
          />
        </MetalTable>
      </View>

      {/* Silver */}
      <View style={styles.group}>
        <SectionHeader label={t.silverSection} icon="circle" />
        <MetalTable>
          <MetalRow
            accentColor={colors.silverColor}
            label="Silver 999 · Fine"
            sublabel="99.9% · Per gram"
            price={silver999}
            changePercent={silverChg}
          />
          <MetalRow
            accentColor={colors.silverColor}
            label="Silver 925 · Sterling"
            sublabel="92.5% · Per gram"
            price={silver925}
          />
          <MetalRow
            accentColor={colors.silverColor}
            label="Silver · Troy Ounce"
            sublabel="31.10 g · XAG/EGP"
            price={silverOz}
            unit="EGP"
            changePercent={silverChg}
            isLast
            bold
          />
        </MetalTable>
      </View>

      {/* EGX Stocks */}
      <View style={styles.group}>
        <SectionHeader label={t.egxSection} icon="bar-chart-2" />
        <View style={[styles.stockTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.tableHeaderTxt, { color: colors.mutedForeground }]}>{t.stockCol}</Text>
            <Text style={[styles.tableHeaderTxt, { color: colors.mutedForeground }]}>{t.priceCol}</Text>
          </View>
          {(stocks ?? []).map((s, i) => (
            <StockRow key={s.symbol} {...s} index={i} total={(stocks ?? []).length} />
          ))}
        </View>
      </View>

      {/* Timestamp */}
      {prices?.lastUpdated && (
        <View style={styles.timestampRow}>
          <Feather name="clock" size={11} color={colors.mutedForeground} />
          <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
            {t.updated}{' '}
            {new Date(prices.lastUpdated).toLocaleTimeString([], {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
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
  screenTitle: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: -1.2 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveTxt: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },

  group: { gap: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeaderIcon: {
    width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
  },
  sectionHeaderText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.3 },

  // Currency card
  currencyCard: {
    borderRadius: 20, padding: 18, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  currencyLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  currencyIconWrap: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  currencyFlag: { fontSize: 22 },
  currencyName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  currencyPair: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  currencyRight: { alignItems: 'flex-end' },
  currencyRate: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  currencyUnit: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },

  // Metal table
  metalTable: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  metalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13, gap: 12,
  },
  metalRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 },
  metalDotWrap: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  metalDot: { width: 10, height: 10, borderRadius: 5 },
  metalRowLabels: { gap: 2, flex: 1, minWidth: 0 },
  metalRowLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  metalRowLabelBold: { fontFamily: 'Inter_700Bold' },
  metalRowSublabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  metalRowRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  metalRowPrice: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  metalRowPriceBold: { fontSize: 17, color: undefined },
  metalRowUnit: { fontSize: 10, fontFamily: 'Inter_400Regular', letterSpacing: 0 },
  changeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  changeBadgeTxt: { fontSize: 10, fontFamily: 'Inter_700Bold' },

  // EGX stocks
  stockTable: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  tableHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeaderTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  stockRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11, gap: 12,
  },
  stockAvatar: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stockAvatarTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
  stockInfo: { flex: 1, gap: 2, minWidth: 0 },
  stockSymbol: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  stockName: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  stockRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  stockPrice: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  changePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  changePillTxt: { fontSize: 10, fontFamily: 'Inter_700Bold' },

  timestampRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  timestamp: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
