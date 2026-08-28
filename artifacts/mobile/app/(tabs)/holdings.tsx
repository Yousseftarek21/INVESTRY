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
import { useGlobalStocks } from '@/hooks/useGlobalStocks';
import { getRECurrentValue } from '@/utils/rePrice';
import { HoldingCard } from '@/components/HoldingCard';

import { SwipeToDelete } from '@/components/SwipeToDelete';
import { Holding, MarketPrices } from '@/types';
import { groupLots, LotGroup } from '@/utils/lotGrouping';

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
  silver:         { lib: 'mci', name: 'gold' },
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

// Monthly/quarterly-payout certificates pay interest out to a linked account
// each period rather than compounding it back into the certificate — its
// own redemption value stays flat at principal until maturity. Only
// at-maturity products actually accrue into their value. Matches
// components/HoldingCard.tsx, the canonical per-holding display — this used
// to just return principal unconditionally here, which meant sorting by
// value/gain disagreed with what each card actually showed.
function fixedIncomeAccruedValue(h: Extract<Holding, { type: 'fixed_income' }>): number {
  if (h.paymentFrequency !== 'at_maturity') return h.principal;
  const today = new Date();
  const purchase = new Date(h.purchaseDate);
  const maturity = new Date(h.maturityDate);
  const daysTotal = Math.max(1, (maturity.getTime() - purchase.getTime()) / 86400000);
  const daysElapsed = Math.max(0, Math.min(daysTotal, (today.getTime() - purchase.getTime()) / 86400000));
  return h.principal * (1 + (h.annualRate / 100) * (daysElapsed / 365));
}

function getHoldingValue(h: Holding, p: PricesArg): number {
  if (h.type === 'fixed_income') return fixedIncomeAccruedValue(h);
  if (!p) {
    if (h.type === 'gold' || h.type === 'silver') return h.grams * h.purchasePricePerGram;
    if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
    if (h.type === 'real_estate') return h.purchasePrice;
    if (h.type === 'personal_asset') return (h.currentValue ?? h.purchasePrice);
    return 0;
  }
  if (h.type === 'gold') return goldPricePerGram(p, h.karat) * h.grams;
  if (h.type === 'silver') return silverPricePerGram(p) * h.grams;
  if (h.type === 'stock') return (p.egxPrices?.[h.symbol] ?? h.purchasePricePerShare) * h.shares;
  if (h.type === 'real_estate') return getRECurrentValue(h);
  if (h.type === 'personal_asset') return (h.currentValue ?? h.purchasePrice) * (h.currency === 'USD' ? p.usdToEgp : 1);
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
  const { data: globalStocks } = useGlobalStocks();
  const prices = useMemo(() => {
    if (!rawPrices) return rawPrices;
    const egxPrices: Record<string, number> = {};
    egxStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
    globalStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
    return { ...rawPrices, egxPrices };
  }, [rawPrices, egxStocks, globalStocks]);
  const { impact } = useHaptic();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [showSortPicker, setShowSortPicker] = useState(false);
  // Set when a card represents 2+ separately-tracked lots (see
  // utils/lotGrouping.ts) and was tapped — opens a picker so Edit/Sell/
  // Delete can target the specific lot instead of the combined display total.
  const [lotPickerGroup, setLotPickerGroup] = useState<LotGroup | null>(null);

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

  // Same-asset lots (e.g. two separate gold-24k purchases) collapse into one
  // card here — see utils/lotGrouping.ts. Sorting/filtering above already
  // operates on the real, individual holdings; this is purely a display
  // step, so it happens last, after everything else.
  const grouped = useMemo(() => {
    const byType = filtered.reduce<Record<string, Holding[]>>((acc, h) => {
      if (!acc[h.type]) acc[h.type] = [];
      acc[h.type].push(h);
      return acc;
    }, {});
    const groups: Record<string, LotGroup[]> = {};
    for (const type of Object.keys(byType)) {
      groups[type] = groupLots(byType[type]);
    }
    if (sortMode === 'value') {
      for (const type of Object.keys(groups)) {
        groups[type].sort((a, b) => getHoldingValue(b.displayHolding, prices) - getHoldingValue(a.displayHolding, prices));
      }
    } else if (sortMode === 'gain') {
      for (const type of Object.keys(groups)) {
        groups[type].sort((a, b) => {
          const gA = getHoldingValue(a.displayHolding, prices) - getHoldingCost(a.displayHolding);
          const gB = getHoldingValue(b.displayHolding, prices) - getHoldingCost(b.displayHolding);
          return gB - gA;
        });
      }
    } else if (sortMode === 'date') {
      for (const type of Object.keys(groups)) {
        groups[type].sort((a, b) => (b.displayHolding.purchaseDate ?? '').localeCompare(a.displayHolding.purchaseDate ?? ''));
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

  const handleSell = (id: string) => {
    impact();
    router.push(`/sell-holding?holdingId=${id}` as any);
  };

  const openAdd = () => { impact(); router.push('/add-choose' as any); };
  const openSoldHoldings = () => { impact(); router.push('/sold-holdings' as any); };

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
          <View style={styles.headerBtnCol}>
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
            <TouchableOpacity
              style={styles.soldLinkBtn}
              onPress={openSoldHoldings}
              activeOpacity={0.7}
            >
              <Feather name="archive" size={12} color={colors.mutedForeground} />
              <Text style={[styles.soldLinkText, { color: colors.mutedForeground }]}>{t.soldInvestments}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Search bar + filter icon ── */}
        {holdings.length > 0 && (
          <View style={styles.searchRow}>
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
            {/* Single filter icon replaces the old 4-chip sort row — tapping
                opens the same options in a bottom sheet instead. Filled when
                a non-default sort is active, so the icon itself signals a
                filter is applied without needing a visible chip row. */}
            <TouchableOpacity
              onPress={() => setShowSortPicker(true)}
              style={[
                styles.filterBtn,
                { backgroundColor: sortMode !== 'default' ? colors.primary : colors.card, borderColor: sortMode !== 'default' ? colors.primary : colors.border },
              ]}
              activeOpacity={0.75}
            >
              <Feather name="sliders" size={16} color={sortMode !== 'default' ? colors.primaryForeground : colors.mutedForeground} />
            </TouchableOpacity>
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
                {grouped[type].map((group, idx) => (
                  <FadeInCard key={group.key} index={idx}>
                    <SwipeToDelete onDelete={() => (group.lots.length > 1 ? setLotPickerGroup(group) : handleDelete(group.lots[0].id))}>
                      <HoldingCard
                        holding={group.displayHolding}
                        prices={prices}
                        hideSubtitle
                        lotCount={group.lots.length > 1 ? group.lots.length : undefined}
                        onEdit={() => (group.lots.length > 1 ? setLotPickerGroup(group) : handleEdit(group.lots[0].id))}
                        onSell={() => (group.lots.length > 1 ? setLotPickerGroup(group) : handleSell(group.lots[0].id))}
                      />
                    </SwipeToDelete>
                  </FadeInCard>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showSortPicker} animationType="slide" transparent onRequestClose={() => setShowSortPicker(false)}>
        <TouchableOpacity style={confirmStyles.pickerOverlay} activeOpacity={1} onPress={() => setShowSortPicker(false)}>
          <View style={[confirmStyles.pickerSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[confirmStyles.pickerSheetTitle, { color: colors.text }]}>{t.sortHoldingsTitle}</Text>
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
                  style={[confirmStyles.pickerOption, { borderColor: colors.border, backgroundColor: active ? colors.primary + '14' : 'transparent' }]}
                  onPress={() => { setSortMode(mode); setShowSortPicker(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={[confirmStyles.pickerOptionText, { color: active ? colors.primary : colors.text }]}>{labels[mode]}</Text>
                  {active && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!lotPickerGroup} animationType="slide" transparent onRequestClose={() => setLotPickerGroup(null)}>
        <TouchableOpacity style={confirmStyles.pickerOverlay} activeOpacity={1} onPress={() => setLotPickerGroup(null)}>
          <View style={[confirmStyles.pickerSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[confirmStyles.pickerSheetTitle, { color: colors.text }]}>{t.lotPickerTitle}</Text>
            <Text style={[styles.lotPickerHint, { color: colors.mutedForeground }]}>{t.lotPickerHint}</Text>
            {lotPickerGroup?.lots
              .slice()
              .sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? ''))
              .map(lot => {
                const qty = lot.type === 'gold' || lot.type === 'silver' ? lot.grams : lot.type === 'stock' ? lot.shares : null;
                const unit = lot.type === 'stock' ? t.sharesLabel : 'g';
                return (
                  <View key={lot.id} style={[styles.lotRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lotRowQty, { color: colors.text }]}>{qty}{unit === 'g' ? 'g' : ` ${unit}`}</Text>
                      <Text style={[styles.lotRowDate, { color: colors.mutedForeground }]}>{lot.purchaseDate}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => { setLotPickerGroup(null); handleEdit(lot.id); }}
                      style={styles.lotRowAction}
                      hitSlop={8}
                    >
                      <Feather name="edit-2" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setLotPickerGroup(null); handleSell(lot.id); }}
                      style={styles.lotRowAction}
                      hitSlop={8}
                    >
                      <Feather name="check-circle" size={16} color={colors.green} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setLotPickerGroup(null); handleDelete(lot.id); }}
                      style={styles.lotRowAction}
                      hitSlop={8}
                    >
                      <Feather name="trash-2" size={16} color={colors.red} />
                    </TouchableOpacity>
                  </View>
                );
              })}
          </View>
        </TouchableOpacity>
      </Modal>

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
  headerBtnCol: { alignItems: 'flex-end', gap: 8, marginTop: 6 },
  headerAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12,
  },
  headerAddText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  soldLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  soldLinkText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
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

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: -8,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular',
    paddingVertical: 0,
  },
  filterBtn: {
    width: 42, height: 42, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  lotPickerHint: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  lotRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderTopWidth: 1, paddingVertical: 12,
  },
  lotRowQty: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  lotRowDate: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  lotRowAction: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});

const confirmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { borderRadius: 20, borderWidth: 1, padding: 24, width: '100%', maxWidth: 360, gap: 16 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  msg: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnTxt: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, gap: 8 },
  pickerSheetTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  pickerOptionText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
});
