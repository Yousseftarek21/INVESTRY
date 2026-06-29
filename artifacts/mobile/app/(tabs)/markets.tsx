import React from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useMarketPrices, useEGXStocks, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { PriceCard } from '@/components/PriceCard';

function StockRow({ symbol, name, price, change, changePercent, last }: {
  symbol: string; name: string; price: number; change: number;
  changePercent: number; last?: boolean;
}) {
  const colors = useColors();
  const isPos = changePercent >= 0;
  const color = isPos ? colors.green : colors.red;

  return (
    <View style={[styles.stockRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={[styles.stockSymbolWrap, { backgroundColor: colors.muted }]}>
        <Text style={[styles.stockSymbol, { color: colors.primary }]}>{symbol}</Text>
      </View>
      <View style={styles.stockInfo}>
        <Text style={[styles.stockName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.stockTicker, { color: colors.mutedForeground }]}>{symbol}</Text>
      </View>
      <View style={styles.stockRight}>
        <Text style={[styles.stockPrice, { color: colors.text }]}>{price.toFixed(2)}</Text>
        <View style={[styles.stockBadge, { backgroundColor: color + '18' }]}>
          <Feather name={isPos ? 'arrow-up' : 'arrow-down'} size={10} color={color} />
          <Text style={[styles.stockBadgeText, { color }]}>{Math.abs(changePercent).toFixed(2)}%</Text>
        </View>
      </View>
    </View>
  );
}

export default function MarketsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { data: prices, isLoading: loadingPrices, refetch: refetchPrices } = useMarketPrices();
  const { data: stocks, isLoading: loadingStocks, refetch: refetchStocks } = useEGXStocks();

  const isLoading = loadingPrices || loadingStocks;
  const refetch = () => { refetchPrices(); refetchStocks(); };

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const gold24 = prices ? Math.round(goldPricePerGram(prices, '24k')) : 0;
  const gold21 = prices ? Math.round(goldPricePerGram(prices, '21k')) : 0;
  const gold18 = prices ? Math.round(goldPricePerGram(prices, '18k')) : 0;
  const silverG = prices ? silverPricePerGram(prices) : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topInsets + 16, paddingBottom: botInsets + 90 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>{t.markets}</Text>
        <View style={[styles.liveBadge, { backgroundColor: colors.green + '1A', borderColor: colors.green + '33' }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.green }]} />
          <Text style={[styles.liveTxt, { color: colors.green }]}>{t.live}</Text>
        </View>
      </View>

      {/* Currency */}
      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{t.currency}</Text>
        <PriceCard
          label={t.usDollar}
          sublabel="USD / EGP"
          price={prices ? parseFloat(prices.usdToEgp.toFixed(2)) : 0}
          unit="EGP"
          icon="dollar-sign"
          iconColor="#4A9EFF"
        />
      </View>

      {/* Gold */}
      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{t.goldSection}</Text>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <PriceCard label="Gold 24k" sublabel={`${t.perGram} · خالص`} price={gold24}
              icon="award" iconColor={colors.primary}
              changePercent={prices?.goldChangePercent} change={prices ? Math.round(prices.goldChange * prices.usdToEgp / 31.1035) : undefined} />
          </View>
          <View style={styles.col}>
            <PriceCard label="Gold 21k" sublabel={`${t.perGram} · عيار 21`} price={gold21}
              icon="award" iconColor={colors.primary} />
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <PriceCard label="Gold 18k" sublabel={`${t.perGram} · عيار 18`} price={gold18}
              icon="award" iconColor={colors.goldDark} />
          </View>
          <View style={styles.col}>
            <PriceCard label="Gold/oz" sublabel={t.perOunce}
              price={prices ? Math.round(prices.goldUsd * prices.usdToEgp) : 0}
              icon="trending-up" iconColor={colors.primary} />
          </View>
        </View>
      </View>

      {/* Silver */}
      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{t.silverSection}</Text>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <PriceCard label="Silver/g" sublabel={t.perGram} price={parseFloat(silverG.toFixed(2))}
              icon="circle" iconColor={colors.silverColor}
              changePercent={prices?.silverChangePercent} change={prices ? parseFloat((prices.silverChange * prices.usdToEgp / 31.1035).toFixed(2)) : undefined} />
          </View>
          <View style={styles.col}>
            <PriceCard label="Silver/oz" sublabel={t.perOunce}
              price={prices ? Math.round(prices.silverUsd * prices.usdToEgp) : 0}
              icon="circle" iconColor={colors.silverColor} />
          </View>
        </View>
      </View>

      {/* EGX Stocks */}
      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{t.egxSection}</Text>
        <View style={[styles.stockTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.stockTableHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.tableHeaderTxt, { color: colors.mutedForeground }]}>{t.stockCol}</Text>
            <Text style={[styles.tableHeaderTxtR, { color: colors.mutedForeground }]}>{t.priceCol}</Text>
          </View>
          {(stocks ?? []).map((s, i) => (
            <StockRow key={s.symbol} {...s} last={i === (stocks ?? []).length - 1} />
          ))}
        </View>
      </View>

      {prices?.lastUpdated && (
        <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
          {t.updated} {new Date(prices.lastUpdated).toLocaleTimeString()}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  group: { gap: 8 },
  groupLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  twoCol: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  stockTable: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  stockTableHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  tableHeaderTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  tableHeaderTxtR: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  stockRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, gap: 10 },
  stockSymbolWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stockSymbol: { fontSize: 10, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  stockInfo: { flex: 1, gap: 2 },
  stockName: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  stockTicker: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  stockRight: { alignItems: 'flex-end', gap: 4 },
  stockPrice: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  stockBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  timestamp: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: -8 },
});
