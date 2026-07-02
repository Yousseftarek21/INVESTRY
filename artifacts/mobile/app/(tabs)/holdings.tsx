import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices } from '@/hooks/usePrices';
import { HoldingCard } from '@/components/HoldingCard';
import { Holding } from '@/types';

const TYPE_ORDER: Holding['type'][] = ['gold', 'silver', 'stock', 'real_estate'];

const TYPE_ICONS: Record<Holding['type'], keyof typeof Feather.glyphMap> = {
  gold: 'award',
  silver: 'circle',
  stock: 'bar-chart-2',
  real_estate: 'home',
};

const TYPE_COLORS: Record<Holding['type'], string> = {
  gold: '#D4AC0D',
  silver: '#C0C8D4',
  stock: '#4A9EFF',
  real_estate: '#A47FCA',
};

export default function HoldingsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { holdings, removeHolding } = useHoldings();
  const { data: prices } = useMarketPrices();

  const TYPE_LABELS: Record<Holding['type'], string> = {
    gold: t.goldGroup,
    silver: t.silverGroup,
    stock: t.stockGroup,
    real_estate: t.realEstateGroup,
  };

  const grouped = holdings.reduce<Record<string, Holding[]>>((acc, h) => {
    if (!acc[h.type]) acc[h.type] = [];
    acc[h.type].push(h);
    return acc;
  }, {});

  const handleDelete = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeHolding(id);
  };

  const handleEdit = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/add-investment?holdingId=${id}` as any);
  };

  const openAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add-investment');
  };

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const totalCount = holdings.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topInsets + 20, paddingBottom: botInsets + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.screenTitle, { color: colors.text }]}>{t.holdings}</Text>
            {totalCount > 0 && (
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {totalCount} {totalCount === 1 ? 'asset' : 'assets'}
              </Text>
            )}
          </View>
          {/* Header add button — only shown when there are holdings */}
          {totalCount > 0 && (
            <TouchableOpacity
              style={[styles.headerAddBtn, { backgroundColor: colors.primary }]}
              onPress={openAdd}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
              <Text style={[styles.headerAddText, { color: colors.primaryForeground }]}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {holdings.length === 0 ? (
          /* ── Empty state ── */
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
              <Feather name="briefcase" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noHoldings}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{t.tapToAdd}</Text>
            <TouchableOpacity
              style={[styles.inlineBtn, { backgroundColor: colors.primary }]}
              onPress={openAdd}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={17} color={colors.primaryForeground} />
              <Text style={[styles.inlineBtnText, { color: colors.primaryForeground }]}>Add Investment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          TYPE_ORDER.filter(type => grouped[type]?.length).map(type => (
            <View key={type} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupIconWrap, { backgroundColor: TYPE_COLORS[type] + '20' }]}>
                  <Feather name={TYPE_ICONS[type]} size={13} color={TYPE_COLORS[type]} />
                </View>
                <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>
                  {TYPE_LABELS[type]}
                </Text>
                <View style={[styles.groupCount, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.groupCountTxt, { color: colors.mutedForeground }]}>
                    {grouped[type].length}
                  </Text>
                </View>
              </View>
              <View style={styles.groupItems}>
                {grouped[type].map(h => (
                  <HoldingCard
                    key={h.id}
                    holding={h}
                    prices={prices}
                    onEdit={() => handleEdit(h.id)}
                    onDelete={() => handleDelete(h.id)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 4,
  },
  screenTitle: { fontSize: 19, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  headerAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12, marginTop: 6,
  },
  headerAddText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupIconWrap: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  groupLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.1, flex: 1 },
  groupCount: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  groupCountTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  group: { gap: 10 },
  groupItems: { gap: 8 },
  empty: {
    borderRadius: 24, padding: 40, borderWidth: 1,
    alignItems: 'center', gap: 10, marginTop: 20,
  },
  emptyIconWrap: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  emptySubtitle: {
    fontSize: 14, fontFamily: 'Inter_400Regular',
    textAlign: 'center', lineHeight: 20,
  },
  inlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 16, marginTop: 8,
  },
  inlineBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
