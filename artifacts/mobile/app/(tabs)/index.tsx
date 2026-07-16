import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  ActivityIndicator, Animated, AppState, Image, LayoutChangeEvent, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { PerfChart } from '@/components/PerfChart';
import { CHART_PERIODS, ChartPeriod } from '@/utils/chartUtils';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { useUser } from '@clerk/expo';
import { BanknoteIcon } from '@/components/BanknoteIcon';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useHoldings } from '@/context/HoldingsContext';
import { useCash } from '@/context/CashContext';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { getRECurrentValue } from '@/utils/rePrice';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAppSettings } from '@/context/AppSettingsContext';
import { AllocationBar } from '@/components/AllocationBar';
import { HoldingCard } from '@/components/HoldingCard';
import { PremiumBadge } from '@/components/PremiumBadge';
import { Holding, MarketPrices } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function personalAssetValueEGP(h: Extract<Holding, { type: 'personal_asset' }>, prices?: MarketPrices): number {
  const v = h.currentValue ?? h.purchasePrice;
  if (h.currency === 'USD' && prices) return v * prices.usdToEgp;
  return v;
}

function personalAssetCostEGP(h: Extract<Holding, { type: 'personal_asset' }>, prices?: MarketPrices): number {
  if (h.currency === 'USD' && prices) return h.purchasePrice * prices.usdToEgp;
  return h.purchasePrice;
}

function fixedIncomeAccruedValue(h: Extract<Holding, { type: 'fixed_income' }>): number {
  const today = new Date();
  const purchase = new Date(h.purchaseDate);
  const maturity = new Date(h.maturityDate);
  const daysTotal = Math.max(1, (maturity.getTime() - purchase.getTime()) / 86400000);
  const daysElapsed = Math.max(0, Math.min(daysTotal, (today.getTime() - purchase.getTime()) / 86400000));
  return h.principal * (1 + (h.annualRate / 100) * (daysElapsed / 365));
}

function computeValue(h: Holding, prices?: MarketPrices): number {
  if (h.type === 'fixed_income') return fixedIncomeAccruedValue(h);
  if (h.type === 'real_estate') return getRECurrentValue(h);
  if (!prices) return 0;
  if (h.type === 'gold') return h.grams * goldPricePerGram(prices, h.karat);
  if (h.type === 'silver') return h.grams * silverPricePerGram(prices);
  if (h.type === 'stock') return h.shares * (prices.egxPrices?.[h.symbol] ?? h.purchasePricePerShare);
  if (h.type === 'personal_asset') return personalAssetValueEGP(h, prices);
  return 0;
}

function computeCost(h: Holding, prices?: MarketPrices): number {
  if (h.type === 'gold') return h.grams * h.purchasePricePerGram;
  if (h.type === 'silver') return h.grams * h.purchasePricePerGram;
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.purchasePrice;
  if (h.type === 'personal_asset') return personalAssetCostEGP(h, prices);
  if (h.type === 'fixed_income') return h.principal;
  return 0;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return n.toLocaleString('en-EG', { maximumFractionDigits: 0 });
}

// ─── Animated number display ──────────────────────────────────────────────────

function useCounterDisplay(target: number): string {
  const anim = useRef(new Animated.Value(target)).current;
  const [text, setText] = useState(
    target.toLocaleString('en-EG', { maximumFractionDigits: 0 })
  );
  const prev = useRef(target);

  useEffect(() => {
    const id = anim.addListener(({ value }) =>
      setText(Math.round(value).toLocaleString('en-EG', { maximumFractionDigits: 0 }))
    );
    return () => anim.removeListener(id);
  }, []);

  useEffect(() => {
    if (prev.current === target) return;
    prev.current = target;
    Animated.timing(anim, { toValue: target, duration: 700, useNativeDriver: false }).start();
  }, [target]);

  return text;
}

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────

function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
}

function SkeletonBox({ w, h, radius = 8, style }: { w: number | string; h: number; radius?: number; style?: object }) {
  const opacity = useShimmer();
  return (
    <Animated.View style={[{ width: w as number, height: h, borderRadius: radius, opacity }, style]} />
  );
}

function HeroSkeleton() {
  const colors = useColors();
  const bg = colors.muted + 'CC';
  return (
    <View style={[heroSkSt.body, { gap: 16 }]}>
      <SkeletonBox w={140} h={11} radius={6} style={{ backgroundColor: bg, alignSelf: 'center' }} />
      <SkeletonBox w={200} h={48} radius={10} style={{ backgroundColor: bg, alignSelf: 'center' }} />
      <View style={[heroSkSt.strip, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
        {[0, 1, 2].map(i => (
          <View key={i} style={heroSkSt.stripCell}>
            <SkeletonBox w={50} h={9} radius={5} style={{ backgroundColor: bg }} />
            <SkeletonBox w={70} h={14} radius={6} style={{ backgroundColor: bg }} />
          </View>
        ))}
      </View>
      <View style={heroSkSt.plRow}>
        <View style={heroSkSt.plCell}>
          <SkeletonBox w="100%" h={56} radius={12} style={{ backgroundColor: bg }} />
        </View>
        <View style={heroSkSt.plCell}>
          <SkeletonBox w="100%" h={56} radius={12} style={{ backgroundColor: bg }} />
        </View>
      </View>
    </View>
  );
}

const heroSkSt = StyleSheet.create({
  body:     { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24 },
  strip:    { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: -24, paddingHorizontal: 24, paddingVertical: 14 },
  stripCell:{ flex: 1, alignItems: 'center', gap: 6 },
  plRow:    { flexDirection: 'row', gap: 8 },
  plCell:   { flex: 1 },
});

// ─── Refresh button ───────────────────────────────────────────────────────────

function RefreshButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const colors = useColors();
  const spin = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (loading) {
      anim.current = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' })
      );
      anim.current.start();
    } else {
      anim.current?.stop();
      spin.setValue(0);
    }
  }, [loading]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        rfSt.btn,
        { backgroundColor: colors.muted + '60', opacity: pressed ? 0.5 : 1 },
      ]}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Feather name="refresh-cw" size={13} color={loading ? colors.primary : colors.mutedForeground} />
      </Animated.View>
    </Pressable>
  );
}
const rfSt = StyleSheet.create({
  btn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});

// ─── Live chip ────────────────────────────────────────────────────────────────

function LiveChip({ lastUpdated }: { lastUpdated: Date | null }) {
  const colors = useColors();
  const t = useT();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.2, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: 1,   duration: 900, useNativeDriver: Platform.OS !== 'web' }),
    ])).start();
  }, []);

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <View style={chipSt.col}>
      <View style={[chipSt.pill, { backgroundColor: colors.green + '14', borderColor: colors.green + '30' }]}>
        <Animated.View style={[chipSt.dot, { backgroundColor: colors.green, opacity }]} />
        <Text style={[chipSt.label, { color: colors.green }]}>{t.liveLabel}</Text>
      </View>
      {timeStr && (
        <Text style={[chipSt.time, { color: colors.mutedForeground }]}>
          {t.updatedAt}{timeStr}
        </Text>
      )}
    </View>
  );
}
const chipSt = StyleSheet.create({
  col:   { alignItems: 'flex-end', gap: 3 },
  pill:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
  time:  { fontSize: 9, fontFamily: 'Inter_400Regular', letterSpacing: 0.1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const displayName = (user?.unsafeMetadata?.displayName as string | undefined) || user?.firstName || '';
  const firstName = displayName.trim().split(' ')[0] || '';
  const { holdings, isLoading: holdingsLoading, syncError: holdingsSyncError } = useHoldings();
  const { cashAccounts } = useCash();
  const { data: rawPrices, isLoading: pricesLoading, refetch } = useMarketPrices();
  const { data: egxStocks } = useEGXMarket();
  const prices = useMemo(() => {
    if (!rawPrices) return rawPrices;
    const egxPrices: Record<string, number> = {};
    egxStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
    return { ...rawPrices, egxPrices };
  }, [rawPrices, egxStocks]);
  const { plan, isPro } = useSubscription();
  const { impact } = useHaptic();
  const { hideValues, setHideValues } = useAppSettings();
  const isLoading = pricesLoading || holdingsLoading;

  // Auto-dismissing sync error toast for failed holdings CRUD
  const [showSyncError, setShowSyncError] = useState(false);
  const syncErrorAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!holdingsSyncError) return;
    setShowSyncError(true);
    Animated.timing(syncErrorAnim, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start();
    const timer = setTimeout(() => {
      Animated.timing(syncErrorAnim, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start(() => setShowSyncError(false));
    }, 4000);
    return () => clearTimeout(timer);
  }, [holdingsSyncError]);

  // Convert each cash account to EGP using live FX rates.
  // USD uses the dedicated usdToEgp field; EUR/GBP/SAR/AED/etc use fxRates
  // (a Record<string,number> of EGP-per-unit rates from the Wise feed).
  // Unknown currencies fall back to face value so totals are never silently dropped.
  const cashTotalEGP = useMemo(() => cashAccounts.reduce((sum, a) => {
    const bal = Number(a.balance) || 0;
    if (a.currency === 'EGP') return sum + bal;
    if (a.currency === 'USD' && prices?.usdToEgp) return sum + bal * prices.usdToEgp;
    const fxRate = prices?.fxRates?.[a.currency];
    if (fxRate) return sum + bal * fxRate;
    return sum + bal;
  }, 0), [cashAccounts, prices]);
  const hasForeignCash = cashAccounts.some(a => a.currency !== 'EGP');

  // Auto-refresh prices when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  const [timeFilter, setTimeFilter] = useState<ChartPeriod>('1D');
  const [sparkWidth, setSparkWidth] = useState(0);

  // ── Portfolio maths ────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let goldV = 0, silverV = 0, stockV = 0, reV = 0, paV = 0, fiV = 0, totalCost = 0;
    let todayGold = 0, todaySilver = 0;
    let goldGrams = 0, silverGrams = 0, stockCount = 0, reCount = 0, paCount = 0;

    for (const h of holdings) {
      const v = computeValue(h, prices);
      const c = computeCost(h, prices);
      totalCost += c;
      if (h.type === 'gold') {
        goldV += v; goldGrams += h.grams;
        todayGold += v * ((prices?.goldChangePercent ?? 0) / 100);
      } else if (h.type === 'silver') {
        silverV += v; silverGrams += h.grams;
        todaySilver += v * ((prices?.silverChangePercent ?? 0) / 100);
      } else if (h.type === 'stock') {
        stockV += v; stockCount++;
      } else if (h.type === 'personal_asset') {
        paV += v; paCount++;
      } else if (h.type === 'fixed_income') {
        fiV += v;
      } else {
        reV += v; reCount++;
      }
    }

    const totalValue = goldV + silverV + stockV + reV + paV + fiV;
    const gain = totalValue - totalCost;
    const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    const todayGain = todayGold + todaySilver;
    const todayPct = totalValue > 0 ? (todayGain / totalValue) * 100 : 0;

    return {
      totalValue, totalCost, gain, gainPct, todayGain, todayPct,
      goldV, silverV, stockV, reV, paV, fiV,
      goldGrams, silverGrams, stockCount, reCount, paCount,
    };
  }, [holdings, prices]);

  const chartSeed = useMemo(() => Math.floor(summary.totalCost) % 99991 || 7, [summary.totalCost]);
  const { snapshots } = usePortfolioSnapshots(summary.totalValue);

  const displayValue = useCounterDisplay(summary.totalValue);

  const isGain = summary.gain >= 0;
  const isTodayGain = summary.todayGain >= 0;
  const gainColor = isGain ? colors.green : colors.red;
  const todayColor = isTodayGain ? colors.green : colors.red;
  const hasHoldings = holdings.length > 0;

  const topHoldings = useMemo(() => {
    const withValue = holdings.map(h => ({ h, v: computeValue(h, prices) }));
    withValue.sort((a, b) => b.v - a.v);
    return withValue.slice(0, 5).map(x => x.h);
  }, [holdings, prices]);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Sync error toast */}
      {showSyncError && (
        <Animated.View
          style={[styles.syncToast, { backgroundColor: colors.red + 'EE', top: topPad + 12, opacity: syncErrorAnim }]}
          pointerEvents="none"
        >
          <Feather name="alert-circle" size={14} color="#fff" />
          <Text style={styles.syncToastText}>{holdingsSyncError}</Text>
        </Animated.View>
      )}

      {/* Gradient bloom — upper half only */}
      <ExpoLinearGradient
        colors={[colors.primary + '28', colors.primary + '10', 'transparent']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}
        pointerEvents="none"
      />
    <View style={{ flex: 1, paddingTop: topPad }}>
    <ScrollView
      style={styles.scrollTransparent}
      contentContainerStyle={[styles.content, { paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.text} />}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Profile avatar — taps into Settings */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/settings')}>
          {user?.imageUrl ? (
            <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary + '22' }]}>
              <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                {firstName ? firstName[0].toUpperCase() : (user?.primaryEmailAddress?.emailAddress?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Two-line greeting */}
        <View style={styles.greetingBlock}>
          <Text style={[styles.greetingHi, { color: colors.mutedForeground }]}>
            {(() => { const h = new Date().getHours(); return h < 12 ? t.greetingMorning : h < 18 ? t.greetingAfternoon : t.greetingEvening; })()}
          </Text>
          <View style={styles.greetingNameRow}>
            <Text style={[styles.greetingName, { color: colors.text }]} numberOfLines={1}>
              {firstName || t.thereGreeting}
            </Text>
            {isPro && <PremiumBadge size="sm" />}
          </View>
        </View>

        {/* Right: live chip + bell */}
        <View style={styles.headerRight}>
          <LiveChip lastUpdated={prices?.lastUpdated ?? null} />
          <TouchableOpacity
            style={[styles.bellBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <Feather name="bell" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Portfolio label ─────────────────────────────────────── */}
      <View style={styles.titleRow}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>{t.portfolio}</Text>
      </View>

      {/* ── Hero Card ───────────────────────────────────────────── */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ExpoLinearGradient
          colors={[colors.primary + '00', colors.primary + 'CC', colors.primary + '00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroAccent}
        />

        {/* Show pulsing skeleton while prices haven't arrived yet */}
        {pricesLoading && !rawPrices ? (
          <HeroSkeleton />
        ) : (
        <View style={styles.heroBody}>
          {/* Label */}
          <View style={styles.heroLabelRow}>
            <Text style={[styles.heroLabel, { color: colors.mutedForeground, textAlign: 'center' }]}>
              {t.totalPortfolioValue}
            </Text>
          </View>

          {/* Big value */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { impact(); setHideValues(!hideValues); }}
            accessibilityRole="button"
            accessibilityLabel={hideValues ? 'Show portfolio values' : 'Hide portfolio values'}
          >
            <View style={styles.heroValueRow}>
              <Text style={[styles.heroValue, { color: colors.text }]}>
                {hideValues ? '••••••' : displayValue}
              </Text>
              <Text style={[styles.heroCurrency, { color: colors.mutedForeground }]}>EGP</Text>
            </View>
          </TouchableOpacity>

          {/* Net worth (investments + cash) — additive row, only when user has cash accounts */}
          {cashTotalEGP > 0 && (
            <View style={styles.netWorthRow}>
              <Feather name="plus-circle" size={10} color={colors.mutedForeground + '88'} />
              <Text style={[styles.netWorthTxt, { color: colors.mutedForeground }]}>
                {hideValues
                  ? `${t.netWorthLabel}: ••••••`
                  : `${t.netWorthLabel}: ${fmtCompact(summary.totalValue + cashTotalEGP)} EGP`}
              </Text>
            </View>
          )}

          {/* Invested · Current · Return strip */}
          {summary.totalCost > 0 && (
            <View style={[styles.iStrip, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
              <View style={styles.iCell}>
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>{t.invested}</Text>
                <View style={styles.iCellValueRow}>
                  <Text style={[styles.iCellValue, { color: colors.text }]}>{hideValues ? '••••' : fmtCompact(summary.totalCost)}</Text>
                  {!hideValues && <Text style={[styles.iCellCur, { color: colors.mutedForeground }]}>EGP</Text>}
                </View>
              </View>
              <View style={[styles.iDivider, { backgroundColor: colors.border }]} />
              <View style={styles.iCell}>
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>{t.currentLabel}</Text>
                <View style={styles.iCellValueRow}>
                  <Text style={[styles.iCellValue, { color: colors.text }]}>{hideValues ? '••••' : fmtCompact(summary.totalValue)}</Text>
                  {!hideValues && <Text style={[styles.iCellCur, { color: colors.mutedForeground }]}>EGP</Text>}
                </View>
              </View>
              <View style={[styles.iDivider, { backgroundColor: colors.border }]} />
              <View style={styles.iCell}>
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>{t.returnLabel}</Text>
                <View style={styles.iCellValueRow}>
                  <Text style={[styles.iCellValue, { color: gainColor }]}>
                    {`${isGain ? '+' : ''}${summary.gainPct.toFixed(1)}%`}
                  </Text>
                  <Text style={[styles.iCellCur, { color: gainColor + 'AA' }]}>
                    {isGain ? '▲' : '▼'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* P/L row */}
          {summary.totalCost > 0 && (
            <View style={styles.plRow}>
              <View style={[styles.plChip, { backgroundColor: todayColor + '0D', borderColor: todayColor + '20' }]}>
                <View style={styles.plTop}>
                  <Feather name={isTodayGain ? 'trending-up' : 'trending-down'} size={10} color={todayColor + 'CC'} />
                  <Text style={[styles.plLabel, { color: colors.mutedForeground }]}>{t.todayLabel}</Text>
                  <View style={[styles.plBadge, { backgroundColor: todayColor + '1A' }]}>
                    <Text style={[styles.plBadgeText, { color: todayColor }]}>
                      {`${isTodayGain ? '+' : ''}${summary.todayPct.toFixed(2)}%`}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.plValue, { color: todayColor }]}>
                  {hideValues ? '••••' : `${isTodayGain ? '+' : '−'}${Math.abs(summary.todayGain).toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP`}
                </Text>
              </View>

              <View style={[styles.plChip, { backgroundColor: gainColor + '0D', borderColor: gainColor + '20' }]}>
                <View style={styles.plTop}>
                  <Feather name={isGain ? 'trending-up' : 'trending-down'} size={10} color={gainColor + 'CC'} />
                  <Text style={[styles.plLabel, { color: colors.mutedForeground }]}>{t.totalPL}</Text>
                  <View style={[styles.plBadge, { backgroundColor: gainColor + '1A' }]}>
                    <Text style={[styles.plBadgeText, { color: gainColor }]}>
                      {`${isGain ? '+' : ''}${summary.gainPct.toFixed(2)}%`}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.plValue, { color: gainColor }]}>
                  {hideValues ? '••••' : `${isGain ? '+' : '−'}${Math.abs(summary.gain).toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP`}
                </Text>
              </View>
            </View>
          )}

          {/* Performance Chart */}
          {hasHoldings && (
            <>
              <View
                style={[styles.chartWrap, { borderTopColor: colors.border }]}
                onLayout={(e: LayoutChangeEvent) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0) setSparkWidth(w);
                }}
              >
                <PerfChart
                  gainPct={summary.gainPct}
                  period={timeFilter}
                  seed={chartSeed}
                  width={sparkWidth}
                  height={78}
                  snapshots={snapshots}
                />
              </View>

              {/* Time filters */}
              <View style={styles.timeRow}>
                {CHART_PERIODS.map(f => {
                  const active = f === timeFilter;
                  return (
                    <Pressable
                      key={f}
                      style={({ pressed }) => [
                        styles.timePill,
                        {
                          backgroundColor: active ? colors.primary : colors.muted + '90',
                          borderColor: active ? colors.primary : 'transparent',
                          opacity: pressed ? 0.7 : 1,
                          transform: [{ scale: pressed ? 0.94 : 1 }],
                        },
                      ]}
                      onPress={() => {
                        if (f !== timeFilter) {
                          if (Platform.OS !== 'web') {
                            impact();
                          }
                          setTimeFilter(f);
                        }
                      }}
                    >
                      <Text style={[styles.timePillText, {
                        color: active ? colors.primaryForeground : colors.mutedForeground,
                      }]}>
                        {f}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
        )}

        {/* Allocation strip */}
        {hasHoldings && summary.totalValue > 0 && (
          <View style={[styles.allocationStrip, { borderTopColor: colors.border }]}>
            <AllocationBar
              segments={[
                {
                  label: t.gold,     value: summary.goldV,   color: colors.primary,
                  icon: { lib: 'mci' as const, name: 'gold' }, quantity: summary.goldGrams > 0 ? `${summary.goldGrams.toFixed(1)}g` : undefined,
                },
                {
                  label: t.silver,   value: summary.silverV, color: colors.silverColor,
                  icon: { lib: 'mci' as const, name: 'gold' }, quantity: summary.silverGrams > 0 ? `${summary.silverGrams.toFixed(1)}g` : undefined,
                },
                {
                  label: t.egxStock, value: summary.stockV,  color: '#4A9EFF',
                  icon: 'trending-up', quantity: summary.stockCount > 0 ? `${summary.stockCount} stock${summary.stockCount !== 1 ? 's' : ''}` : undefined,
                },
                {
                  label: t.realEstate, value: summary.reV,  color: '#A47FCA',
                  icon: { lib: 'mci' as const, name: 'home-city' }, quantity: summary.reCount > 0 ? `${summary.reCount} propert${summary.reCount !== 1 ? 'ies' : 'y'}` : undefined,
                },
                {
                  label: t.personalAsset, value: summary.paV, color: '#E08E45',
                  icon: { lib: 'mci' as const, name: 'tag-multiple' }, quantity: summary.paCount > 0 ? `${summary.paCount} asset${summary.paCount !== 1 ? 's' : ''}` : undefined,
                },
                {
                  label: t.fixedIncome, value: summary.fiV, color: '#22C55E',
                  icon: { lib: 'mci' as const, name: 'bank-transfer' },
                },
              ]}
              hideValues={hideValues}
            />
          </View>
        )}
      </View>

      {/* ── Cash Card ───────────────────────────────────────────── */}
      {cashAccounts.length > 0 && (
        <TouchableOpacity
          style={[styles.cashCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/cash-accounts' as any)}
          activeOpacity={0.85}
        >
          <View style={[styles.cashIconWrap, { backgroundColor: colors.green + '1A' }]}>
            <BanknoteIcon size={20} color={colors.green} />
          </View>
          <View style={styles.cashInfo}>
            <Text style={[styles.cashLabel, { color: colors.mutedForeground }]}>{t.cash}</Text>
            <Text style={[styles.cashValue, { color: colors.text }]} numberOfLines={1}>
              {hideValues ? '••••••' : `${hasForeignCash ? '≈ ' : ''}${cashTotalEGP.toLocaleString('en-EG', { maximumFractionDigits: 0 })}`} EGP
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}

      {/* ── Top Investments ─────────────────────────────────────── */}
      <View style={styles.holdingsSection}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {topHoldings.length > 0 ? t.topHoldings : t.holdings.toUpperCase()}
          </Text>
          <View style={styles.sectionRowRight}>
            {holdings.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.countText, { color: colors.mutedForeground }]}>{holdings.length}</Text>
              </View>
            )}
            {holdings.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/holdings')}
                hitSlop={8}
                style={styles.manageBtn}
              >
                <Text style={[styles.manageTxt, { color: colors.primary }]}>Manage</Text>
                <Feather name="chevron-right" size={12} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {holdingsLoading && holdings.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, justifyContent: 'center' }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptySub, { color: colors.mutedForeground, marginTop: 12 }]}>Loading your investments…</Text>
          </View>
        ) : topHoldings.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyRing2, { borderColor: colors.primary + '10' }]} />
            <View style={[styles.emptyRing1, { borderColor: colors.primary + '20' }]} />
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="briefcase" size={26} color={colors.primary + 'AA'} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noInvestmentsYet}</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>{t.addFromHoldingsTab}</Text>
          </View>
        ) : (
          <View style={styles.holdingsList}>
            {topHoldings.map(h => (
              <HoldingCard
                key={h.id}
                holding={h}
                prices={prices}
                hideValues={hideValues}
                hideSubtitle
                onEdit={() => router.push(`/add-investment?holdingId=${h.id}` as any)}
              />
            ))}
            {holdings.length > 5 && (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/holdings')}
                style={[styles.seeAllBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.seeAllTxt, { color: colors.mutedForeground }]}>
                  See all {holdings.length} investments
                </Text>
                <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
    </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1 },
  scrollTransparent: { flex: 1, backgroundColor: 'transparent' },
  content:          { paddingHorizontal: 20, gap: 20 },

  header:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:          { width: 36, height: 36, borderRadius: 18 },
  avatarFallback:  { alignItems: 'center', justifyContent: 'center' },
  avatarInitial:   { fontSize: 14, fontFamily: 'Inter_700Bold' },
  greetingBlock:   { flex: 1, gap: 1, minWidth: 0 },
  greetingHi:      { fontSize: 11, fontFamily: 'Inter_400Regular' },
  greetingNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  greetingName:    { fontSize: 15, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  headerRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn:         { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  screenTitle:   { fontSize: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },

  heroCard:   { borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  heroAccent: { height: 1.25 },
  heroBody:   { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24, gap: 16, alignItems: 'stretch' },

  cashCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18, paddingVertical: 16, marginTop: 14,
  },
  cashIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cashInfo: { flex: 1, gap: 2 },
  cashLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  cashValue: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },

  heroLabelRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroLabel:      { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  heroValueRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 6, justifyContent: 'center', alignSelf: 'stretch' },
  heroValue:      { fontSize: 46, fontFamily: 'Inter_700Bold', letterSpacing: -2, lineHeight: 52, flexShrink: 1, textAlign: 'center' },
  heroCurrency:   { fontSize: 16, fontFamily: 'Inter_400Regular', letterSpacing: 0, paddingBottom: 6 },
  netWorthRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  netWorthTxt:    { fontSize: 11, fontFamily: 'Inter_400Regular' },

  iStrip:         { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: -24, paddingHorizontal: 24 },
  iCell:          { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  iCellLabel:     { fontSize: 10, fontFamily: 'Inter_400Regular', letterSpacing: 0.2 },
  iCellValueRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  iCellValue:     { fontSize: 14, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  iCellCur:       { fontSize: 9, fontFamily: 'Inter_400Regular' },
  iDivider:       { width: StyleSheet.hairlineWidth, marginVertical: 14 },

  plRow:          { flexDirection: 'row', gap: 8 },
  plChip:         { flex: 1, gap: 5, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10 },
  plTop:          { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plLabel:        { flex: 1, fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  plValue:        { fontSize: 13, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  plBadge:        { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  plBadgeText:    { fontSize: 9, fontFamily: 'Inter_700Bold' },

  chartWrap:  { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  timeRow:    { flexDirection: 'row', gap: 5 },
  timePill:   { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  timePillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  allocationStrip: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 20, gap: 0 },

  holdingsSection:  { gap: 12 },
  sectionRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel:     { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2, flex: 1 },
  sectionRowRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  countText:        { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  manageBtn:        { flexDirection: 'row', alignItems: 'center', gap: 2 },
  manageTxt:        { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  empty:        { borderRadius: 22, borderWidth: 1, padding: 40, alignItems: 'center', gap: 12, overflow: 'hidden' },
  emptyRing1:   { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 1, top: -60, right: -60 },
  emptyRing2:   { position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 1, top: -120, right: -100 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptySub:     { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },

  holdingsList: { gap: 8 },
  seeAllBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  seeAllTxt:    { fontSize: 13, fontFamily: 'Inter_500Medium' },

  syncToast: {
    position: 'absolute', left: 16, right: 16, zIndex: 99,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14,
  },
  syncToastText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
});
