import React from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useMarketPrices, useEGXStocks, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { PriceCard } from '@/components/PriceCard';

function StockRow({ symbol, name, price, change, changePercent }: {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}) {
  const colors = useColors();
  const isPos = changePercent >= 0;
  const color = isPos ? colors.green : colors.red;

  return (
    <View style={[styles.stockRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.stockSymbolWrap, { backgroundColor: colors.muted }]}>
        <Text style={[styles.stockSymbol, { color: colors.primary }]}>{symbol}</Text>
      </View>
      <View style={styles.stockInfo}>
        <Text style={[styles.stockName, { color: colors.text }]}>{name}</Text>
        <Text style={[styles.stockSymbolLabel, { color: colors.mutedForeground }]}>{symbol}</Text>
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
  const insets = useSafeAreaInsets();
  const { data: prices, isLoading: loadingPrices, refetch: refetchPrices } = useMarketPrices();
  const { data: stocks, isLoading: loadingStocks, refetch: refetchStocks } = useEGXStocks();

  const isLoading = loadingPrices || loadingStocks;
  const refetch = () => { refetchPrices(); refetchStocks(); };

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const gold24Price = prices ? goldPricePerGram(prices, '24k') : 0;
  const gold21Price = prices ? goldPricePerGram(prices, '21k') : 0;
  const gold18Price = prices ? goldPricePerGram(prices, '18k') : 0;
  const silverPrice = prices ? silverPricePerGram(prices) : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topInsets + 16, paddingBottom: botInsets + 90 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <Text style={[styles.screenTitle, { color: colors.text }]}>Markets</Text>

      {/* Currency */}
      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>CURRENCY</Text>
        <PriceCard
          label="US Dollar"
          sublabel="USD / EGP"
          price={prices?.usdToEgp ?? 0}
          unit="EGP"
          icon="dollar-sign"
          iconColor="#4A9EFF"
        />
      </View>

      {/* Gold */}
      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>GOLD — عيار</Text>
        <View style={styles.cards}>
          <PriceCard
            label="Gold 24k"
            sublabel="Per gram — خالص"
            price={Math.round(gold24Price)}
            icon="award"
            iconColor={colors.primary}
          />
          <PriceCard
            label="Gold 21k"
            sublabel="Per gram — عيار 21"
            price={Math.round(gold21Price)}
            icon="award"
            iconColor={colors.primary}
          />
          <PriceCard
            label="Gold 18k"
            sublabel="Per gram — عيار 18"
            price={Math.round(gold18Price)}
            icon="award"
            iconColor={colors.goldDark}
          />
          <PriceCard
            label="Gold per Ounce"
            sublabel="Troy oz in EGP"
            price={prices ? Math.round(prices.goldUsd * prices.usdToEgp) : 0}
            icon="trending-up"
            iconColor={colors.primary}
          />
        </View>
      </View>

      {/* Silver */}
      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>SILVER — فضة</Text>
        <View style={styles.cards}>
          <PriceCard
            label="Silver"
            sublabel="Per gram"
            price={parseFloat(silverPrice.toFixed(2))}
            icon="circle"
            iconColor={colors.silverColor}
          />
          <PriceCard
            label="Silver per Ounce"
            sublabel="Troy oz in EGP"
            price={prices ? Math.round(prices.silverUsd * prices.usdToEgp) : 0}
            icon="circle"
            iconColor={colors.silverColor}
          />
        </View>
      </View>

      {/* EGX Stocks */}
      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>EGX STOCKS — البورصة المصرية</Text>
        <View style={[styles.stockCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.stockHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.stockHeaderText, { color: colors.mutedForeground }]}>Stock</Text>
            <Text style={[styles.stockHeaderTextRight, { color: colors.mutedForeground }]}>Price (EGP)</Text>
          </View>
          {(stocks ?? []).map(s => (
            <StockRow key={s.symbol} {...s} />
          ))}
        </View>
      </View>

      {prices?.lastUpdated && (
        <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
          Updated {new Date(prices.lastUpdated).toLocaleTimeString()}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  screenTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  group: { gap: 10 },
  groupLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  cards: { gap: 8 },
  stockCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  stockHeaderText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  stockHeaderTextRight: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stockSymbolWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockSymbol: { fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  stockInfo: { flex: 1 },
  stockName: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  stockSymbolLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  stockRight: { alignItems: 'flex-end', gap: 4 },
  stockPrice: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  stockBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  timestamp: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: -8 },
});
