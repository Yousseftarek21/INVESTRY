import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { getRECurrentValue } from '@/utils/rePrice';
import { HoldingCard } from '@/components/HoldingCard';

import { SwipeToDelete } from '@/components/SwipeToDelete';
import { Holding, MarketPrices } from '@/types';

function FadeInCard({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: index * 45, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, delay: index * 45, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}


const TYPE_ORDER: Holding['type'][] = ['gold', 'silver', 'stock', 'real_estate', 'personal_asset', 'fixed_income'];

type HoldingIcon = keyof typeof Feather.glyphMap | { lib: 'mci'; name: string };
const TYPE_ICONS: Record<Holding['type'], HoldingIcon> = {
  gold:           { lib: 'mci', name: 'gold' },
  silver:         { lib: 'mci', name: 'medal' },
  stock:          'bar-chart-2',
  real_estate:    { lib: 'mci', name: 'home-city' },
  personal_asset: { lib: 'mci', name: 'tag-multiple' },
  fixed_income:   { lib: 'mci', name: 'bank-transfer' },
};

const TYPE_COLORS: Record<Holding['type'], string> = {
  gold: '#C9A227',
  silver: '#C0C8D4',
  stock: '#4A9EFF',
  real_estate: '#A47FCA',
  personal_asset: '#E08E45',
  fixed_income: '#22C55E',
};

type SortMode = 'default' | 'value' | 'gain' | 'date';
type PricesArg = (MarketPrices & { egxPrices?: Record<string, number> }) | null | undefined;

function getHoldingValue(h: Holding, p: PricesArg): number {
  if (!p) {
    if (h.type === 'gold' || h.type === 'silver') return h.grams * h.purchasePricePerGram;
    if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
    if (h.type === 'real_estate') return h.purchasePrice;
    if (h.type === 'personal_asset') return (h.currentValue ?? h.purchasePrice);
    if (h.type === 'fixed_income') return h.principal;
    return 0;
  }
  if (h.type === 'gold') return goldPricePerGram(p, h.karat) * h.grams;
  if (h.type === 'silver') return silverPricePerGram(p) * h.grams;
  if (h.type === 'stock') return (p.egxPrices?.[h.symbol] ?? h.purchasePricePerShare) * h.shares;
  if (h.type === 'real_estate') return getRECurrentValue(h);
  if (h.type === 'personal_asset') return (h.currentValue ?? h.purchasePrice) * (h.currency === 'USD' ? p.usdToEgp : 1);
  if (h.type === 'fixed_income') return h.principal;
  return 0;
}

function getHoldingCost(h: Holding): number {
  if (h.type === 'gold' || h.type === 'silver') return h.grams * h.purchasePricePerGram;
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.purchasePrice;
  if (h.type === 'personal_asset') return h.purchasePrice;
  if (h.type === 'fixed_income') return h.principal;
  return 0;
}

function getHoldingSearchText(h: Holding): string {
  if (h.type === 'gold') return `gold ${h.karat} ${h.form}`.toLowerCase();
  if (h.type === 'silver') return `silver ${h.form}`.toLowerCase();
  if (h.type === 'stock') return `stock ${h.symbol}`.toLowerCase();
  if (h.type === 'real_estate') return `real estate property ${h.propertyName ?? ''} ${h.propertyType}`.toLowerCase();
  if (h.type === 'personal_asset') return `${h.name} ${h.category}`.toLowerCase();
  if (h.type === 'fixed_income') return `${h.subtype} ${h.label} ${h.institution ?? ''}`.toLowerCase();
  return '';
}

export default function HoldingsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { holdings, removeHolding, isLoading, syncError } = useHoldings();

  // Auto-dismissing sync error toast
  const [showSyncError, setShowSyncError] = useState(false);
  const syncErrorAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!syncError) return;
    setShowSyncError(true);
    Animated.timing(syncErrorAnim, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start();
    const timer = setTimeout(() => {
      Animated.timing(syncErrorAnim, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start(() => setShowSyncError(false));
    }, 4000);
    return () => clearTimeout(timer);
  }, [syncError]);

  const { data: rawPrices } = useMarketPrices();
  const { data: egxStocks } = useEGXMarket();
  const prices = useMemo(() => {
    if (!rawPrices) return rawPrices;
    const egxPrices: Record<string, number> = {};
    egxStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
    return { ...rawPrices, egxPrices };
  }, [rawPrices, egxStocks]);
  const { impact } = useHaptic();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('default');

  const TYPE_LABELS: Record<Holding['type'], string> = {
    gold: t.goldGroup,
    silver: t.silverGroup,
    stock: t.stockGroup,
    real_estate: t.realEstateGroup,
    personal_asset: t.personalAssetGroup,
    fixed_income: t.fixedIncomeGroup,
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return holdings;
    const q = searchQuery.toLowerCase();
    return holdings.filter(h => getHoldingSearchText(h).includes(q));
  }, [holdings, searchQuery]);

  const grouped = useMemo(() => {
    const groups = filtered.reduce<Record<string, Holding[]>>((acc, h) => {
      if (!acc[h.type]) acc[h.type] = [];
      acc[h.type].push(h);
      return acc;
    }, {});
    if (sortMode === 'value') {
      for (const type of Object.keys(groups)) {
        groups[type].sort((a, b) => getHoldingValue(b, prices) - getHoldingValue(a, prices));
      }
    } else if (sortMode === 'gain') {
      for (const type of Object.keys(groups)) {
        groups[type].sort((a, b) => {
          const gA = getHoldingValue(a, prices) - getHoldingCost(a);
          const gB = getHoldingValue(b, prices) - getHoldingCost(b);
          return gB - gA;
        });
      }
    } else if (sortMode === 'date') {
      for (const type of Object.keys(groups)) {
        groups[type].sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? ''));
      }
    }
    return groups;
  }, [filtered, sortMode, prices]);

  const handleDelete = (id: string) => {
    if (Platform.OS === 'web') {
      // react-native-web's Alert.alert only shows the message and does not
      // reliably invoke custom button callbacks, so the "Delete" action
      // never fired. Use an explicit modal instead so delete works on web.
      setPendingDeleteId(id);
      return;
    }
    Alert.alert(t.deleteHolding, t.deleteHoldingConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          impact(Haptics.ImpactFeedbackStyle.Medium);
          removeHolding(id);
        },
      },
    ]);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    impact(Haptics.ImpactFeedbackStyle.Medium);
    removeHolding(id);
  };

  const handleEdit = (id: string) => {
    impact();
    router.push(`/add-investment?holdingId=${id}` as any);
  };

  const openAdd = () => { impact(); router.push('/add-choose' as any); };

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const totalCount = holdings.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t.holdings, headerShown: false }} />

      {/* Sync error toast — floats above content, auto-dismisses in 4s */}
      {showSyncError && (
        <Animated.View
          style={[
            styles.syncToast,
            { backgroundColor: colors.red + 'EE', top: topInsets + 12, opacity: syncErrorAnim },
          ]}
          pointerEvents="none"
        >
          <Feather name="alert-circle" size={14} color="#fff" />
          <Text style={styles.syncToastText}>{syncError}</Text>
        </Animated.View>
      )}

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
                {totalCount} {totalCount === 1 ? t.investmentSingular : t.investmentPlural}
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

        {/* ── Search bar ── */}
        {holdings.length > 0 && (
          <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t.searchHoldings}
              placeholderTextColor={colors.mutedForeground}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Feather name="x" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Sort chips ── */}
        {holdings.length > 0 && (
          <View style={styles.sortRow}>
            {(['default', 'value', 'gain', 'date'] as SortMode[]).map(mode => {
              const labels: Record<SortMode, string> = {
                default: t.sortDefault,
                value:   t.sortByValue,
                gain:    t.sortByReturn,
                date:    t.sortByDate,
              };
              const active = sortMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.sortChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
                  onPress={() => setSortMode(mode)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.sortChipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                    {labels[mode]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {isLoading && holdings.length === 0 ? (
          /* ── Loading state — fetching from API after sign-in ── */
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, justifyContent: 'center', gap: 12 }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{t.loadingInvestments}</Text>
          </View>
        ) : holdings.length === 0 ? (
          /* ── True empty state ── */
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
              <Text style={[styles.inlineBtnText, { color: colors.primaryForeground }]}>{t.addInvestment}</Text>
            </TouchableOpacity>
          </View>
        ) : searchQuery.trim() && filtered.length === 0 ? (
          /* ── No search results ── */
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
              <Feather name="search" size={28} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noSearchResults}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>"{searchQuery}"</Text>
          </View>
        ) : (
          TYPE_ORDER.filter(type => grouped[type]?.length).map(type => (
            <View key={type} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupIconWrap, { backgroundColor: TYPE_COLORS[type] + '20' }]}>
                  {typeof TYPE_ICONS[type] === 'object'
                    ? <MaterialCommunityIcons name={(TYPE_ICONS[type] as { lib: 'mci'; name: string }).name as any} size={13} color={TYPE_COLORS[type]} />
                    : <Feather name={TYPE_ICONS[type] as keyof typeof Feather.glyphMap} size={13} color={TYPE_COLORS[type]} />}
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
                {grouped[type].map((h, idx) => (
                  <FadeInCard key={h.id} index={idx}>
                    <SwipeToDelete onDelete={() => handleDelete(h.id)}>
                      <HoldingCard
                        holding={h}
                        prices={prices}
                        hideSubtitle
                        onEdit={() => handleEdit(h.id)}
                        onDelete={() => handleDelete(h.id)}
                      />
                    </SwipeToDelete>
                  </FadeInCard>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!pendingDeleteId} animationType="fade" transparent onRequestClose={() => setPendingDeleteId(null)}>
        <View style={confirmStyles.overlay}>
          <View style={[confirmStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[confirmStyles.title, { color: colors.text }]}>{t.deleteHolding}</Text>
            <Text style={[confirmStyles.msg, { color: colors.mutedForeground }]}>{t.deleteHoldingConfirm}</Text>
            <View style={confirmStyles.row}>
              <TouchableOpacity
                onPress={() => setPendingDeleteId(null)}
                style={[confirmStyles.btn, { backgroundColor: colors.muted }]}
                activeOpacity={0.75}
              >
                <Text style={[confirmStyles.btnTxt, { color: colors.mutedForeground }]}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={[confirmStyles.btn, { backgroundColor: colors.red + '18', borderWidth: 1, borderColor: colors.red + '40' }]}
                activeOpacity={0.75}
              >
                <Text style={[confirmStyles.btnTxt, { color: colors.red, fontFamily: 'Inter_600SemiBold' }]}>{t.delete}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  screenTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
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
  syncToast: {
    position: 'absolute', left: 16, right: 16, zIndex: 99,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14,
  },
  syncToastText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: -8,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular',
    paddingVertical: 0,
  },
  sortRow: {
    flexDirection: 'row', gap: 6, marginBottom: -8, flexWrap: 'wrap',
  },
  sortChip: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  sortChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});

const confirmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { borderRadius: 20, borderWidth: 1, padding: 24, width: '100%', maxWidth: 360, gap: 16 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  msg: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnTxt: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
