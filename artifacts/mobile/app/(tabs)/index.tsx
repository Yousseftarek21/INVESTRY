import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, Animated, AppState, Image, LayoutChangeEvent, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { forwardChevron, forwardArrow } from '@/utils/rtl';
import { pctDelta } from '@/utils/pctDelta';
import { tradingDayStart } from '@/utils/cairoDate';
import { fmtCompact } from '@/utils/formatNumber';
import { UpdateAvailableBanner } from '@/components/UpdateAvailableBanner';
import { CompetitionInviteBanner } from '@/components/CompetitionInviteBanner';
import { PerfChart } from '@/components/PerfChart';
import { CHART_PERIODS, ChartPeriod, getHistoryCoverage, isPeriodAvailable, periodLimitedByHistory } from '@/utils/chartUtils';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { useIntradaySamples } from '@/hooks/useIntradaySamples';
import { useServerIntraday } from '@/hooks/useServerIntraday';
import { useNotificationHistory } from '@/hooks/useNotificationHistory';
import { useCashAccountsTodayChanges } from '@/hooks/useCashAccountsTodayChanges';
import { usePortfolioTier } from '@/hooks/usePortfolioTier';
import { TierCelebration } from '@/components/TierCelebration';
import { maybeRequestReview } from '@/utils/appReview';
import { TierSeal } from '@/components/TierSeal';
import { TierCard } from '@/components/TierCard';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router } from 'expo-router';
import { useUser } from '@clerk/expo';
import { BanknoteIcon } from '@/components/BanknoteIcon';
import { useColors } from '@/hooks/useColors';
import { useCounterDisplay } from '@/hooks/useCounterDisplay';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useHoldings } from '@/context/HoldingsContext';
import { useCash } from '@/context/CashContext';
import { useGoals } from '@/context/GoalsContext';
import { GoalRing } from '@/components/GoalRing';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { pricesAreFresh } from '@/utils/pricesCache';
import { getRECurrentValue } from '@/utils/rePrice';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAppSettings, DisplayCurrency } from '@/context/AppSettingsContext';
import { AllocationBar } from '@/components/AllocationBar';
import { DetailModal } from '@/components/DetailModal';
import { HoldingCard } from '@/components/HoldingCard';
import { Holding, MarketPrices } from '@/types';
import { computeCashTotalEGP } from '@/utils/cash';

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

// Monthly/quarterly-payout certificates pay interest out to a linked account
// each period rather than compounding it back into the certificate — its
// value stays flat at principal until maturity. Only at-maturity products
// accrue. Matches components/HoldingCard.tsx, the canonical per-holding
// display — this used to accrue unconditionally, overstating totals here.
function fixedIncomeAccruedValue(h: Extract<Holding, { type: 'fixed_income' }>, asOf: Date = new Date()): number {
  if (h.paymentFrequency !== 'at_maturity') return h.principal;
  const purchase = new Date(h.purchaseDate);
  const maturity = new Date(h.maturityDate);
  const daysTotal = Math.max(1, (maturity.getTime() - purchase.getTime()) / 86400000);
  const daysElapsed = Math.max(0, Math.min(daysTotal, (asOf.getTime() - purchase.getTime()) / 86400000));
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

// ─── Animated number display ──────────────────────────────────────────────────

// Mounted only once real prices/holdings have actually loaded (the parent
// renders HeroSkeleton in its place until then) so useCounterDisplay's
// internal state initializes directly with the true first value instead of
// a placeholder-derived one, and the 700ms tween never plays on that first
// reveal. Every value change after that (refresh, a live price tick) still
// animates normally; only this initial wrong-number-then-animate moment is
// what's being avoided.
// Every million from 1M to 100M. Each is only ever celebrated once, so
// climbing through them one at a time is the point — passing 4M should feel
// like an event even though 3M already did.
const MILESTONES = Array.from({ length: 100 }, (_, i) => (i + 1) * 1_000_000);

// Fires once per threshold ever crossed, per account. The highest milestone
// reached is persisted, so re-opening the app — or dipping back below and
// climbing again — doesn't replay it. Values are compared in EGP, not the
// display currency, so switching currency can't manufacture a crossing.
function useMilestoneSweep(totalEgp: number, userId: string | null | undefined) {
  const sweep = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(false);
  const storedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) { storedRef.current = null; return; }
    AsyncStorage.getItem(`@investry_milestone_${userId}`)
      .then(v => { storedRef.current = v ? Number(v) || 0 : 0; })
      .catch(() => { storedRef.current = 0; });
  }, [userId]);

  useEffect(() => {
    if (!userId || storedRef.current === null || totalEgp <= 0) return;
    const reached = MILESTONES.filter(m => totalEgp >= m).pop() ?? 0;
    if (reached <= storedRef.current) return;
    storedRef.current = reached;
    AsyncStorage.setItem(`@investry_milestone_${userId}`, String(reached)).catch(() => null);
    setActive(true);
    sweep.setValue(0);
    Animated.timing(sweep, { toValue: 1, duration: 1400, useNativeDriver: true })
      .start(() => setActive(false));
  }, [totalEgp, userId]);

  return { sweep, active };
}

function PortfolioHeroValue({ value, hidden }: { value: number; hidden: boolean }) {
  const colors = useColors();
  const { text: displayValue, tint } = useCounterDisplay(value);
  return (
    <Animated.Text
      style={[styles.heroValue, { color: hidden ? colors.text : (tint ?? colors.text) }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.5}
    >
      {hidden ? '••••••' : displayValue}
    </Animated.Text>
  );
}

// The hero's heading reads as a small caps eyebrow rather than a sentence —
// it sits above a 46px figure, so the contrast in scale is what gives the card
// its hierarchy. Latin only: Arabic is a cursive script, where letter-spacing
// pulls apart letters that are meant to join and uppercase means nothing.
function heroEyebrow(language: string) {
  return language === 'ar'
    ? null
    : { textTransform: 'uppercase' as const, letterSpacing: 1.15, fontSize: 10 };
}

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────

function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  // Narrow, high-floor range — a gentle breath rather than a hard blink.
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] });
}

function SkeletonBox({ w, h, radius = 8, style }: { w: number | string; h: number; radius?: number; style?: object }) {
  const opacity = useShimmer();
  return (
    <Animated.View style={[{ width: w as number, height: h, borderRadius: radius, opacity }, style]} />
  );
}

// Only the *numbers* are unknown while prices load — the card's labels and
// structure are not. Rendering the real heading and keeping the placeholders
// faint (rather than blanking the whole card out with heavy grey blocks)
// makes the wait read as the hero filling in, instead of a different screen.
function HeroSkeleton() {
  const colors = useColors();
  const t = useT();
  const { language } = useAppSettings();
  const bg = colors.muted + '55';
  const bgFaint = colors.muted + '33';
  return (
    <View style={[heroSkSt.body, { gap: 14 }]}>
      <Text style={[styles.heroLabel, heroEyebrow(language), { color: colors.mutedForeground, textAlign: 'center' }]}>
        {t.totalPortfolioValue}
      </Text>
      <SkeletonBox w={186} h={38} radius={10} style={{ backgroundColor: bg, alignSelf: 'center' }} />
      <View style={[heroSkSt.strip, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
        {[0, 1, 2].map(i => (
          <View key={i} style={heroSkSt.stripCell}>
            <SkeletonBox w={42} h={8} radius={4} style={{ backgroundColor: bgFaint }} />
            <SkeletonBox w={62} h={12} radius={5} style={{ backgroundColor: bg }} />
          </View>
        ))}
      </View>
      <View style={heroSkSt.plRow}>
        <View style={heroSkSt.plCell}>
          <SkeletonBox w="100%" h={48} radius={12} style={{ backgroundColor: bgFaint }} />
        </View>
        <View style={heroSkSt.plCell}>
          <SkeletonBox w="100%" h={48} radius={12} style={{ backgroundColor: bgFaint }} />
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

  // On a cold open the hero now renders from prices cached on disk, which are
  // real but may be minutes old. Claiming "LIVE" over them would be the same
  // dishonesty as the old fabricated-total flash, just relocated — so the dot
  // goes grey and stops pulsing until a fresh fetch lands, which is usually
  // well under a second. The timestamp below already says which it is.
  const fresh = pricesAreFresh(lastUpdated);
  const tint = fresh ? colors.green : colors.mutedForeground;

  return (
    <View style={chipSt.col}>
      <View style={[chipSt.pill, { backgroundColor: tint + '14', borderColor: tint + '30' }]}>
        <Animated.View style={[chipSt.dot, { backgroundColor: tint, opacity: fresh ? opacity : 0.5 }]} />
        <Text style={[chipSt.label, { color: tint }]}>{t.liveLabel}</Text>
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
  const { goals } = useGoals();
  const { data: rawPrices, isLoading: pricesLoading, isPlaceholderData: pricesArePlaceholder, isError: pricesErrored, refetch } = useMarketPrices();
  const { data: egxStocks } = useEGXMarket();
  const prices = useMemo(() => {
    if (!rawPrices) return rawPrices;
    const egxPrices: Record<string, number> = {};
    egxStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
    return { ...rawPrices, egxPrices };
  }, [rawPrices, egxStocks]);
  const { unreadCount: unreadNotifications } = useNotificationHistory();
  const { impact } = useHaptic();
  const { hideValues, setHideValues, displayCurrency, setDisplayCurrency, visibleCurrencies, notifications, language } = useAppSettings();
  const isLoading = pricesLoading || holdingsLoading;

  // ── Display-currency conversion ────────────────────────────────────────────
  // Which currencies the switcher offers is a user preference now (Profile →
  // Display currencies); this only renders what they picked.
  const DISP_CURRENCIES: DisplayCurrency[] = visibleCurrencies;
  const fxRate = useMemo<Record<DisplayCurrency, number>>(() => ({
    EGP: 1,
    USD: prices?.usdToEgp ?? 51,
    EUR: prices?.fxRates?.EUR ?? 55.5,
    AED: prices?.fxRates?.AED ?? 13.9,
    GBP: prices?.fxRates?.GBP ?? 65.0,
    SAR: prices?.fxRates?.SAR ?? 13.6,
    QAR: prices?.fxRates?.QAR ?? 14.0,
    KWD: prices?.fxRates?.KWD ?? 166.0,
    CHF: prices?.fxRates?.CHF ?? 57.5,
    CNY: prices?.fxRates?.CNY ?? 7.05,
    TRY: prices?.fxRates?.TRY ?? 1.55,
  }), [prices]);
  const toDisp = useCallback((egp: number) => egp / fxRate[displayCurrency], [fxRate, displayCurrency]);

  // ── Currency picker visibility ─────────────────────────────────────────────
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

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

  const cashTotalEGP = useMemo(() => computeCashTotalEGP(cashAccounts, prices), [cashAccounts, prices]);
  // Real balances in the currencies they're actually held in — the single
  // converted total necessarily hides this, and someone holding dollars
  // thinks in dollars, not in a converted equivalent. Largest first, and
  // only rendered when more than one currency is present.
  // Currency rows the Cash card lists before collapsing the rest into a
  // "+N more". Three covers realistic holdings while keeping the card from
  // growing without bound.
  const CASH_CURRENCY_CELLS = 3;
  const cashByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    cashAccounts.forEach(a => {
      totals.set(a.currency, (totals.get(a.currency) ?? 0) + (Number(a.balance) || 0));
    });
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [cashAccounts]);
  // Today's manual balance-update deltas, re-bucketed from per-account (how
  // the API returns them, and how the Cash Accounts screen's own badges read
  // them) into per-currency, to match the rows this card actually renders.
  const { todayChanges: cashTodayByAccount } = useCashAccountsTodayChanges();
  const cashTodayByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    cashAccounts.forEach(a => {
      const delta = cashTodayByAccount[a.id];
      if (!delta) return;
      totals.set(a.currency, (totals.get(a.currency) ?? 0) + delta);
    });
    return totals;
  }, [cashAccounts, cashTodayByAccount]);
  // Same today's-delta figure, but as one EGP total rather than bucketed by
  // currency — only needed for the single-currency card, which shows one
  // converted row instead of a per-currency list.
  const cashTodayEGP = useMemo(() => {
    const deltaAccounts = cashAccounts.map(a => ({ ...a, balance: cashTodayByAccount[a.id] ?? 0 }));
    return computeCashTotalEGP(deltaAccounts, prices);
  }, [cashAccounts, cashTodayByAccount, prices]);
  // Tweens through the intermediate values (rather than jumping straight to
  // the new number) whenever it changes — including when it changes purely
  // because the display currency was switched, not just when a balance
  // moves. No flash colour: a currency switch isn't a gain or a loss.
  const { text: cashTotalDispText } = useCounterDisplay(toDisp(cashTotalEGP), fmtCompact, false);
  // Width of the amount column, from the longest amount actually shown.
  // Amounts sit left-aligned inside it, so every currency code begins at the
  // same x while staying adjacent to its number — pushing codes to the card's
  // right edge instead left a dead channel beside shorter balances.
  // 10.4px is the advance of an Inter_700Bold digit at 17px, uniform here
  // because of fontVariant: tabular-nums.
  const cashAmountWidth = useMemo(() => {
    const shown = cashByCurrency.slice(0, CASH_CURRENCY_CELLS);
    if (shown.length < 2) return undefined; // a lone row has nothing to align to
    const longest = Math.max(
      ...shown.map(([, amt]) => fmtCompact(amt).length),
    );
    return Math.ceil(longest * 10.4);
  }, [cashByCurrency]);
  // A goal linked to a cash account tracks that account's live balance
  // instead of its own stored savedAmount — mirrors goals.tsx's own
  // effectiveSaved exactly, so this row's numbers always match that screen.
  const effectiveGoalSaved = useCallback((g: (typeof goals)[number]) => {
    if (!g.linkedCashAccountId) return g.savedAmount;
    const account = cashAccounts.find(a => a.id === g.linkedCashAccountId);
    return account ? account.balance : g.savedAmount;
  }, [cashAccounts]);

  const GOAL_RING_COLORS = [colors.primary, '#4A9EFF', '#8B5CF6'];

  const goalsSummary = useMemo(() => {
    if (goals.length === 0) return null;
    const withPct = goals.map(g => {
      const saved = effectiveGoalSaved(g);
      const pct = g.targetAmount > 0 ? (saved / g.targetAmount) * 100 : 0;
      return { goal: g, saved, pct, done: pct >= 100 };
    });
    // Nearest deadline first — goals with no deadline sort last. Only
    // matters for which 3 rings appear in the cluster; the average below
    // still covers every goal, not just the ones shown.
    const sorted = [...withPct].sort((a, b) => {
      if (a.goal.deadline && b.goal.deadline) return a.goal.deadline.localeCompare(b.goal.deadline);
      if (a.goal.deadline) return -1;
      if (b.goal.deadline) return 1;
      return 0;
    });
    const avgPct = withPct.reduce((sum, g) => sum + g.pct, 0) / withPct.length;
    const totalSaved = withPct.reduce((sum, g) => sum + g.saved, 0);
    const totalTarget = withPct.reduce((sum, g) => sum + g.goal.targetAmount, 0);
    return { sorted, avgPct, totalSaved, totalTarget, count: goals.length, single: withPct.length === 1 ? withPct[0] : null };
  }, [goals, effectiveGoalSaved]);

  // Auto-refresh prices when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  const [timeFilter, setTimeFilter] = useState<ChartPeriod>('1D');
  const [chartScrubbing, setChartScrubbing] = useState(false);
  const [sparkWidth, setSparkWidth] = useState(0);
  const [showTodayBreakdown, setShowTodayBreakdown] = useState(false);
  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  const showModal = (title: string, content: string) => { impact(); setModal({ title, content }); };

  // ── Portfolio maths ────────────────────────────────────────────────────────
  const egxChangeByTicker = useMemo(() => {
    const m: Record<string, number> = {};
    egxStocks?.forEach(s => { m[s.ticker] = s.changePercent; });
    return m;
  }, [egxStocks]);

  const summary = useMemo(() => {
    let goldV = 0, silverV = 0, stockV = 0, reV = 0, paV = 0, fiV = 0, totalCost = 0;
    let todayGold = 0, todaySilver = 0, todayStock = 0, todayFI = 0;
    // Metal-only slice of todayGold/todaySilver — isolates the price of the
    // metal itself from the FX move that's compounded into it below, so the
    // Today breakdown can show "gold: 0%, currency: -1.2%" instead of
    // crediting/blaming gold for a move that was actually the EGP rate.
    let todayGoldMetal = 0, todaySilverMetal = 0;
    let goldGrams = 0, silverGrams = 0, stockCount = 0, reCount = 0, paCount = 0;

    for (const h of holdings) {
      const v = computeValue(h, prices);
      const c = computeCost(h, prices);
      totalCost += c;
      if (h.type === 'gold') {
        goldV += v; goldGrams += h.grams;
        // goldChangePercent is the metal's raw USD move (matches the Markets
        // tab's own display) — goldChangePercentEgp compounds that with
        // today's FX move, which is what a holding valued in EGP (`v`)
        // actually needs, or it can show a gain on a day the EGP value fell.
        todayGold += pctDelta(v, prices?.goldChangePercentEgp ?? 0);
        todayGoldMetal += pctDelta(v, prices?.goldChangePercent ?? 0);
      } else if (h.type === 'silver') {
        silverV += v; silverGrams += h.grams;
        todaySilver += pctDelta(v, prices?.silverChangePercentEgp ?? 0);
        todaySilverMetal += pctDelta(v, prices?.silverChangePercent ?? 0);
      } else if (h.type === 'stock') {
        stockV += v; stockCount++;
        const changePercent = egxChangeByTicker[h.symbol] ?? 0;
        todayStock += pctDelta(v, changePercent);
      } else if (h.type === 'personal_asset') {
        paV += v; paCount++;
      } else if (h.type === 'fixed_income') {
        fiV += v;
        // Accrual since the trading day began, not since 24h ago. A rolling
        // window never resets: right after the boundary it still showed a
        // whole day's interest while every other bucket had just gone to
        // zero, so "Today" could never read flat on a portfolio holding any.
        todayFI += v - fixedIncomeAccruedValue(h, tradingDayStart());
      } else {
        reV += v; reCount++;
      }
    }

    const totalValue = goldV + silverV + stockV + reV + paV + fiV;
    const gain = totalValue - totalCost;
    const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    const todayGain = todayGold + todaySilver + todayStock + todayFI;
    // Divide by the start-of-day value, not today's end value — otherwise a
    // day's move is measured against a base that already includes that same
    // move, understating gains and overstating the magnitude of losses.
    const startOfDayValueForPct = totalValue - todayGain;
    const todayPct = startOfDayValueForPct > 0 ? (todayGain / startOfDayValueForPct) * 100 : 0;

    return {
      totalValue, totalCost, gain, gainPct, todayGain, todayPct,
      goldV, silverV, stockV, reV, paV, fiV,
      goldGrams, silverGrams, stockCount, reCount, paCount,
      todayGold, todaySilver, todayStock, todayFI,
      todayGoldMetal, todaySilverMetal,
    };
  }, [holdings, prices, egxChangeByTicker]);

  // ── Today breakdown ──────────────────────────────────────────────────────────
  // Same four buckets that already sum to summary.todayGain above — this just
  // exposes them individually instead of only their total, so "why is today
  // up/down X%" has a real, traceable answer instead of one opaque number.
  //
  // Gold/silver's own row shows only the metal's price move; the FX move
  // compounded into their EGP value is broken out into its own Currency row
  // instead — otherwise a day like "gold didn't move, but EGP/USD did" would
  // show as a misleading "Gold -1.2%" when gold itself was flat.
  const todayBreakdown = useMemo(() => {
    const rows: { key: string; label: string; color: string; icon: React.ReactNode; amount: number; pct: number | null }[] = [];
    if (summary.goldV > 0) {
      rows.push({
        key: 'gold', label: t.gold, color: colors.primary,
        icon: <MaterialCommunityIcons name="gold" size={16} color={colors.primary} />,
        amount: summary.todayGoldMetal, pct: prices?.goldChangePercent ?? null,
      });
    }
    if (summary.silverV > 0) {
      rows.push({
        key: 'silver', label: t.silver, color: colors.silverColor,
        icon: <MaterialCommunityIcons name="gold" size={16} color={colors.silverColor} />,
        amount: summary.todaySilverMetal, pct: prices?.silverChangePercent ?? null,
      });
    }
    if (summary.goldV > 0 || summary.silverV > 0) {
      const todayFx = (summary.todayGold - summary.todayGoldMetal) + (summary.todaySilver - summary.todaySilverMetal);
      rows.push({
        key: 'fx', label: t.currencyFxLabel, color: '#F59E0B',
        icon: <Feather name="dollar-sign" size={16} color="#F59E0B" />,
        amount: todayFx, pct: prices?.usdToEgpChangePercent ?? null,
      });
    }
    if (summary.stockV > 0) {
      const startOfDayStockV = summary.stockV - summary.todayStock;
      rows.push({
        key: 'stock', label: t.egxStocksAllocLabel, color: '#4A9EFF',
        icon: <Feather name="bar-chart-2" size={16} color="#4A9EFF" />,
        amount: summary.todayStock, pct: startOfDayStockV > 0 ? (summary.todayStock / startOfDayStockV) * 100 : null,
      });
    }
    if (summary.fiV > 0) {
      rows.push({
        key: 'fixedIncome', label: t.fixedIncome, color: '#22C55E',
        icon: <MaterialCommunityIcons name="bank-transfer" size={16} color="#22C55E" />,
        amount: summary.todayFI, pct: null, // accrual, not a price move — no % is shown for this row
      });
    }
    return rows.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [summary, prices, colors, t]);

  const { snapshots } = usePortfolioSnapshots(summary.totalValue);
  // A period is only offered once real recorded history reaches back that
  // far — otherwise it can only redraw a shorter period's data, which reads
  // as a duplicate curve. Selecting an unavailable one is blocked, and if
  // the active period becomes unavailable it falls back to 1D.
  const coverage = React.useMemo(() => getHistoryCoverage(snapshots), [snapshots]);
  React.useEffect(() => {
    if (!isPeriodAvailable(timeFilter, coverage)) setTimeFilter('1D');
  }, [coverage, timeFilter]);
  // Tier runs on net worth (investments + cash) — the same figure rendered as
  // "Net Worth incl. cash" under the hero, so the badge and that number can
  // never disagree. Always EGP, never the display currency: switching to USD
  // must not look like a demotion.
  const netWorthEgp = summary.totalValue + cashTotalEGP;
  const { tier, since: tierSince, change: tierChange, clearChange: clearTierChange } = usePortfolioTier(netWorthEgp);
  const [showTierCard, setShowTierCard] = useState(false);

  const startOfDayValue = summary.totalValue - summary.todayGain;
  const rawTodaySamples = useIntradaySamples(summary.totalValue, startOfDayValue);
  const { data: serverIntraday } = useServerIntraday();
  // The stored samples' own first/last points can be up to ~10 minutes
  // stale (they're debounced to avoid flooding storage), while the "Today"
  // badge above always recomputes live on every render. Using stale
  // endpoints here could make the chart's color disagree with that badge
  // if the live gain direction shifted since the last sample was written.
  // So: always anchor the chart's start/end to the current live numbers
  // (identical to what drives the badge), and only use the stored samples
  // for real texture *in between* those two fresh, guaranteed-consistent
  // points.
  const todaySamples = useMemo(() => {
    // Server-recorded points win: the cron samples every 5 minutes for
    // everyone regardless of whether the app was ever opened, so it captures
    // the day's real ups and downs. The on-device sampler only sees what
    // happened while the app was running, which on most days is nothing —
    // leaving 1D as a straight start-to-now line. Fall back to it only when
    // the server has nothing yet (first run after deploy, brand-new user).
    const serverMiddle = serverIntraday && serverIntraday.length > 0
      ? serverIntraday.map(p => p.v)
      : null;
    const middle = serverMiddle
      ?? (rawTodaySamples && rawTodaySamples.length > 2 ? rawTodaySamples.slice(1, -1) : []);
    return [startOfDayValue, ...middle, summary.totalValue];
  }, [serverIntraday, rawTodaySamples, startOfDayValue, summary.totalValue]);

  const isGain = summary.gain >= 0;
  const isTodayGain = summary.todayGain >= 0;
  // A genuinely flat day (every market closed, e.g. a Saturday holiday)
  // still satisfies todayGain >= 0 and read as a green "+0.00%" gain —
  // same fix as the breakdown modal's rows, applied to the badge itself.
  const isTodayFlat = Math.abs(toDisp(summary.todayGain)) < 0.005;
  const gainColor = isGain ? colors.green : colors.red;
  const todayColor = isTodayFlat ? colors.mutedForeground : (isTodayGain ? colors.green : colors.red);
  const hasHoldings = holdings.length > 0;
  // Real prices AND holdings both loaded — only once this is true does the
  // hero mount PortfolioHeroValue (see its own comment for why the mount
  // timing, not just a visual swap, is what avoids the wrong-number flash).
  const heroReady = !pricesArePlaceholder && !(holdingsLoading && holdings.length === 0);

  // Deliberately stricter than heroReady. Cached prices are enough to show a
  // true total (a spot price doesn't expire), but not today's move — those
  // deltas are relative to today's open and are zeroed on rehydration, so
  // rendering them would assert a flat day and then correct itself.
  const todaysChangeKnown = !pricesArePlaceholder && !prices?.changesUnknown;
  // Ambient wash tinted by today's direction, so the day can be read from
  // the card's colour before any figure is. Only when today's change is
  // actually known — a wash on placeholder data would assert a direction
  // the app hasn't established.
  const todayTint = !todaysChangeKnown || summary.todayGain === 0
    ? null
    : summary.todayGain > 0 ? colors.green : colors.red;
  const { sweep: milestoneSweep, active: milestoneActive } = useMilestoneSweep(summary.totalValue, user?.id);

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
      {/* ── Sticky Header — always visible while scrolling ─────── */}
      <View style={[styles.stickyHeader, { paddingTop: topPad + 16 }]}>
        {/* Profile avatar. Below Core, tapping it opens the Tiers explainer
            instead of Settings — a motivational "here's what you're working
            toward" moment rather than a dead end. Once any tier is actually
            held, a seal pins to its corner and the tap instead opens that
            tier's own membership card. */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => (tier ? setShowTierCard(true) : router.push({ pathname: '/tiers', params: { netWorthEgp: String(netWorthEgp) } } as any))}
        >
          <View>
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary + '22' }]}>
                <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                  {firstName ? firstName[0].toUpperCase() : (user?.primaryEmailAddress?.emailAddress?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            {!!tier && (
              <View style={styles.tierSealPin} pointerEvents="none">
                <TierSeal size={20} tier={tier.id} />
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Two-line greeting — the tier pill that used to live here moved
            into the ring around the avatar and the card it opens. A ring
            that's always visible, ambient, and ties to something already on
            screen beats one more labelled pill next to the name. */}
        <View style={styles.greetingBlock}>
          <Text style={[styles.greetingHi, { color: colors.mutedForeground }]}>
            {(() => { const h = new Date().getHours(); return h < 12 ? t.greetingMorning : h < 18 ? t.greetingAfternoon : t.greetingEvening; })()}
          </Text>
          <View style={styles.greetingNameRow}>
            <Text style={[styles.greetingName, { color: colors.text }]} numberOfLines={1}>
              {firstName || t.thereGreeting}
            </Text>
          </View>
        </View>

        {/* Right: live chip + bell */}
        <View style={styles.headerRight}>
          <LiveChip lastUpdated={prices?.lastUpdated ?? null} />
          <TouchableOpacity
            style={[styles.bellBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
            onPress={() => router.push('/notifications' as any)}
          >
            <Feather name="bell" size={16} color={colors.text} />
            {unreadNotifications > 0 && (
              <View style={[styles.bellBadge, { backgroundColor: colors.red, borderColor: colors.background }]} />
            )}
          </TouchableOpacity>
        </View>
      </View>

    <ScrollView
      style={[styles.scrollTransparent, { flex: 1 }]}
      contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
      // Frozen while dragging along the performance chart, otherwise the
      // ScrollView wins the responder negotiation and the page scrolls away
      // under the finger instead of the chart tracking it.
      scrollEnabled={!chartScrubbing}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      {/* ── Portfolio label ─────────────────────────────────────── */}
      <View style={styles.titleRow}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>{t.portfolio}</Text>
      </View>

      {/* Each renders nothing once dismissed/inapplicable, so this costs no
          layout beyond the first read — order matters only while both are
          visible at once (a first-ever launch could show both): an update
          nudge first (acts on the app itself), then the low-friction
          competition ask. */}
      <UpdateAvailableBanner />
      <CompetitionInviteBanner />

      {/* ── Hero Card ───────────────────────────────────────────── */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ExpoLinearGradient
          colors={[colors.primary + '00', colors.primary + 'CC', colors.primary + '00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroAccent}
        />
        {/* Sits under the content and above the card fill, fading out well
            before the figures so it never tints the text it sits behind. */}
        {todayTint && (
          <ExpoLinearGradient
            pointerEvents="none"
            colors={[todayTint + '1F', todayTint + '00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroPerfWash}
          />
        )}
        {milestoneActive && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.heroSweep,
              {
                transform: [{
                  translateX: milestoneSweep.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-140, 460],
                  }),
                }, { rotate: '18deg' }],
              },
            ]}
          >
            <ExpoLinearGradient
              colors={[colors.primary + '00', colors.primary + '4D', colors.primary + '00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        {/* A real network failure is covered by the full-screen
            NoNetworkOverlay mounted in (tabs)/_layout.tsx, so nothing is
            rendered here for it — the important part is simply never showing
            a total computed from fabricated prices. The skeleton covers the
            ordinary "still loading" case; PortfolioHeroValue only mounts once
            heroReady is true either way. */}
        {pricesErrored ? null : !heroReady ? (
          <HeroSkeleton />
        ) : (
        <View style={styles.heroBody}>
          {/* Label */}
          <View style={styles.heroLabelRow}>
            <Text style={[styles.heroLabel, heroEyebrow(language), { color: colors.mutedForeground, textAlign: 'center' }]}>
              {t.totalPortfolioValue}
            </Text>
          </View>

          {/* Big value + currency pill */}
          <View style={styles.heroValueRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { impact(); setHideValues(!hideValues); }}
              accessibilityRole="button"
              accessibilityLabel={hideValues ? 'Show portfolio values' : 'Hide portfolio values'}
              style={{ flexShrink: 1 }}
            >
              <PortfolioHeroValue value={toDisp(summary.totalValue)} hidden={hideValues} />
            </TouchableOpacity>
            <Pressable
              onPress={() => { impact(); setShowCurrencyPicker(v => !v); }}
              style={({ pressed }) => [
                styles.currencyPill,
                { backgroundColor: colors.muted + '90', borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Display currency: ${displayCurrency}. Tap to change`}
            >
              <Text style={[styles.currencyPillText, { color: colors.mutedForeground }]}>
                {displayCurrency} {showCurrencyPicker ? '▴' : '▾'}
              </Text>
            </Pressable>
          </View>

          {/* Inline currency tab strip — expands on pill tap */}
          {showCurrencyPicker && (
            <View style={styles.currencyTabStrip}>
              {DISP_CURRENCIES.map(c => {
                const active = c === displayCurrency;
                return (
                  <Pressable
                    key={c}
                    onPress={() => { impact(); setDisplayCurrency(c); setShowCurrencyPicker(false); }}
                    style={[
                      styles.currencyTab,
                      {
                        backgroundColor: active ? colors.primary : colors.muted + '60',
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[
                      styles.currencyTabText,
                      { color: active ? colors.primaryForeground : colors.mutedForeground },
                    ]}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Net worth (investments + cash) — additive row, only when user has cash accounts */}
          {cashTotalEGP > 0 && (
            <View style={styles.netWorthRow}>
              <Feather name="plus-circle" size={10} color={colors.mutedForeground + '88'} />
              <Text style={[styles.netWorthTxt, { color: colors.mutedForeground }]}>
                {hideValues
                  ? `${t.netWorthLabel}: ••••••`
                  : `${t.netWorthLabel}: ${fmtCompact(toDisp(summary.totalValue + cashTotalEGP))} ${displayCurrency}`}
              </Text>
            </View>
          )}

          {/* Invested · Current · Return strip */}
          {summary.totalCost > 0 && (
            <View style={[styles.iStrip, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
              <View style={styles.iCell}>
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>{t.invested}</Text>
                <View style={styles.iCellValueRow}>
                  <Text style={[styles.iCellValue, { color: colors.text }]}>{hideValues ? '••••' : fmtCompact(toDisp(summary.totalCost))}</Text>
                  {!hideValues && <Text style={[styles.iCellCur, { color: colors.mutedForeground }]}>{displayCurrency}</Text>}
                </View>
              </View>
              <View style={[styles.iDivider, { backgroundColor: colors.border }]} />
              <View style={styles.iCell}>
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>{t.currentLabel}</Text>
                <View style={styles.iCellValueRow}>
                  <Text style={[styles.iCellValue, { color: colors.text }]}>{hideValues ? '••••' : fmtCompact(toDisp(summary.totalValue))}</Text>
                  {!hideValues && <Text style={[styles.iCellCur, { color: colors.mutedForeground }]}>{displayCurrency}</Text>}
                </View>
              </View>
              <View style={[styles.iDivider, { backgroundColor: colors.border }]} />
              <Pressable
                style={styles.iCell}
                onPress={() => showModal(t.returnCalcTitle, t.returnCalcBody)}
              >
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>{t.returnLabel}</Text>
                <View style={styles.iCellValueRow}>
                  <Text style={[styles.iCellValue, { color: gainColor }]}>
                    {`${isGain ? '+' : ''}${summary.gainPct.toFixed(1)}%`}
                  </Text>
                  <Text style={[styles.iCellCur, { color: gainColor + 'AA' }]}>
                    {isGain ? '▲' : '▼'}
                  </Text>
                  <Feather name="info" size={10} color={colors.mutedForeground + '99'} />
                </View>
              </Pressable>
            </View>
          )}

          {/* P/L row */}
          {summary.totalCost > 0 && (
            <View style={styles.plRow}>
              {!todaysChangeKnown ? (
                // Today's move isn't known yet — show a neutral loading state
                // rather than a coloured "+0.00%", which reads as "flat today"
                // and then visibly corrects itself once the real figure lands.
                //
                // Two ways to get here: placeholder data (nothing fetched
                // yet), or prices rehydrated from the on-disk cache, whose
                // *Change fields describe an earlier moment and are zeroed on
                // load. The total above still renders from those cached spot
                // prices — a spot price stays valid, a daily delta does not.
                //
                // Deliberately not a spinner. This resolves in roughly half a
                // second, and an ActivityIndicator pulled the eye straight to
                // the one tile that wasn't ready at the moment every other
                // number had already appeared. A dimmed dash says "not yet"
                // without competing for attention.
                <View style={[styles.plChip, { backgroundColor: colors.muted + '22', borderColor: colors.border }]}>
                  <View style={styles.plTop}>
                    <Feather name="clock" size={10} color={colors.mutedForeground + '99'} />
                    <Text style={[styles.plLabel, { color: colors.mutedForeground }]}>{t.todayLabel}</Text>
                  </View>
                  <Text style={[styles.plValue, { color: colors.mutedForeground + '88' }]}>—</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => { impact(); setShowTodayBreakdown(true); }}
                  style={[styles.plChip, { backgroundColor: todayColor + '0D', borderColor: todayColor + '20' }]}
                >
                  <View style={styles.plTop}>
                    <Feather name={isTodayFlat ? 'minus' : isTodayGain ? 'trending-up' : 'trending-down'} size={10} color={todayColor + 'CC'} />
                    <Text style={[styles.plLabel, { color: colors.mutedForeground }]}>{t.todayLabel}</Text>
                    <View style={[styles.plBadge, { backgroundColor: todayColor + '1A' }]}>
                      <Text style={[styles.plBadgeText, { color: todayColor }]}>
                        {`${!isTodayFlat && isTodayGain ? '+' : ''}${summary.todayPct.toFixed(2)}%`}
                      </Text>
                    </View>
                    <Feather name="info" size={10} color={colors.mutedForeground + '99'} />
                  </View>
                  <Text style={[styles.plValue, { color: todayColor }]}>
                    {hideValues ? '••••' : isTodayFlat ? `0 ${displayCurrency}` : `${isTodayGain ? '+' : '−'}${fmtCompact(Math.abs(toDisp(summary.todayGain)))} ${displayCurrency}`}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => showModal(t.totalPLCalcTitle, t.totalPLCalcBody)}
                style={[styles.plChip, { backgroundColor: gainColor + '0D', borderColor: gainColor + '20' }]}
              >
                <View style={styles.plTop}>
                  <Feather name={isGain ? 'trending-up' : 'trending-down'} size={10} color={gainColor + 'CC'} />
                  <Text style={[styles.plLabel, { color: colors.mutedForeground }]}>{t.totalPL}</Text>
                  <View style={[styles.plBadge, { backgroundColor: gainColor + '1A' }]}>
                    <Text style={[styles.plBadgeText, { color: gainColor }]}>
                      {`${isGain ? '+' : ''}${summary.gainPct.toFixed(2)}%`}
                    </Text>
                  </View>
                  <Feather name="info" size={10} color={colors.mutedForeground + '99'} />
                </View>
                <Text style={[styles.plValue, { color: gainColor }]}>
                  {hideValues ? '••••' : `${isGain ? '+' : '−'}${fmtCompact(Math.abs(toDisp(summary.gain)))} ${displayCurrency}`}
                </Text>
              </Pressable>
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
                {/* todayValues: startOfDayValue is totalValue - todayGain,
                    so when the deltas aren't known todayGain is 0 and both
                    endpoints collapse onto the same number — the 1D curve
                    draws perfectly flat, then jumps to its real shape once
                    live prices land. An empty series lets PerfChart show its
                    own "building" placeholder instead, matching how the Today
                    tile waits rather than asserting a flat day. */}
                <PerfChart
                  period={timeFilter}
                  width={sparkWidth}
                  height={78}
                  snapshots={snapshots}
                  todayValues={todaysChangeKnown ? todaySamples : []}
                  liveValue={summary.totalValue}
                  allTimeValues={[summary.totalCost, summary.totalValue]}
                  interactive
                  formatScrubValue={v =>
                    hideValues ? '••••' : `${fmtCompact(toDisp(v))} ${displayCurrency}`
                  }
                  onScrubChange={setChartScrubbing}
                />
              </View>

              {/* Time filters */}
              <View style={styles.timeRow}>
                {CHART_PERIODS.map(f => {
                  const active = f === timeFilter;
                  const available = isPeriodAvailable(f, coverage);
                  return (
                    <Pressable
                      key={f}
                      disabled={!available}
                      style={({ pressed }) => [
                        styles.timePill,
                        {
                          backgroundColor: active ? colors.primary : colors.muted + '90',
                          borderColor: active ? colors.primary : 'transparent',
                          opacity: !available ? 0.35 : pressed ? 0.7 : 1,
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

              {/* Only on periods this actually constrains — see
                  periodLimitedByHistory. It used to show whenever *any*
                  period was gated, which meant it sat under 1D too, where
                  it's not just noise but misleading: 1D is live intraday
                  data and doesn't touch snapshot history, so a date months
                  back implies the day's line starts there. */}
              {!!coverage.earliestDate && periodLimitedByHistory(timeFilter, coverage) && (
                <Text style={[styles.trackingSince, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {t.chartTrackingSince(
                    new Date(coverage.earliestDate).toLocaleDateString(
                      language === 'ar' ? 'ar-EG' : 'en-EG',
                      { day: 'numeric', month: 'short', year: 'numeric' },
                    ),
                  )}
                </Text>
              )}
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
                  icon: 'bar-chart-2', quantity: summary.stockCount > 0 ? `${summary.stockCount} stock${summary.stockCount !== 1 ? 's' : ''}` : undefined,
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

      {/* ── Cash Card ─────────────────────────────────────────────
           Always visible. When no accounts exist, shows a quiet empty
           state that taps into the Cash Accounts screen to add one. */}
      <TouchableOpacity
        style={[styles.cashCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push('/cash-accounts' as any)}
        activeOpacity={0.85}
      >
        <View style={[styles.cashIconWrap, { backgroundColor: colors.green + '1A' }]}>
          <BanknoteIcon size={20} color={colors.green} />
        </View>
        {/* One row per currency held — the same treatment whether there is
            one or several, so the card doesn't change shape as a second
            currency appears. Every row carries identical weight: same size,
            same colour, its own currency label, amount aligned to a shared
            right edge. Below the native rows, a single muted line converts
            the whole total into the portfolio card's selected display
            currency — same toDisp() conversion used everywhere else on this
            screen — so switching that selector visibly reaches cash too,
            without hiding what each account is actually held in. */}
        <View style={styles.cashInfo}>
          <Text style={[styles.cashLabel, { color: colors.mutedForeground }]}>{t.cash}</Text>
          {cashAccounts.length === 0 ? (
            <Text style={[styles.cashValue, { color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' }]}>
              {t.noCashAccountsYet}
            </Text>
          ) : cashByCurrency.length === 1 ? (
            // Only one currency held — there's nothing to total, so it's
            // just shown converted directly instead of alongside a
            // redundant "Total" line repeating the same single number.
            <View style={styles.cashRows}>
              <View style={styles.cashRow}>
                <Text style={[styles.cashRowValue, styles.cashRowValueSolo, { color: colors.text }]} numberOfLines={1}>
                  {hideValues ? '••••••' : cashTotalDispText}
                </Text>
                <Text style={[styles.cashRowCur, { color: colors.textSecondary }]}>{displayCurrency}</Text>
                {!hideValues && !!cashTodayEGP && (() => {
                  const delta = toDisp(cashTodayEGP);
                  const up = delta > 0;
                  const c = up ? colors.green : colors.red;
                  return (
                    <View style={[styles.cashTodayBadge, { backgroundColor: c + '18' }]}>
                      <Feather name={up ? 'arrow-up' : 'arrow-down'} size={9} color={c} />
                      <Text style={[styles.cashTodayBadgeText, { color: c }]} numberOfLines={1}>
                        {t.todayChangeBadge(`${up ? '+' : '−'}${fmtCompact(Math.abs(delta))}`)}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            </View>
          ) : (
            <View style={styles.cashRows}>
              {cashByCurrency.slice(0, CASH_CURRENCY_CELLS).map(([cur, amt], i) => (
                <React.Fragment key={cur}>
                  {i > 0 && <View style={[styles.cashRowSep, { backgroundColor: colors.border }]} />}
                <View style={styles.cashRow}>
                  <Text
                    style={[
                      styles.cashRowValue,
                      { color: colors.text, minWidth: cashAmountWidth },
                    ]}
                    numberOfLines={1}
                  >
                    {hideValues ? '••••••' : fmtCompact(amt)}
                  </Text>
                  <Text style={[styles.cashRowCur, { color: colors.textSecondary }]}>{cur}</Text>
                  {/* Same row as the amount — badge shape matches
                      HoldingCard's gainPill (icon, 7/3 padding, 11px text),
                      but this one stays inline next to the currency code
                      rather than on its own line below. Minus the currency
                      code — the text right before it already names it.
                      Hidden along with the balances when values are masked:
                      a visible delta would leak the very movement the mask
                      exists to hide. */}
                  {!hideValues && !!cashTodayByCurrency.get(cur) && (() => {
                    const delta = cashTodayByCurrency.get(cur) as number;
                    const up = delta > 0;
                    const c = up ? colors.green : colors.red;
                    return (
                      <View style={[styles.cashTodayBadge, { backgroundColor: c + '18' }]}>
                        <Feather name={up ? 'arrow-up' : 'arrow-down'} size={9} color={c} />
                        <Text style={[styles.cashTodayBadgeText, { color: c }]} numberOfLines={1}>
                          {t.todayChangeBadge(`${up ? '+' : '−'}${fmtCompact(Math.abs(delta))}`)}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                </React.Fragment>
              ))}
              {cashByCurrency.length > CASH_CURRENCY_CELLS && (
                <Text style={[styles.cashRowCur, { color: colors.mutedForeground, fontSize: 11 }]} numberOfLines={1}>
                  {t.cashMoreCurrencies(cashByCurrency.length - CASH_CURRENCY_CELLS)}
                </Text>
              )}
              {!hideValues && (
                <>
                  <View style={[styles.cashRowSep, { backgroundColor: colors.border }]} />
                  <View style={styles.cashTotalRow}>
                    <Text style={[styles.cashTotalLabel, { color: colors.mutedForeground }]}>
                      {t.cashConvertedTotalLabel}
                    </Text>
                    <Text style={[styles.cashTotalValue, { color: colors.textSecondary }]} numberOfLines={1}>
                      {`${cashTotalDispText} ${displayCurrency}`}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
        <Feather name={forwardChevron()} size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* ── Goals row ──────────────────────────────────────────────
           A slim single line, not a card — the ring(s) carry the visual
           weight. Only shown when goals exist; a single goal gets one ring,
           more than one gets an overlapping cluster (up to 3, nearest
           deadline first) plus an average across all of them. Placed right
           after Cash because a goal's "saved" figure is often literally a
           linked cash account's own balance. */}
      {goalsSummary && (
        <TouchableOpacity
          style={styles.goalsRow}
          onPress={() => router.push('/goals' as any)}
          activeOpacity={0.7}
        >
          {goalsSummary.single ? (
            <>
              <GoalRing
                size={34} strokeWidth={3.5}
                pct={goalsSummary.single.pct}
                color={colors.green}
                fillColor={colors.primary}
                trackColor={colors.border}
                done={goalsSummary.single.done}
              />
              <View style={styles.goalsInfo}>
                <Text style={[styles.goalsTitle, { color: colors.text }]} numberOfLines={1}>
                  {goalsSummary.single.goal.name}
                </Text>
                <Text style={styles.goalsSub} numberOfLines={1}>
                  {hideValues ? (
                    <Text style={{ color: colors.mutedForeground }}>••••••</Text>
                  ) : (
                    <>
                      <Text style={{ color: colors.mutedForeground }}>
                        {t.overviewGoalPctSaved(String(Math.round(goalsSummary.single.pct)))}
                      </Text>
                      <Text style={{ color: goalsSummary.single.done ? colors.green : colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                        {t.overviewGoalAmount(
                          goalsSummary.single.saved.toLocaleString('en-EG', { maximumFractionDigits: 0 }),
                          goalsSummary.single.goal.targetAmount.toLocaleString('en-EG', { maximumFractionDigits: 0 }),
                        )}
                      </Text>
                    </>
                  )}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.goalRingCluster}>
                {goalsSummary.sorted.slice(0, 3).map((g, i) => (
                  <View key={g.goal.id} style={i > 0 ? { marginLeft: -10 } : undefined}>
                    <GoalRing
                      size={34} strokeWidth={3.5}
                      pct={g.pct}
                      color={g.done ? colors.green : GOAL_RING_COLORS[i % GOAL_RING_COLORS.length]}
                      trackColor={colors.border}
                      done={g.done}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.goalsInfo}>
                <Text style={[styles.goalsTitle, { color: colors.text }]} numberOfLines={1}>
                  {t.overviewGoalClusterTitle(String(goalsSummary.count))}
                </Text>
                <Text style={styles.goalsSub} numberOfLines={1}>
                  {hideValues ? (
                    <Text style={{ color: colors.mutedForeground }}>••••••</Text>
                  ) : (
                    <>
                      <Text style={{ color: colors.mutedForeground }}>
                        {t.overviewGoalPctSavedAvg(String(Math.round(goalsSummary.avgPct)))}
                      </Text>
                      <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                        {t.overviewGoalAmount(
                          goalsSummary.totalSaved.toLocaleString('en-EG', { maximumFractionDigits: 0 }),
                          goalsSummary.totalTarget.toLocaleString('en-EG', { maximumFractionDigits: 0 }),
                        )}
                      </Text>
                    </>
                  )}
                </Text>
              </View>
            </>
          )}
          <Feather name={forwardChevron()} size={18} color={colors.mutedForeground} />
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
                <Text style={[styles.manageTxt, { color: colors.primary }]}>{t.manageBtnLabel}</Text>
                <Feather name={forwardChevron()} size={12} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {holdingsLoading && holdings.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, justifyContent: 'center' }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptySub, { color: colors.mutedForeground, marginTop: 12 }]}>{t.loadingInvestments}</Text>
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
                  {t.seeAllInvestmentsCount(String(holdings.length))}
                </Text>
                <Feather name={forwardArrow()} size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>

    <TodayBreakdownModal
      visible={showTodayBreakdown}
      onClose={() => setShowTodayBreakdown(false)}
      rows={todayBreakdown}
      totalAmount={summary.todayGain}
      totalPct={summary.todayPct}
      hasExcludedAssets={summary.reV > 0 || summary.paV > 0}
      hideValues={hideValues}
      toDisp={toDisp}
      displayCurrency={displayCurrency}
    />

    {modal && (
      <DetailModal
        visible
        title={modal.title}
        content={modal.content}
        onClose={() => setModal(null)}
      />
    )}

    {/* Fires once per real tier change, in both directions. On a demotion it
        also carries what it takes to get back — computed from the tier they
        just left, not the one they landed in.
        tierChange.from is typed nullable (it's null on a first-ever Core
        unlock) but can't actually be null here: !promoted only happens when
        `from` outranks `to`, and outranking requires `from` to exist — the
        ?. is defensive, not expected to ever take the fallback. */}
    <TierCelebration
      change={tierChange}
      onDismiss={() => {
        // A tier promotion is the most genuinely positive moment this app
        // has — ask here, not after any other action, and never on a
        // demotion (maybeRequestReview also self-limits to once ever).
        if (tierChange?.promoted) void maybeRequestReview();
        clearTierChange();
      }}
      returnHint={
        tierChange && !tierChange.promoted && tierChange.from
          ? t.tierLostHint(
              `${fmtCompact(toDisp(Math.max(0, tierChange.from.minEgp - netWorthEgp)))} ${displayCurrency}`,
            )
          : undefined
      }
    />

    {/* The membership-card view opened from tapping the ringed avatar. */}
    {/* Only ever mounted with a real tier — the avatar's onPress only sets
        showTierCard when `tier` is already truthy, and this guard covers
        the edge case of net worth changing between that tap and this
        render. TierCard itself takes a non-nullable `tier` on purpose:
        there's no "not yet a tier" card to show. */}
    {!!tier && (
      <TierCard
        visible={showTierCard}
        onClose={() => setShowTierCard(false)}
        tier={tier}
        since={tierSince}
      />
    )}
    </View>
  );
}

// ─── Today breakdown modal ──────────────────────────────────────────────────────
// Answers "why is today up/down X%" with the actual per-category numbers
// that sum to it, instead of leaving the badge as one opaque figure.

interface TodayBreakdownRow {
  key: string; label: string; color: string; icon: React.ReactNode; amount: number; pct: number | null;
}

function TodayBreakdownModal({
  visible, onClose, rows, totalAmount, totalPct, hasExcludedAssets, hideValues, toDisp, displayCurrency,
}: {
  visible: boolean; onClose: () => void; rows: TodayBreakdownRow[];
  totalAmount: number; totalPct: number; hasExcludedAssets: boolean;
  hideValues: boolean; toDisp: (egp: number) => number; displayCurrency: DisplayCurrency;
}) {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const isFlatTotal = Math.abs(toDisp(totalAmount)) < 0.005;
  const isGain = totalAmount >= 0;
  const totalColor = isFlatTotal ? colors.mutedForeground : (isGain ? colors.green : colors.red);
  // Every category present is individually flat — rather than list five
  // zero rows, say plainly that nothing has moved rather than let a wall
  // of "0 EGP" read as broken or still loading.
  const allFlat = rows.length > 0 && rows.every(r => Math.abs(toDisp(r.amount)) < 0.005);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={tb.backdrop} onPress={onClose} />
      <View style={[tb.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
        <View style={[tb.handle, { backgroundColor: colors.border }]} />
        <View style={tb.header}>
          <View>
            <Text style={[tb.title, { color: colors.text }]}>{t.todayBreakdownTitle}</Text>
            <Text style={[tb.subtitle, { color: totalColor }]}>
              {hideValues ? '••••' : isFlatTotal ? `0 ${displayCurrency}` : `${isGain ? '+' : '−'}${fmtCompact(Math.abs(toDisp(totalAmount)))} ${displayCurrency}`}
              {'  ·  '}{`${!isFlatTotal && isGain ? '+' : ''}${totalPct.toFixed(2)}%`}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[tb.close, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {rows.length === 0 ? (
          <Text style={[tb.emptyText, { color: colors.mutedForeground }]}>{t.todayBreakdownEmpty}</Text>
        ) : allFlat ? (
          <View style={tb.noChangeWrap}>
            <View style={[tb.noChangeIcon, { backgroundColor: colors.muted }]}>
              <Feather name="moon" size={22} color={colors.mutedForeground} />
            </View>
            <Text style={[tb.noChangeTitle, { color: colors.text }]}>{t.todayNoChangeTitle}</Text>
            <Text style={[tb.noChangeHint, { color: colors.mutedForeground }]}>{t.todayNoChangeHint}</Text>
          </View>
        ) : (
          <View style={tb.list}>
            {rows.map(r => {
              // Sub-cent amounts round to "0 EGP" either way — treat them as
              // flat rather than as a gain, or a genuinely unmoved row (like
              // gold on a day only the currency moved) shows up green as if
              // it had gone up.
              const isFlat = Math.abs(toDisp(r.amount)) < 0.005;
              const rowGain = r.amount >= 0;
              const rowColor = isFlat ? colors.mutedForeground : (rowGain ? colors.green : colors.red);
              return (
                <View key={r.key} style={tb.row}>
                  <View style={[tb.iconBox, { backgroundColor: r.color + '1A' }]}>{r.icon}</View>
                  <View style={tb.rowBody}>
                    <Text style={[tb.rowLabel, { color: colors.text }]}>{r.label}</Text>
                    {r.key === 'fixedIncome' ? (
                      <Text style={[tb.rowSub, { color: colors.mutedForeground }]}>{t.interestAccruedToday}</Text>
                    ) : r.pct !== null ? (
                      <Text style={[tb.rowSub, { color: colors.mutedForeground }]}>
                        {`${!isFlat && r.pct >= 0 ? '+' : ''}${r.pct.toFixed(2)}%`}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[tb.rowAmount, { color: rowColor }]}>
                    {hideValues ? '••••' : isFlat ? `0 ${displayCurrency}` : `${rowGain ? '+' : '−'}${fmtCompact(Math.abs(toDisp(r.amount)))} ${displayCurrency}`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {hasExcludedAssets && (
          <Text style={[tb.footnote, { color: colors.mutedForeground }]}>{t.todayBreakdownExcludedNote}</Text>
        )}
      </View>
    </Modal>
  );
}
const tb = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  rowSub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  rowAmount: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 20 },
  noChangeWrap: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  noChangeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  noChangeTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  noChangeHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
  footnote: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16, marginTop: 18 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1 },
  scrollTransparent: { flex: 1, backgroundColor: 'transparent' },
  content:          { paddingHorizontal: 20, gap: 20 },

  stickyHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 10 },
  avatar:          { width: 36, height: 36, borderRadius: 18 },
  avatarFallback:  { alignItems: 'center', justifyContent: 'center' },
  avatarInitial:   { fontSize: 14, fontFamily: 'Inter_700Bold' },
  // Pinned at the avatar's bottom-right, like a wax seal stamped on a
  // corner — not wrapping the avatar the way a progress ring would.
  tierSealPin:     { position: 'absolute', right: -5, bottom: -5 },
  greetingBlock:   { flex: 1, gap: 1, minWidth: 0 },
  greetingHi:      { fontSize: 11, fontFamily: 'Inter_400Regular' },
  greetingNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  greetingName:    { fontSize: 15, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  headerRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn:         { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  bellBadge:       { position: 'absolute', top: 3, end: 3, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  screenTitle:   { fontSize: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },

  heroCard:   { borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  heroAccent: { height: 1.25 },
  // Tall enough to colour the card's upper region, short enough that it has
  // faded to nothing behind the value itself.
  heroPerfWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 130 },
  // A narrow angled band swept across the card once on a milestone.
  heroSweep: { position: 'absolute', top: -40, bottom: -40, width: 90 },
  heroBody:   { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24, gap: 16, alignItems: 'stretch' },

  cashCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  cashIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cashInfo: { flex: 1, gap: 2 },
  cashLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  cashValue: { fontSize: 19, fontFamily: 'Inter_700Bold', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  cashRows:      { gap: 7, marginTop: 3 },
  // A View with a backgroundColor, matching how the portfolio card's own
  // iDivider is drawn — a borderTopWidth hairline renders sub-pixel here and
  // effectively disappears against the card, which is why the first attempt
  // at this separator was invisible.
  cashRowSep:    { height: StyleSheet.hairlineWidth },
  cashRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // No chip: it was added to stand in for a separator, and once the real
  // separator was drawn properly the box only boxed the code in at 10px
  // against a barely-contrasting fill. Plain text at a readable size on
  // textSecondary (#B8B8BC) rather than mutedForeground (#8E8E93) is
  // legible on its own.
  cashRowCur:    { fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  // List size: several balances are peers, and holding them here keeps a
  // multi-currency card compact. Equal weight matters *within* that list —
  // it never required a lone balance to shrink to match a list it isn't
  // part of, which is what cashRowValueSolo restores.
  cashRowValue:  { flexShrink: 1, fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.35, fontVariant: ['tabular-nums'] },
  // Matches HoldingCard's gainPill/gainText exactly (icon, 7/3 padding,
  // radius 7, 11px text) — see the comment at the call site for why.
  cashTodayBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, flexShrink: 1,
    // marginStart auto eats the leftover space between the currency code and
    // the badge, pushing only the badge to the row's right edge. The amount
    // and currency stay exactly where they've always been — nothing else
    // about the row changes.
    marginStart: 'auto',
  },
  cashTodayBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  // A single balance is the card's headline, not a list item, so it keeps
  // the display size this card always used.
  cashRowValueSolo: { fontSize: 19, letterSpacing: -0.4 },
  // Labeled summary row beneath the native-currency rows and their
  // separator — reads as a real "Total" line (like the card's own rows do)
  // rather than a bare parenthetical, while staying visually lighter than
  // them: smaller label, secondary-not-primary text colour.
  cashTotalRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  cashTotalLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  cashTotalValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] },

  goalsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 16, paddingBottom: 16, paddingHorizontal: 18 },
  goalRingCluster: { flexDirection: 'row' },
  goalsInfo: { flex: 1, gap: 2, minWidth: 0 },
  goalsTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  goalsSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  heroLabelRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroLabel:      { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
  heroValueRow:   { flexDirection: 'row', alignItems: 'center', gap: 9, justifyContent: 'center', alignSelf: 'stretch', marginTop: -4 },
  // tabular-nums keeps every digit the same width. The value is an animated
  // counter, so proportional digits made the number visibly shimmy as it
  // tweened — 1s are narrow, 0s wide — and the whole line re-centred on each
  // frame. -1.6 rather than -2: at 46px the tighter tracking was starting to
  // close up the gap around the thousands separators.
  heroValue:      { fontSize: 46, fontFamily: 'Inter_700Bold', letterSpacing: -1.6, flexShrink: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
  currencyPill:       { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, paddingVertical: 6 },
  currencyPillText:   { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  // Wraps because the switcher is user-configurable now and can hold up to 11
  // currencies; a plain row clipped everything past the fourth.
  currencyTabStrip:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4, marginBottom: 2, paddingHorizontal: 4 },
  currencyTab:        { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 7 },
  currencyTabText:    { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
  netWorthRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  netWorthTxt:    { fontSize: 11.5, fontFamily: 'Inter_500Medium', fontVariant: ['tabular-nums'] },

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
  plValue:        { fontSize: 13.5, fontFamily: 'Inter_700Bold', flexShrink: 1, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  plBadge:        { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  plBadgeText:    { fontSize: 9.5, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },

  chartWrap:  { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  timeRow:    { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 10 },
  timePill:   { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  timePillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  // Deliberately quieter than the pills it explains — a footnote about the
  // data's age, not a control.
  trackingSince: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 7 },

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
