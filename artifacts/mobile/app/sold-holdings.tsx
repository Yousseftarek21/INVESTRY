import React from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useSoldHoldings, SoldHolding } from '@/hooks/useSoldHoldings';
import { AssetIcon } from '@/components/AssetIcon';

function Row({ item }: { item: SoldHolding }) {
  const colors = useColors();
  const t = useT();
  const isGain = item.realizedGainLoss >= 0;
  const gainColor = isGain ? colors.green : colors.red;
  const assetType = (['gold', 'silver', 'stock', 'real_estate', 'personal_asset', 'fixed_income'].includes(item.type)
    ? item.type
    : 'stock') as 'gold' | 'silver' | 'stock' | 'real_estate' | 'personal_asset' | 'fixed_income';

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.rowIconWrap, { backgroundColor: colors.primary + '17' }]}>
        <AssetIcon type={assetType} size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>{item.label}</Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {t.soldOnLabel(item.saleDate)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.rowGain, { color: gainColor }]} numberOfLines={1}>
          {isGain ? '+' : ''}{Math.round(item.realizedGainLoss).toLocaleString('en-EG')} EGP
        </Text>
        <Text style={[styles.rowProceeds, { color: colors.mutedForeground }]} numberOfLines={1}>
          {Math.round(item.saleProceeds).toLocaleString('en-EG')} EGP
        </Text>
      </View>
    </View>
  );
}

export default function SoldHoldingsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { soldHoldings, isLoading, refresh } = useSoldHoldings();

  const totalRealized = soldHoldings.reduce((sum, s) => sum + s.realizedGainLoss, 0);
  const totalIsGain = totalRealized >= 0;
  const totalColor = totalIsGain ? colors.green : colors.red;

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Feather name={backChevron()} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.soldInvestments}</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={soldHoldings}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 40 }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          soldHoldings.length > 0 ? (
            <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>{t.totalRealizedPLLabel}</Text>
              <Text style={[styles.totalValue, { color: totalColor }]} numberOfLines={1} adjustsFontSizeToFit>
                {totalIsGain ? '+' : ''}{Math.round(totalRealized).toLocaleString('en-EG')} <Text style={styles.totalCurrency}>EGP</Text>
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={[styles.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
                <Feather name="archive" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noSoldInvestmentsTitle}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{t.noSoldInvestmentsHint}</Text>
            </View>
          )
        }
        renderItem={({ item }) => <Row item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
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
  content: { paddingHorizontal: 20, gap: 8 },
  totalCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, gap: 4 },
  totalLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  totalValue: { fontSize: 26, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.5 },
  totalCurrency: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  rowIconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  rowGain: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  rowProceeds: { fontSize: 11.5, fontFamily: 'Inter_400Regular', marginTop: 2 },
  emptyWrap: {
    borderRadius: 24, padding: 40, borderWidth: 1,
    alignItems: 'center', gap: 10, marginTop: 20,
  },
  emptyIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
});
