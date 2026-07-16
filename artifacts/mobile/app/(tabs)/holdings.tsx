import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices } from '@/hooks/usePrices';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { HoldingCard } from '@/components/HoldingCard';
import { AddChooserSheet } from '@/components/AddChooserSheet';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { Holding } from '@/types';

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
  stock:          'trending-up',
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

  const TYPE_LABELS: Record<Holding['type'], string> = {
    gold: t.goldGroup,
    silver: t.silverGroup,
    stock: t.stockGroup,
    real_estate: t.realEstateGroup,
    personal_asset: t.personalAssetGroup,
    fixed_income: t.fixedIncomeGroup,
  };

  const grouped = holdings.reduce<Record<string, Holding[]>>((acc, h) => {
    if (!acc[h.type]) acc[h.type] = [];
    acc[h.type].push(h);
    return acc;
  }, {});

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

  const [showChooser, setShowChooser] = useState(false);
  const openAdd = () => { impact(); setShowChooser(true); };

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

        {isLoading && holdings.length === 0 ? (
          /* ── Loading state — fetching from API after sign-in ── */
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, justifyContent: 'center', gap: 12 }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Loading your investments…</Text>
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
              <Text style={[styles.inlineBtnText, { color: colors.primaryForeground }]}>Add Investment</Text>
            </TouchableOpacity>
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
      <AddChooserSheet visible={showChooser} onClose={() => setShowChooser(false)} />
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
