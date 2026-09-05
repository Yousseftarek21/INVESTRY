import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, Alert, Animated, AppState, Image, LayoutChangeEvent, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { forwardChevron, forwardArrow } from '@/utils/rtl';
import { pctDelta } from '@/utils/pctDelta';
import { tradingDayStart } from '@/utils/cairoDate';
import { fmtCompact } from '@/utils/formatNumber';
import { UpdateAvailableBanner } from '@/components/UpdateAvailableBanner';
import { WhatsNewModal } from '@/components/WhatsNewModal';
import { CompetitionInviteBanner } from '@/components/CompetitionInviteBanner';
import { CommunityInviteBanner } from '@/components/CommunityInviteBanner';
import { PerfChart } from '@/components/PerfChart';
import { CHART_PERIODS, ChartPeriod, getHistoryCoverage, isPeriodAvailable, periodLimitedByHistory } from '@/utils/chartUtils';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { useServerIntraday } from '@/hooks/useServerIntraday';
import { useNotificationHistory } from '@/hooks/useNotificationHistory';
import { useCashAccountsTodayChanges } from '@/hooks/useCashAccountsTodayChanges';
import { usePortfolioTier } from '@/hooks/usePortfolioTier';
import { TierCelebration } from '@/components/TierCelebration';
import { TierSeal } from '@/components/TierSeal';
import { TierCard } from '@/components/TierCard';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router } from 'expo-router';
import { useUser } from '@clerk/expo';
import { BanknoteIcon } from '@/components/BanknoteIcon';
import { AssetIcon, AssetType } from '@/components/AssetIcon';
import { ConceptIcon } from '@/components/ConceptIcon';
import { ICON_BANK_ACCOUNT, ICON_INVESTMENTS, ICON_LOANS, ICON_PENDING_INCOME } from '@/constants/conceptIcons';
import { useColors } from '@/hooks/useColors';
import { useCounterDisplay } from '@/hooks/useCounterDisplay';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useHoldings } from '@/context/HoldingsContext';
import { useCash } from '@/context/CashContext';
import { useRecurringIncome } from '@/context/RecurringIncomeContext';
import { useGoals } from '@/context/GoalsContext';
import { GoalRing } from '@/components/GoalRing';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { pricesAreFresh } from '@/utils/pricesCache';
import { getRECurrentValue } from '@/utils/rePrice';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { useGlobalStocks } from '@/hooks/useGlobalStocks';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAppSettings, DisplayCurrency } from '@/context/AppSettingsContext';
import { AllocationBar } from '@/components/AllocationBar';
import { DetailModal } from '@/components/DetailModal';
import { HoldingCard } from '@/components/HoldingCard';
import { Holding, MarketPrices } from '@/types';
import { computeCashTotalEGP, computePendingIncomeEGP, computeTotalLoanBalanceEGP } from '@/utils/cash';

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
      // utils/textScaling.ts caps every plain Text/TextInput at 1.3x, but
      // its patch only intercepts those two exact component references —
      // Animated.Text (Animated.createAnimatedComponent(Text)) is a
      // different component and slips through uncapped. At an extreme
      // accessibility text size that let this headline number balloon
      // (adjustsFontSizeToFit only shrinks it back down to 50% of that
      // already-huge requested size), consuming most of the row's width
      // and squeezing the currency pill's space to nothing.
      maxFontSizeMultiplier={1.3}
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
  const { cashAccounts, isLoading: cashLoading } = useCash();
  const { recurringIncomes } = useRecurringIncome();
  const { goals } = useGoals();
  const { data: rawPrices, isLoading: pricesLoading, isPlaceholderData: pricesArePlaceholder, isError: pricesErrored, refetch } = useMarketPrices();
  const { data: egxStocks } = useEGXMarket();
  // US stocks merge into the same egxPrices dict (keyed by symbol, no
  // EGX/US collisions in practice) rather than a separate field — every
  // `prices.egxPrices?.[symbol]` lookup below already works purely by
  // symbol, so a US holding gets priced correctly with zero other changes.
  const { data: globalStocks } = useGlobalStocks();
  const prices = useMemo(() => {
    if (!rawPrices) return rawPrices;
    const egxPrices: Record<string, number> = {};
    egxStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
    globalStocks?.forEach(s => { egxPrices[s.ticker] = s.price; });
    return { ...rawPrices, egxPrices };
  }, [rawPrices, egxStocks, globalStocks]);
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
  // Measured width of the currency pill (heroValueRow below) — mirrored as
  // an invisible spacer on the number's other side so the number lands at
  // the row's true center regardless of the pill's own width (which varies
  // by currency code length and accessibility text scale), while the pill
  // itself still sits directly against the number with a fixed small gap
  // instead of floating off toward the card's edge for a short value.
  const [currencyPillWidth, setCurrencyPillWidth] = useState(0);

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
  // Split for the Net Worth breakdown modal only — cashTotalEGP above stays
  // the single lump sum everything else already keys off.
  const cashHomeEGP = useMemo(
    () => computeCashTotalEGP(cashAccounts.filter(a => a.type === 'cash_home'), prices),
    [cashAccounts, prices],
  );
  const bankEGP = useMemo(
    () => computeCashTotalEGP(cashAccounts.filter(a => a.type === 'bank' || a.type === 'foreign_currency'), prices),
    [cashAccounts, prices],
  );
  // Uncollected 'pending' income (money owed to the user, not yet in any
  // account — see Income screen / IncomeKind) counts toward net worth
  // directly, the same way cash does, so it stops being invisible in the
  // one number the user actually cares about.
  const pendingIncomeEGP = useMemo(() => computePendingIncomeEGP(recurringIncomes, prices), [recurringIncomes, prices]);
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
  const { todayChanges: cashTodayByAccount, isLoading: cashTodayLoading } = useCashAccountsTodayChanges();
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
  // Computed once, not inline at the render site — the hero card's Cash
  // cell needs this split across two separate rows (a "Today" label lined
  // up with "CASH", the colored delta lined up with the value below it),
  // so both spots read from the same values instead of duplicating the
  // isFlat/up/color logic.
  const cashTodayInfo = useMemo(() => {
    const delta = toDisp(cashTodayEGP);
    const isFlat = Math.abs(delta) < 0.005;
    const up = delta > 0;
    return {
      isFlat,
      up,
      text: isFlat ? '0' : `${up ? '+' : '−'}${fmtCompact(Math.abs(delta))}`,
    };
  }, [cashTodayEGP, toDisp, fmtCompact]);
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
    // ?? 0 guards: a goal's stored savedAmount (or a linked account's
    // balance) coming back null crashed goalsSummary.single.saved further
    // down at .toLocaleString() — a genuinely unsaved goal is 0 saved, not
    // an absent value this screen can't render.
    if (!g.linkedCashAccountId) return g.savedAmount ?? 0;
    const account = cashAccounts.find(a => a.id === g.linkedCashAccountId);
    return (account ? account.balance : g.savedAmount) ?? 0;
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
  const [showTotalPLBreakdown, setShowTotalPLBreakdown] = useState(false);
  const [showNetWorthBreakdown, setShowNetWorthBreakdown] = useState(false);
  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  const showModal = (title: string, content: string) => { impact(); setModal({ title, content }); };

  // ── Portfolio maths ────────────────────────────────────────────────────────
  const egxChangeByTicker = useMemo(() => {
    const m: Record<string, number> = {};
    egxStocks?.forEach(s => { m[s.ticker] = s.changePercent; });
    globalStocks?.forEach(s => { m[s.ticker] = s.changePercent; });
    return m;
  }, [egxStocks, globalStocks]);

  const summary = useMemo(() => {
    let goldV = 0, silverV = 0, stockV = 0, reV = 0, paV = 0, fiV = 0, totalCost = 0;
    // Per-class cost basis — added for the Total P/L breakdown (see
    // totalPLBreakdown below), which needs each class's own gain, not just
    // its own value. Mirrors analytics.tsx's `sm` useMemo, which already
    // tracks these same six buckets for its own asset breakdown strip.
    let goldCost = 0, silverCost = 0, stockCost = 0, reCost = 0, paCost = 0, fiCost = 0;
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
      // Today's %-change on this screen is a personal, non-competitive
      // display — nobody else sees it or is ranked against it — so it
      // always reflects live market prices, unaffected by any save/edit/add
      // to this holding. There used to be an anti-gaming gate here
      // (excluding, or falling back to a stamped reference price for, any
      // holding "touched" today) to stop bumping grams right as the market
      // moves from faking a gain — but that protection only matters for the
      // competitive Leaderboard, which has its own separate, untouched copy
      // of this logic (computeTodayEligiblePerformance, api-server). Gating
      // it here too caused a real chain of bugs (excluded-at-0%, stale-
      // stamp inflation, freeze-at-0% after any edit) for zero actual
      // benefit, since there's nothing to protect on a personal display.
      if (h.type === 'gold') {
        goldV += v; goldCost += c; goldGrams += h.grams;
        // goldChangePercent is the metal's raw USD move (matches the Markets
        // tab's own display) — goldChangePercentEgp compounds that with
        // today's FX move, which is what a holding valued in EGP (`v`)
        // actually needs, or it can show a gain on a day the EGP value fell.
        todayGold += pctDelta(v, prices?.goldChangePercentEgp ?? 0);
        todayGoldMetal += pctDelta(v, prices?.goldChangePercent ?? 0);
      } else if (h.type === 'silver') {
        silverV += v; silverCost += c; silverGrams += h.grams;
        todaySilver += pctDelta(v, prices?.silverChangePercentEgp ?? 0);
        todaySilverMetal += pctDelta(v, prices?.silverChangePercent ?? 0);
      } else if (h.type === 'stock') {
        stockV += v; stockCost += c; stockCount++;
        const changePercent = egxChangeByTicker[h.symbol] ?? 0;
        todayStock += pctDelta(v, changePercent);
      } else if (h.type === 'personal_asset') {
        paV += v; paCost += c; paCount++;
      } else if (h.type === 'fixed_income') {
        fiV += v; fiCost += c;
        // Accrual since the trading day began, not since 24h ago. A rolling
        // window never resets: right after the boundary it still showed a
        // whole day's interest while every other bucket had just gone to
        // zero, so "Today" could never read flat on a portfolio holding any.
        todayFI += v - fixedIncomeAccruedValue(h, tradingDayStart());
      } else {
        reV += v; reCost += c; reCount++;
      }
    }

    // A loan taken against a fixed_income certificate (LinkedLoan) is money
    // already borrowed and spent — usually on another holding sitting right
    // here in the same portfolio (see computeTotalLoanBalanceEGP's own
    // comment for the double-counting bug this fixes: a 100k certificate +
    // a 90k loan spent on 90k of gold used to read as 190k, not the real
    // ~100k). Subtracting the same totalLoans from both totalValue AND
    // totalCost below — rather than just totalValue — is what keeps
    // gain/gainPct honest instead of introducing a fake loss: the loan
    // cancels out of the absolute gain entirely (borrowing money to buy a
    // holding you already own doesn't itself create or destroy gain), and
    // correctly turns gainPct into a return on the user's own committed
    // capital instead of pretending borrowed money was their own.
    const totalLoans = computeTotalLoanBalanceEGP(holdings);
    // Floored at 0 — total debt exceeding total assets/cost basis should
    // never render as a negative headline figure or cost basis.
    const totalValue = Math.max(0, goldV + silverV + stockV + reV + paV + fiV - totalLoans);
    totalCost = Math.max(0, totalCost - totalLoans);
    const gain = totalValue - totalCost;
    const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    const todayGain = todayGold + todaySilver + todayStock + todayFI;
    // Divide by the start-of-day value, not today's end value — otherwise a
    // day's move is measured against a base that already includes that same
    // move, understating gains and overstating the magnitude of losses.
    const startOfDayValueForPct = totalValue - todayGain;
    const todayPct = startOfDayValueForPct > 0 ? (todayGain / startOfDayValueForPct) * 100 : 0;
    // Loan-adjusted fixed-income bucket, for the allocation bar only — fiV
    // itself stays gross (used above for todayFI's accrual-since-open delta,
    // which is about price/interest movement, not debt, and would be
    // distorted by subtracting a loan that didn't change today).
    const fiVNetOfLoans = Math.max(0, fiV - totalLoans);
    // Same netting applied to fiCost — subtracting the identical totalLoans
    // amount from both fiV and fiCost (not just fiV) is what keeps THIS
    // row's own gain honest instead of manufacturing a fake loss on it,
    // exactly the same reasoning as totalValue/totalCost above, just scoped
    // to the one row the loan actually belongs to. Used only by
    // totalPLBreakdown below.
    const fiCostNetOfLoans = Math.max(0, fiCost - totalLoans);

    return {
      totalValue, totalCost, gain, gainPct, todayGain, todayPct, totalLoans,
      goldV, silverV, stockV, reV, paV, fiV, fiVNetOfLoans,
      goldCost, silverCost, stockCost, reCost, paCost, fiCost, fiCostNetOfLoans,
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

  // ── Total P/L breakdown ──────────────────────────────────────────────────────
  // Real user feedback (Ahmed, Feedback & Ideas chat): Today's P/L is
  // tappable and shows exactly this per-class breakdown, but Total P/L —
  // the chip right next to it, styled identically — only opened a plain
  // text explainer of the methodology, no actual numbers. Same shell/rows
  // pattern as todayBreakdown above, just gain-since-purchase (value minus
  // cost) per class instead of today's move, and covering real estate and
  // personal assets too (todayBreakdown deliberately excludes them — they
  // have no daily price feed — but they very much have an all-time gain).
  //
  // Fixed income's row uses fiVNetOfLoans/fiCostNetOfLoans, not fiV/fiCost —
  // the same both-sides loan netting summary.totalValue/totalCost already
  // apply in aggregate (see that comment), scoped to just this row since
  // the loan is specifically a fixed_income concept. Every other row is a
  // plain value-minus-cost, no netting needed. Rows are built to actually
  // sum to summary.gain, matching the header total exactly, same invariant
  // todayBreakdown's rows already hold for summary.todayGain.
  const totalPLBreakdown = useMemo(() => {
    const rows: { key: string; label: string; color: string; icon: React.ReactNode; amount: number; pct: number | null }[] = [];
    const push = (key: string, label: string, color: string, type: AssetType, value: number, cost: number) => {
      if (value <= 0) return; // matches todayBreakdown's own gate (summary.goldV > 0, etc.) — only classes actually held
      const amount = value - cost;
      rows.push({ key, label, color, icon: <AssetIcon type={type} size={16} color={color} />, amount, pct: cost > 0 ? (amount / cost) * 100 : null });
    };
    push('gold', t.gold, colors.primary, 'gold', summary.goldV, summary.goldCost);
    push('silver', t.silver, colors.silverColor, 'silver', summary.silverV, summary.silverCost);
    push('stock', t.egxStocksAllocLabel, '#4A9EFF', 'stock', summary.stockV, summary.stockCost);
    push('realEstate', t.realEstate, '#A47FCA', 'real_estate', summary.reV, summary.reCost);
    push('personalAsset', t.personalAsset, '#E08E45', 'personal_asset', summary.paV, summary.paCost);
    push('fixedIncome', t.fixedIncome, '#22C55E', 'fixed_income', summary.fiVNetOfLoans, summary.fiCostNetOfLoans);
    return rows.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [summary, colors, t]);

  const { snapshots } = usePortfolioSnapshots();
  // A period is only offered once real recorded history reaches back that
  // far — otherwise it can only redraw a shorter period's data, which reads
  // as a duplicate curve. Selecting an unavailable one is blocked, and if
  // the active period becomes unavailable it falls back to 1D.
  const coverage = React.useMemo(() => getHistoryCoverage(snapshots), [snapshots]);
  React.useEffect(() => {
    if (!isPeriodAvailable(timeFilter, coverage)) setTimeFilter('1D');
  }, [coverage, timeFilter]);
  // Tier runs on net worth (investments, net of any linked-loan balances —
  // see summary.totalLoans — + cash) — the same figure rendered as "Net
  // Worth incl. cash" under the hero, so the badge and that number can never
  // disagree. Always EGP, never the display currency: switching to USD must
  // not look like a demotion.
  const netWorthEgp = summary.totalValue + cashTotalEGP + pendingIncomeEGP;
  const { tier, since: tierSince, change: tierChange, clearChange: clearTierChange } = usePortfolioTier(netWorthEgp);
  const [showTierCard, setShowTierCard] = useState(false);

  const startOfDayValue = summary.totalValue - summary.todayGain;
  const { data: serverIntraday, isLoading: serverIntradayLoading } = useServerIntraday();
  // The server cron samples every 5 minutes for everyone regardless of
  // whether the app was ever opened, so it's the single source of truth for
  // 1D texture — never blended with any on-device-only samples, which used
  // to cause the chart to flash one curve shape then swap to another as the
  // two sources settled at different speeds (see git history). Always
  // anchor the chart's start/end to the current live numbers (identical to
  // what drives the "Today" badge above) so the two can never disagree; only
  // the server's middle points fill in real intraday texture.
  const todaySamples = useMemo(() => {
    const middle = serverIntraday && serverIntraday.length > 0 ? serverIntraday.map(p => p.v) : [];
    return [startOfDayValue, ...middle, summary.totalValue];
  }, [serverIntraday, startOfDayValue, summary.totalValue]);

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
  // Cash's own loading is included the same way holdings' is (only block
  // if genuinely empty AND still loading — never hold up an already-
  // populated screen) — CashContext resolves its local AsyncStorage cache
  // almost instantly, well before prices/holdings typically do, so this
  // essentially never adds real wait time; what it does fix is the Cash
  // cell previously being able to render *after* the rest of the hero
  // body had already appeared (the skeleton disappearing before Cash's
  // own local-cache read had resolved), popping in a beat late instead of
  // appearing at the same instant as everything else.
  const heroReady = !pricesArePlaceholder && !(holdingsLoading && holdings.length === 0) && !(cashLoading && cashAccounts.length === 0);

  // Deliberately stricter than heroReady. Cached prices are enough to show a
  // true total (a spot price doesn't expire), but not today's move — those
  // deltas are relative to today's open and are zeroed on rehydration, so
  // rendering them would assert a flat day and then correct itself.
  const todaysChangeKnown = !pricesArePlaceholder && !prices?.changesUnknown;
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
          layout beyond the first read — order matters only while more than
          one is visible at once (a first-ever launch could show all three):
          an update nudge first (acts on the app itself), then the
          low-friction in-app competition ask, then the external Facebook
          community invite last. */}
      <UpdateAvailableBanner />
      <CompetitionInviteBanner />
      <CommunityInviteBanner />
      <WhatsNewModal />

      {/* ── Hero section (no bordered card anymore) ─────────────────
          Content now sits directly on the screen's own background, same
          horizontal inset as the Greeting/Overview title above it — no
          card fill, no border, no rounded corners. The old gain/loss
          today-tint wash (todayTint/heroPerfWash) is replaced by a
          static, always-on gold-toned wash behind just the top section,
          matching the approved no-card mockup. */}
      <View style={styles.heroCard}>
        {/* No wash of its own anymore — the pre-existing "Gradient bloom"
            (rendered once, at the very top of the whole screen, above the
            ScrollView — see its own comment) already covers this section
            from the true top of the page, exactly matching the approved
            mockup's structure (one continuous wash starting behind the
            greeting, not a second one starting mid-screen). Adding
            another gradient here was the actual bug behind every "still
            looks like a card" report tonight: two overlapping washes with
            different start points created a visible seam right at
            heroCard's own top edge, which is exactly where the plain
            black (above) met the second gradient's own top (below). */}
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

          {/* Big value + currency pill.
              Ghost spacer on the left, exactly matching the pill's own
              measured width, then the number, then a fixed 9pt gap, then
              the real pill. This is what actually satisfies both real
              requirements at once, which two earlier attempts tonight
              each traded off against the other:
                - Two independent flex:1 spacers (number+pill each get
                  half the remaining space) centers the number precisely,
                  but at an extreme accessibility text size the number's
                  Animated.Text intrinsic width (see PortfolioHeroValue's
                  own comment — Animated.Text isn't covered by the app-wide
                  font-scale cap) squeezed the pill's flex:1 region to
                  nothing, truncating it to "EG…" regardless of flexShrink
                  props on the pill itself.
                - A single absolutely-positioned pill pinned to the row's
                  right edge can't be squeezed (it's outside flex flow
                  entirely), but then sits a FIXED distance from the card
                  edge no matter the number's width — a short value like
                  "7,121" left a huge, inconsistent gap before it, while a
                  long one like "362,321" happened to sit close.
              Mirroring the pill's real width as an inert spacer on the
              other side keeps the number at the row's true center (the
              two flanks balance out) while the pill still sits right next
              to the number with the same small gap regardless of the
              value's length — and neither the ghost spacer nor the pill
              is a flex:1/flexBasis:0 participant, so neither can be
              squeezed by the number's width the way the first attempt
              was. */}
          <View style={styles.heroValueRow}>
            <View style={{ width: currencyPillWidth }} />
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
              onLayout={(e) => {
                const { width } = e.nativeEvent.layout;
                setCurrencyPillWidth(prev => Math.abs(prev - width) < 0.5 ? prev : width);
              }}
              style={({ pressed }) => [
                styles.currencyPill,
                { flexShrink: 0 },
                {
                  backgroundColor: colors.primary + (showCurrencyPicker ? '22' : '14'),
                  borderColor: colors.primary + '40',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Display currency: ${displayCurrency}. Tap to change`}
            >
              {/* This small control is exempt from Dynamic Type scaling
                  entirely (maxFontSizeMultiplier=1) — same treatment
                  plenty of icon-adjacent controls get; it's a dropdown
                  trigger, not reading content, so it doesn't need to grow
                  with accessibility text size. Also keeps its own measured
                  width (and therefore the ghost spacer above) stable. */}
              <Text style={[styles.currencyPillText, { color: colors.primary }]} maxFontSizeMultiplier={1} numberOfLines={1}>
                {displayCurrency} {showCurrencyPicker ? '▴' : '▾'}
              </Text>
            </Pressable>
          </View>

          {/* Inline currency tab strip — expands on pill tap. Unchanged
              from before on purpose: only the trigger pill above got the
              gold-accent treatment, this list keeps its original look. */}
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

          {/* Net worth (investments + cash + pending income) — additive row,
              only when the user has cash accounts and/or pending income.
              Tappable (real user, Feedback & Ideas chat, asked for exactly
              this — a Thndr-style info tap explaining where the gap between
              this figure and Total Portfolio Value comes from) opens a
              breakdown of cash-at-home vs bank vs pending vs any loans. */}
          {(cashTotalEGP > 0 || pendingIncomeEGP > 0) && (
            <Pressable
              style={styles.netWorthRow}
              onPress={() => { impact(); setShowNetWorthBreakdown(true); }}
              hitSlop={8}
            >
              <Feather name="info" size={10} color={colors.mutedForeground + '88'} />
              <Text style={[styles.netWorthTxt, { color: colors.mutedForeground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {hideValues
                  ? `${t.netWorthLabel}: ••••••`
                  : `${t.netWorthLabel}: ${fmtCompact(toDisp(netWorthEgp))} ${displayCurrency}`}
              </Text>
            </Pressable>
          )}

          {/* ── EXPERIMENTAL (unified hero card, simulator-only) ─────
              Cash + Pending Income, folded in from what used to be their
              own separate cards below — no more scrolling to see them.
              Cash shows only the converted total here (same toDisp/
              fmtCompact math the old Cash card used for its own total
              row); the full per-currency breakdown is still one tap away
              on /cash-accounts, unchanged. Two columns when both exist,
              a single wider row when only one does — same "don't leave a
              bordered slot empty" principle already applied to Goals
              below. Neither renders at all when there's nothing real to
              show, matching how Net Worth/Pending already gate above.
              Both blocks below are wrapped in one View so they're a
              single child of heroBody's own `gap: 16` flex layout — that
              gap was compounding with each block's own margin/padding,
              turning what should've been one tight hairline between them
              into a wide dead zone with a line lost in the middle of it.
              Wrapping them means heroBody's gap only applies outside this
              whole group; the space between Cash/Pending and Goals is
              fully controlled right here instead. */}
          {(cashAccounts.length > 0 || pendingIncomeEGP > 0 || goalsSummary) && (
          <View style={styles.heroExtras}>
          {(cashAccounts.length > 0 || pendingIncomeEGP > 0) && (
            <View style={styles.heroWealthStrip}>
              {cashAccounts.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.heroWealthCell,
                    { paddingStart: 20, paddingEnd: pendingIncomeEGP > 0 ? 18 : 20 },
                    // Option F (tint + border) — additive on top of the
                    // existing strip/divider structure, not a replacement
                    // for it, per instruction. margin:4 insets the tile
                    // slightly within its flex:1 slot so its own border
                    // doesn't sit flush against the strip's outer border
                    // or the divider between the two cells.
                    { backgroundColor: colors.text + '0A', borderWidth: 1, borderColor: colors.text + '14', borderRadius: 14, margin: 4 },
                  ]}
                  onPress={() => { impact(); router.push('/cash-accounts' as any); }}
                  activeOpacity={0.75}
                >
                  {/* Header row: icon + label + Today badge — all short,
                      fixed-length content, so this row can never be the
                      one that overflows. The value gets an entire row to
                      itself below, with nothing beside it competing for
                      width — that's what actually stops a big balance
                      ("400k EGP") plus the Today badge from fighting each
                      other for space and truncating one or the other, the
                      way the old single-row layout could. */}
                  <View style={styles.heroWealthHeaderRow}>
                    <View style={styles.heroWealthLeftGroup}>
                      <View style={[styles.heroWealthChip, { backgroundColor: colors.green + '18' }]}>
                        <BanknoteIcon size={13} color={colors.green} />
                      </View>
                      <Text style={[styles.heroWealthLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{t.cash}</Text>
                    </View>
                    {!hideValues && (
                      cashTodayLoading ? (
                        // Same dimmed-dash convention the Today/Total P/L
                        // chip below already uses while its own data isn't
                        // known yet — reserves this badge's exact layout
                        // space instead of the badge being entirely absent
                        // and then popping in once the network call (this
                        // one has no local cache, unlike the cash total
                        // itself) resolves.
                        <View style={[styles.heroWealthBadge, { backgroundColor: colors.muted + '22' }]}>
                          <Text style={[styles.heroWealthBadgeText, { color: colors.mutedForeground + '88' }]}>—</Text>
                        </View>
                      ) : (
                        <View style={[styles.heroWealthBadge, { backgroundColor: (cashTodayInfo.isFlat ? colors.mutedForeground : cashTodayInfo.up ? colors.green : colors.red) + '18' }]}>
                          <Text style={[styles.heroWealthBadgeText, { color: cashTodayInfo.isFlat ? colors.mutedForeground : cashTodayInfo.up ? colors.green : colors.red }]} numberOfLines={1}>
                            {t.todayChangeBadge(cashTodayInfo.text)}
                          </Text>
                        </View>
                      )
                    )}
                  </View>
                  {/* adjustsFontSizeToFit + minimumFontScale, not a bare
                      numberOfLines={1} — a genuinely huge balance shrinks
                      its own font to keep fitting on one line instead of
                      truncating to "400k E…", the same technique
                      PortfolioHeroValue already uses for the headline
                      number above. */}
                  {/* marginStart:32 = heroWealthChip's own width (26) +
                      heroWealthLeftGroup's gap (6) — starts the value at
                      the same x as the "CASH" label above it, not under
                      the icon. Still spans to the cell's own right edge
                      (no width cap), so adjustsFontSizeToFit above still
                      has the room it needs for a genuinely large value. */}
                  <Text
                    style={[styles.heroWealthValueFull, { color: colors.text, marginStart: 32 }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {hideValues ? '••••••' : (
                      <>
                        {cashTotalDispText}{' '}
                        <Text style={{ color: colors.mutedForeground }}>{displayCurrency}</Text>
                      </>
                    )}
                  </Text>
                </TouchableOpacity>
              )}
              {/* Divider removed — each cell now has its own tint+border
                  (Option F), which already separates them visually; a
                  line between two already-bordered tiles was redundant.
                  Say "revert" to bring this block back verbatim. */}
              {pendingIncomeEGP > 0 && (
                <TouchableOpacity
                  style={[
                    styles.heroWealthCell,
                    { paddingStart: 18, paddingEnd: 20 },
                    { backgroundColor: colors.text + '0A', borderWidth: 1, borderColor: colors.text + '14', borderRadius: 14, margin: 4 },
                  ]}
                  onPress={() => { impact(); router.push('/recurring-income'); }}
                  activeOpacity={0.75}
                >
                  <View style={styles.heroWealthHeaderRow}>
                    <View style={styles.heroWealthLeftGroup}>
                      <View style={[styles.heroWealthChip, { backgroundColor: '#F59E0B18' }]}>
                        <Feather name="clock" size={13} color="#F59E0B" />
                      </View>
                      <Text style={[styles.heroWealthLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{t.pendingIncomeLabel}</Text>
                    </View>
                  </View>
                  {/* Same 32pt inset (icon width + gap) as Cash — starts
                      under "PENDING INCOME", not under the icon. */}
                  <Text
                    style={[styles.heroWealthValueFull, { color: '#F59E0B', marginStart: 32 }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {hideValues ? '••••••' : (
                      <>
                        {fmtCompact(toDisp(pendingIncomeEGP))}{' '}
                        <Text style={{ color: colors.mutedForeground }}>{displayCurrency}</Text>
                      </>
                    )}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── EXPERIMENTAL (unified hero card, simulator-only) ─────
              Goals, folded in from its own row below — same GoalRing
              component, same single-vs-cluster logic, just smaller and
              living here instead of its own card. */}
          {goalsSummary && (
            <View style={[
              styles.heroGoalWrap,
              { borderTopColor: colors.border },
              // When Cash/Pending exists right above, heroWealthStrip's
              // own bottom border already sits there — this wrap's own
              // top border would be a second line ~4pt below it. Only
              // draw this one when Goals is the first thing in the
              // strip (nothing else already provided that divider).
              (cashAccounts.length > 0 || pendingIncomeEGP > 0) && { borderTopWidth: 0 },
            ]}>
              <TouchableOpacity
                style={[styles.heroGoalBand, { backgroundColor: colors.card, borderColor: colors.primary + '2E' }]}
                onPress={() => { impact(); router.push('/goals' as any); }}
                activeOpacity={0.85}
              >
                <ExpoLinearGradient
                  colors={[colors.primary + '1A', colors.card, colors.card]}
                  locations={[0, 0.65, 1]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                {goalsSummary.single ? (
                  <GoalRing
                    size={19} strokeWidth={2}
                    pct={goalsSummary.single.pct}
                    color={colors.green}
                    fillColor={colors.primary}
                    trackColor={colors.border}
                    done={goalsSummary.single.done}
                  />
                ) : (
                  <View style={styles.goalRingCluster}>
                    {goalsSummary.sorted.slice(0, 3).map((g, i) => (
                      <View key={g.goal.id} style={i > 0 ? { marginLeft: -5 } : undefined}>
                        <GoalRing
                          size={19} strokeWidth={2}
                          pct={g.pct}
                          color={g.done ? colors.green : GOAL_RING_COLORS[i % GOAL_RING_COLORS.length]}
                          trackColor={colors.border}
                          done={g.done}
                        />
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.heroGoalText}>
                  <Text style={[styles.heroGoalLabel, { color: colors.primary }]}>{t.goals}</Text>
                  {/* This uses toLocaleString (full digits with commas),
                      not fmtCompact — a large goal or multi-goal total can
                      genuinely run long ("1,500,000 / 3,000,000 EGP"), and
                      this pill isn't stretched (stays centered, per
                      instruction), so it has no extra width to grow into.
                      adjustsFontSizeToFit is the fallback that keeps it on
                      one line instead of truncating. */}
                  <Text
                    style={[styles.heroGoalAmount, { color: colors.text }]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.15}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {hideValues ? '••••••' : (() => {
                      // overviewGoalAmount() returns one combined string
                      // ("50,000 / 10,000 EGP") — the trailing currency word
                      // is always the last space-delimited token in both
                      // locales (EN "EGP", AR "جنيه"), so splitting there
                      // isolates it for its own muted color without a
                      // separate i18n key or touching the number formatting.
                      const full = goalsSummary.single
                        ? t.overviewGoalAmount(
                            goalsSummary.single.saved.toLocaleString('en-EG', { maximumFractionDigits: 0 }),
                            // targetAmount is typed as a plain number but, like
                            // savedAmount, has come through null at runtime —
                            // ?? 0 here is what actually stops the crash this
                            // specific call site hit (goal.targetAmount.toLocaleString
                            // on null); effectiveGoalSaved's own ?? 0 covers .saved.
                            (goalsSummary.single.goal.targetAmount ?? 0).toLocaleString('en-EG', { maximumFractionDigits: 0 }),
                          )
                        : t.overviewGoalAmount(
                            goalsSummary.totalSaved.toLocaleString('en-EG', { maximumFractionDigits: 0 }),
                            goalsSummary.totalTarget.toLocaleString('en-EG', { maximumFractionDigits: 0 }),
                          );
                      const lastSpace = full.lastIndexOf(' ');
                      return (
                        <>
                          {full.slice(0, lastSpace)}{' '}
                          <Text style={{ color: colors.mutedForeground }} maxFontSizeMultiplier={1.15}>{full.slice(lastSpace + 1)}</Text>
                        </>
                      );
                    })()}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
          </View>
          )}

          {/* Invested · Current · Return strip */}
          {summary.totalCost > 0 && (
            <View style={styles.iStrip}>
              <View style={[styles.iCell, { borderColor: colors.text + '14' }]}>
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>{t.invested}</Text>
                <View style={styles.iCellValueRow}>
                  {/* numberOfLines+adjustsFontSizeToFit — each cell is
                      only ~1/3 of the strip's width; without this a long
                      value would wrap onto a second line instead of
                      staying on one, misaligning with its siblings and
                      the currency label sitting next to it. */}
                  <Text style={[styles.iCellValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{hideValues ? '••••' : fmtCompact(toDisp(summary.totalCost))}</Text>
                  {!hideValues && <Text style={[styles.iCellCur, { color: colors.mutedForeground }]}>{displayCurrency}</Text>}
                </View>
              </View>
              <View style={[styles.iCell, { borderColor: colors.text + '14' }]}>
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>{t.currentLabel}</Text>
                <View style={styles.iCellValueRow}>
                  <Text style={[styles.iCellValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{hideValues ? '••••' : fmtCompact(toDisp(summary.totalValue))}</Text>
                  {!hideValues && <Text style={[styles.iCellCur, { color: colors.mutedForeground }]}>{displayCurrency}</Text>}
                </View>
              </View>
              <Pressable
                style={[styles.iCell, { borderColor: colors.text + '14' }]}
                onPress={() => showModal(t.returnCalcTitle, t.returnCalcBody)}
              >
                <Text style={[styles.iCellLabel, { color: colors.mutedForeground }]}>{t.returnLabel}</Text>
                <View style={styles.iCellValueRow}>
                  <Text style={[styles.iCellValue, { color: gainColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {/* .toFixed(2), matching the Total P/L chip below —
                        both render the identical summary.gainPct; at
                        different precision a value like 12.35% could read
                        as "12.3%" here and "12.35%" there, looking like
                        two different numbers instead of the same one. */}
                    {`${isGain ? '+' : ''}${summary.gainPct.toFixed(2)}%`}
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
                  <Text style={[styles.plValue, { color: todayColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {hideValues ? '••••' : isTodayFlat ? `0 ${displayCurrency}` : `${isTodayGain ? '+' : '−'}${fmtCompact(Math.abs(toDisp(summary.todayGain)))} ${displayCurrency}`}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => { impact(); setShowTotalPLBreakdown(true); }}
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
                <Text style={[styles.plValue, { color: gainColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
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
                    live prices land. Same reasoning for serverIntradayLoading:
                    without it, todaySamples' 2-point start/end line paints as
                    a real (untextured) chart, then gets replaced a moment
                    later once the server's texture lands — visibly "a chart
                    changing shape." An empty series lets PerfChart show its
                    own "building" placeholder instead, matching how the Today
                    tile waits rather than asserting a flat day, so 1D only
                    ever paints once, already final. */}
                <PerfChart
                  period={timeFilter}
                  width={sparkWidth}
                  height={78}
                  snapshots={snapshots}
                  todayValues={todaysChangeKnown && !serverIntradayLoading ? todaySamples : []}
                  liveValue={summary.totalValue}
                  allTimeValues={[summary.totalCost, summary.totalValue]}
                  loading={timeFilter === '1D' && (!todaysChangeKnown || serverIntradayLoading)}
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
          {/* 400 — allocationStrip now has marginHorizontal:-12 (its
              border reaches the P/L chips' outer edge, matching every
              other row) alongside its existing paddingHorizontal:12 —
              the margin widens the strip's own box by 24pt total, and
              since the padding is a fixed pt value (not relative), that
              widens the CONTENT area by the same 24pt too: heroBody's
              content width (440 - 2*20 = 400) minus allocationStrip's
              own 2*12 padding, plus the 24pt the margin adds back =
              400-24+24 = 400. Re-verify with a pixel screenshot after
              any further padding/margin change here — the Animated
              percentage-width chain inside AllocationBar swallows
              margin/padding several levels up in ways that haven't
              matched hand calculations cleanly every time tonight. */}
          <View style={{ width: 400, alignSelf: 'center' }}>
            <AllocationBar
              chipWrapStyle={{ paddingLeft: 4 }}
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
                  // Matches analytics.tsx's own Allocation Bar label exactly
                  // (both purpose-built "AllocLabel" i18n keys) — this and
                  // that one used to say "EGX Stock"/"Stocks" for the
                  // identical segment, depending which screen you were on.
                  label: t.egxStocksAllocLabel, value: summary.stockV,  color: '#4A9EFF',
                  icon: 'bar-chart-2', quantity: summary.stockCount > 0 ? `${summary.stockCount} stock${summary.stockCount !== 1 ? 's' : ''}` : undefined,
                },
                {
                  label: t.realEstate, value: summary.reV,  color: '#A47FCA',
                  icon: { lib: 'mci' as const, name: 'home-city' }, quantity: summary.reCount > 0 ? `${summary.reCount} propert${summary.reCount !== 1 ? 'ies' : 'y'}` : undefined,
                },
                {
                  label: t.personalAssetsAllocLabel, value: summary.paV, color: '#E08E45',
                  icon: { lib: 'mci' as const, name: 'tag-multiple' }, quantity: summary.paCount > 0 ? `${summary.paCount} asset${summary.paCount !== 1 ? 's' : ''}` : undefined,
                },
                {
                  // Net of any linked-loan balance — the allocation bar
                  // should reflect real net position, same as the headline
                  // Total Portfolio Value above it.
                  label: t.fixedIncome, value: summary.fiVNetOfLoans, color: '#22C55E',
                  icon: { lib: 'mci' as const, name: 'bank-transfer' },
                },
              ]}
              hideValues={hideValues}
            />
          </View>
          </View>
        )}
      </View>

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
              {/* ICON_INVESTMENTS is the one Investments icon everywhere in
                  the app now — see constants/conceptIcons.ts. */}
              <ConceptIcon icon={ICON_INVESTMENTS} size={26} color={colors.primary + 'AA'} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noInvestmentsYet}</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>{t.addFromHoldingsTab}</Text>
          </View>
        ) : (
          <View style={styles.holdingsList}>
            {topHoldings.map(h => {
              const openHolding = () => { impact(); router.push(`/add-investment?holdingId=${h.id}` as any); };
              return (
                <HoldingCard
                  key={h.id}
                  holding={h}
                  prices={prices}
                  hideValues={hideValues}
                  hideSubtitle
                  onCardPress={openHolding}
                />
              );
            })}
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

    <TotalPLBreakdownModal
      visible={showTotalPLBreakdown}
      onClose={() => setShowTotalPLBreakdown(false)}
      onShowMethodology={() => showModal(t.totalPLCalcTitle, t.totalPLCalcBody)}
      rows={totalPLBreakdown}
      totalAmount={summary.gain}
      totalPct={summary.gainPct}
      hideValues={hideValues}
      toDisp={toDisp}
      displayCurrency={displayCurrency}
    />

    <NetWorthBreakdownModal
      visible={showNetWorthBreakdown}
      onClose={() => setShowNetWorthBreakdown(false)}
      investmentsValue={summary.totalValue}
      cashHomeValue={cashHomeEGP}
      bankValue={bankEGP}
      pendingIncomeValue={pendingIncomeEGP}
      loansValue={summary.totalLoans}
      totalAmount={netWorthEgp}
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
        // maybeRequestReview() deliberately NOT called here anymore — a
        // real user's own screen recording showed this exact flow (tier
        // card -> tap Continue) hard-crashing the app, every single time,
        // for two weeks. expo-store-review's native binding calls
        // requireNativeModule('ExpoStoreReview'), which throws OUTSIDE
        // catchable JS when the native module isn't compiled into the
        // running binary — appReview.ts's own try/catch (added for exactly
        // this risk) can't protect against a crash that happens below the
        // JS layer, especially with the New Architecture enabled here. A
        // "please review us" prompt is not worth risking that again until
        // a real native rebuild ships the module and this is verified safe
        // on-device first, not just reasoned about from the SDK source.
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
                    <View style={tb.rowLabelWrap}>
                      <Text style={[tb.rowLabel, { color: colors.text }]}>{r.label}</Text>
                      {r.key === 'fx' && (
                        // Ahmed (real user, Feedback & Ideas chat) reported this row
                        // as confusing — he doesn't hold "currency," so a "Currency"
                        // loss read as a phantom holding. It's actually correct: the
                        // FX component of gold/silver's EGP valuation, broken out on
                        // its own (see the comment above todayBreakdown). Explaining
                        // it in place is simpler and safer than renaming a label
                        // that's technically accurate everywhere else it appears.
                        <TouchableOpacity
                          onPress={() => Alert.alert(t.currencyFxLabel, t.currencyFxExplainer)}
                          hitSlop={8}
                          style={tb.infoBtn}
                        >
                          <Feather name="info" size={12} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      )}
                    </View>
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

// ─── Total P/L breakdown modal ──────────────────────────────────────────────────
// Answers the same kind of gap NetWorthBreakdownModal closed for "Net Worth
// incl. cash" — Ahmed (real user, Feedback & Ideas chat) pointed out that
// Today's P/L is tappable and shows a real per-class breakdown, but Total
// P/L, styled identically right next to it, only opened a plain-text
// methodology explainer with no actual numbers. Same `tb` shell/rows as
// TodayBreakdownModal above (reuses TodayBreakdownRow's shape directly —
// same key/label/color/icon/amount/pct fields, no reason for a second
// type), just all-time gain-since-purchase per class instead of today's
// move. No "no change yet" empty framing (todayBreakdown's own) — an
// all-time return sitting at exactly 0% is rare enough not to deserve its
// own designed state, the plain empty-rows case covers it fine. The info
// button next to the title reopens the existing methodology explainer
// (totalPLCalcTitle/Body) — real, still-useful context this breakdown
// doesn't replace, just complements.
function TotalPLBreakdownModal({
  visible, onClose, onShowMethodology, rows, totalAmount, totalPct, hideValues, toDisp, displayCurrency,
}: {
  visible: boolean; onClose: () => void; onShowMethodology: () => void; rows: TodayBreakdownRow[];
  totalAmount: number; totalPct: number;
  hideValues: boolean; toDisp: (egp: number) => number; displayCurrency: DisplayCurrency;
}) {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const isFlatTotal = Math.abs(toDisp(totalAmount)) < 0.005;
  const isGain = totalAmount >= 0;
  const totalColor = isFlatTotal ? colors.mutedForeground : (isGain ? colors.green : colors.red);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={tb.backdrop} onPress={onClose} />
      <View style={[tb.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
        <View style={[tb.handle, { backgroundColor: colors.border }]} />
        <View style={tb.header}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[tb.title, { color: colors.text }]}>{t.totalPLBreakdownTitle}</Text>
              <TouchableOpacity onPress={onShowMethodology} hitSlop={8}>
                <Feather name="info" size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
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
          <Text style={[tb.emptyText, { color: colors.mutedForeground }]}>{t.totalPLBreakdownEmpty}</Text>
        ) : (
          <View style={tb.list}>
            {rows.map(r => {
              const isFlat = Math.abs(toDisp(r.amount)) < 0.005;
              const rowGain = r.amount >= 0;
              const rowColor = isFlat ? colors.mutedForeground : (rowGain ? colors.green : colors.red);
              return (
                <View key={r.key} style={tb.row}>
                  <View style={[tb.iconBox, { backgroundColor: r.color + '1A' }]}>{r.icon}</View>
                  <View style={tb.rowBody}>
                    <Text style={[tb.rowLabel, { color: colors.text }]}>{r.label}</Text>
                    {r.pct !== null && (
                      <Text style={[tb.rowSub, { color: colors.mutedForeground }]}>
                        {`${!isFlat && r.pct >= 0 ? '+' : ''}${r.pct.toFixed(2)}%`}
                      </Text>
                    )}
                  </View>
                  <Text style={[tb.rowAmount, { color: rowColor }]}>
                    {hideValues ? '••••' : isFlat ? `0 ${displayCurrency}` : `${rowGain ? '+' : '−'}${fmtCompact(Math.abs(toDisp(r.amount)))} ${displayCurrency}`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Net worth breakdown modal ─────────────────────────────────────────────────
// Answers Ahmed's (real user, Feedback & Ideas chat) "where does the extra
// money in Net Worth incl. cash actually come from" — same sheet shell as
// TodayBreakdownModal above (reuses the `tb` styles for visual consistency
// between the two), but simpler row semantics: no gain/loss coloring, no %,
// no flat-state handling — this is a static composition breakdown, not a
// today's-change one, so those concerns don't apply.

interface NetWorthRow { key: string; label: string; color: string; icon: React.ReactNode; amount: number }

function NetWorthBreakdownModal({
  visible, onClose, investmentsValue, cashHomeValue, bankValue, pendingIncomeValue, loansValue,
  totalAmount, hideValues, toDisp, displayCurrency,
}: {
  visible: boolean; onClose: () => void;
  investmentsValue: number; cashHomeValue: number; bankValue: number; pendingIncomeValue: number; loansValue: number;
  totalAmount: number; hideValues: boolean; toDisp: (egp: number) => number; displayCurrency: DisplayCurrency;
}) {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  const rows: NetWorthRow[] = [
    { key: 'investments', label: t.investmentsLabel, color: colors.primary,
      icon: <ConceptIcon icon={ICON_INVESTMENTS} size={16} color={colors.primary} />, amount: investmentsValue },
    // BanknoteIcon — Cash at Home's own established icon everywhere else
    // (cash-accounts.tsx's type picker/list), not a shared-registry
    // Feather/MCI glyph, since it's already a real, dedicated component
    // nothing else can accidentally reuse.
    ...(cashHomeValue > 0 ? [{ key: 'cashHome', label: t.cashAtHome, color: colors.green,
      icon: <BanknoteIcon size={16} color={colors.green} />, amount: cashHomeValue }] : []),
    ...(bankValue > 0 ? [{ key: 'bank', label: t.bankAccount, color: colors.green,
      icon: <ConceptIcon icon={ICON_BANK_ACCOUNT} size={16} color={colors.green} />, amount: bankValue }] : []),
    ...(pendingIncomeValue > 0 ? [{ key: 'pending', label: t.pendingIncomeLabel, color: '#F59E0B',
      icon: <ConceptIcon icon={ICON_PENDING_INCOME} size={16} color="#F59E0B" />, amount: pendingIncomeValue }] : []),
    ...(loansValue > 0 ? [{ key: 'loans', label: t.loansRowLabel, color: colors.red,
      icon: <ConceptIcon icon={ICON_LOANS} size={16} color={colors.red} />, amount: -loansValue }] : []),
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={tb.backdrop} onPress={onClose} />
      <View style={[tb.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
        <View style={[tb.handle, { backgroundColor: colors.border }]} />
        <View style={tb.header}>
          <View>
            <Text style={[tb.title, { color: colors.text }]}>{t.netWorthBreakdownTitle}</Text>
            <Text style={[tb.subtitle, { color: colors.text }]}>
              {hideValues ? '••••' : `${fmtCompact(toDisp(totalAmount))} ${displayCurrency}`}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[tb.close, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={tb.list}>
          {rows.map(r => (
            <View key={r.key} style={tb.row}>
              <View style={[tb.iconBox, { backgroundColor: r.color + '1A' }]}>{r.icon}</View>
              <View style={tb.rowBody}>
                <Text style={[tb.rowLabel, { color: colors.text }]}>{r.label}</Text>
              </View>
              <Text style={[tb.rowAmount, { color: r.amount < 0 ? colors.red : colors.text }]}>
                {hideValues ? '••••' : `${r.amount < 0 ? '−' : ''}${fmtCompact(Math.abs(toDisp(r.amount)))} ${displayCurrency}`}
              </Text>
            </View>
          ))}
        </View>
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
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  infoBtn: { padding: 1 },
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

  // No border/radius/fill anymore — just a plain layout wrapper. overflow
  // is left default (visible) since there's no rounded-corner edge left
  // for the wash to be clipped to.
  heroCard:   {},
  // A narrow angled band swept across the card once on a milestone.
  heroSweep: { position: 'absolute', top: -40, bottom: -40, width: 90 },
  // 20, not the old card's 24 — with no border to pad away from, this
  // just matches the screen's own outer inset (styles.content) directly,
  // so hero content lines up with the Greeting/Overview title above it
  // instead of sitting extra-inset. Every "-24/+24 cancel and reapply"
  // pair below (heroWealthStrip, heroGoalWrap, iStrip, chartWrap,
  // allocationStrip) moves to -20/+20 to match.
  // 0, not 20 — this sits INSIDE the scroll container's own 20pt padding
  // (styles.content), so giving it a horizontal padding of its own just
  // doubled the inset to 40pt on each side. With no card border to pad
  // away from anymore, hero content should align exactly with the
  // Greeting/Overview title above it, using only the screen's own inset.
  // Each "-20/+20 cancel and reapply" pair below (heroWealthStrip,
  // heroGoalWrap, iStrip, chartWrap, allocationStrip) drops the -20: with
  // heroBody itself contributing zero padding, there's nothing left for
  // them to cancel — their own paddingHorizontal is now a genuine
  // additional inset for their internal content, on top of (not
  // instead of) the screen's 20pt, not a workaround for double-padding.
  heroBody:   { paddingHorizontal: 0, paddingTop: 22, paddingBottom: 24, gap: 16, alignItems: 'stretch' },

  // ── EXPERIMENTAL (unified hero card, simulator-only) ────────────────
  // Cash + Pending Income, now living inside the hero card instead of
  // their own separate cards below it. Mirrors the plan-file mockup this
  // was built from — a compact 2-column strip when both exist, a wider
  // single row when only one does (border/margin swapped per-branch at
  // the call site rather than two near-duplicate style objects here).
  // marginBottom trims heroBody's own `gap: 16` (applied automatically
  // after this block, before the Invested/Current/Return strip) down to
  // match the tight border-to-content spacing used above Goals — gap
  // can't be reduced for just one sibling pair in RN flexbox, so this
  // negative margin does it locally without touching heroBody's gap
  // (which every other section on this card still relies on).
  heroExtras: { gap: 4, marginBottom: -8 },
  // Both top AND bottom border (matching iStrip's own self-contained
  // pattern) — the vertical divider stretches between these two, within
  // this row's own box. It was only ever going to reach a border that's
  // actually part of THIS row; the next section's border, one row over
  // and separated by its own deliberate ~8pt gap, was never something the
  // divider could reach by stretching harder.
  // No paddingHorizontal here on purpose — Cash and Pending each set their
  // own paddingStart/paddingEnd independently at their call sites, so
  // adjusting one's gap to the card edge can never move the other's. A
  // shared value on this strip was exactly what caused edits meant for
  // one side to visibly shift the other.
  // marginHorizontal:-20 — cancels content's own 20pt screen padding
  // fully, so this border reaches the literal screen edge (0 gap), not
  // just the P/L chips' previous 8pt-short match. The cells' own inline
  // paddingStart/paddingEnd (call sites) are bumped by the same +8 this
  // requires, so the text inset stays exactly where it was.
  // Top/bottom border removed — each cell now carries its own border
  // (Option F), so the shared strip's own border was doubling up on top
  // of that.
  heroWealthStrip: { flexDirection: 'row', marginHorizontal: -20 },
  // Column, not row — label+badge live in their own header row up top,
  // and the value gets the rest of the cell's full width to itself below.
  // Splitting these onto separate rows (rather than one row where the
  // value and badge compete for the same horizontal space) is what
  // actually stops a large balance ("400k EGP") and the Today badge from
  // fighting over width and one of them truncating.
  heroWealthCell: { flex: 1, paddingHorizontal: 14, paddingVertical: 8, gap: 3 },
  // justifyContent:'space-between' pushes the two children — the
  // heroWealthLeftGroup (icon+label) and the badge — to opposite ends of
  // this header row specifically (short, fixed-length content on both
  // sides, so this row itself can never be the one that overflows).
  heroWealthHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroWealthLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  heroWealthChip: { width: 26, height: 26, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  heroWealthLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3, textTransform: 'uppercase' },
  // Its own full-width row, nothing beside it — adjustsFontSizeToFit at
  // the JSX call site shrinks this down first if it's ever too long to
  // fit on one line at full size, same technique PortfolioHeroValue uses
  // for the headline number, rather than truncating.
  heroWealthValueFull: { fontSize: 15, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  // Exact match to cash-accounts.tsx's todayBadge/todayBadgeText — same
  // chip on both screens, single combined "+1k Today" string via
  // t.todayChangeBadge(), not a separate stacked label+value.
  heroWealthBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginStart: 6, flexShrink: 1 },
  heroWealthBadgeText: { fontSize: 9.5, fontFamily: 'Inter_700Bold' },

  // Goals — same GoalRing component and single-vs-cluster logic the old
  // standalone row used, just smaller and living here. Kept its own gold
  // wash identity (not flattened to match Cash/Pending's plain rows) —
  // aspirational, not a wealth-accounting number, same reasoning as the
  // Overview goals-card redesign this was built alongside.
  // paddingTop:4 (was 8) — measured precisely: the gap above Goals (this
  // padding + heroExtras' own gap:4 between its two children) was ~13.7pt
  // vs. ~9.7pt below Goals. Trimming this to 4 brings both sides in line.
  // 12, matching iStrip/plChip's own inset — was 20, which sat noticeably
  // more inset than the Invested/Current/Return row and P/L chips right
  // below/above it, an inconsistency across rows that shouldn't exist now
  // that nothing has a card border to keep clear of.
  // marginHorizontal:-12 alongside the existing paddingHorizontal:12 —
  // same plRow pattern used everywhere else in this section, so this
  // border also reaches the P/L chips' outer edge instead of stopping
  // 12pt short. The Goals band itself stays centered/untouched — this
  // only affects the border line.
  // -20/20 (not -12/12) — border reaches the literal screen edge; the
  // matching +8 padding keeps the Goals band's own centering unaffected.
  heroGoalWrap: { borderTopWidth: 1, paddingTop: 4, paddingHorizontal: 20, marginHorizontal: -20 },
  // heroGoalWrap (the parent) stretches its child to the full row width by
  // default — heroGoalText's own flex:1 then filled that whole width, but
  // its actual content (a short amount string) never needed that much,
  // leaving a big dead gap between the text and the chevron.
  // alignSelf:'flex-start' makes the band size to its own content instead.
  // alignSelf:'stretch' (was 'center') + justifyContent:'center' — spans
  // the full row width like Cash/Pending/Invested-Current-Return now do,
  // while keeping its own content (ring + label/amount) centered within
  // that width rather than left-packed. The trailing chevron is gone, so
  // there's no longer anything to balance against on the right.
  heroGoalBand: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1, overflow: 'hidden', paddingVertical: 7, paddingHorizontal: 10 },
  goalRingCluster: { flexDirection: 'row' },
  // flexShrink (not flex:1 growth) — a flex:1 child inside a shrink-to-fit
  // (alignSelf:'flex-start') parent still forced that parent to expand,
  // which is exactly what kept the band wide after the alignSelf change
  // alone.
  heroGoalText: { flexShrink: 1, minWidth: 0 },
  heroGoalLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase' },
  heroGoalAmount: { fontSize: 12, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'], marginTop: 1 },

  heroLabelRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroLabel:      { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
  // justifyContent:'center' + gap centers [number + pill] as one group —
  // see the comment at the JSX call site for why (not two independent
  // flex:1 spacers, which left the pill's gap from the number
  // inconsistent depending on the number's length).
  heroValueRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, alignSelf: 'stretch', marginTop: -4 },
  // tabular-nums keeps every digit the same width. The value is an animated
  // counter, so proportional digits made the number visibly shimmy as it
  // tweened — 1s are narrow, 0s wide — and the whole line re-centred on each
  // frame. -1.6 rather than -2: at 46px the tighter tracking was starting to
  // close up the gap around the thousands separators.
  heroValue:      { fontSize: 46, fontFamily: 'Inter_700Bold', letterSpacing: -1.6, flexShrink: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
  // Gold-accented (was flat grey) — the only change here is the trigger
  // pill's color; the expanded list below keeps its original look/behavior.
  currencyPill:       { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 },
  currencyPillText:   { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.4 },
  // Wraps because the switcher is user-configurable now and can hold up to 11
  // currencies; a plain row clipped everything past the fourth.
  currencyTabStrip:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4, marginBottom: 2, paddingHorizontal: 4 },
  currencyTab:        { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7 },
  currencyTabText:    { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
  netWorthRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  netWorthTxt:    { fontSize: 11.5, fontFamily: 'Inter_500Medium', fontVariant: ['tabular-nums'] },

  // marginHorizontal:-12 alongside the existing paddingHorizontal:12 —
  // same plRow pattern as heroWealthStrip above: pushes the border out
  // by exactly what the padding pulls the text back in by, so the text
  // inset is unchanged but the border now reaches the P/L chips' outer
  // edge instead of stopping 12pt short.
  // -20/20 (not -12/12) — border reaches the literal screen edge; text
  // inset (0 + 20) stays exactly where it was (8 + 12).
  iStrip:         { flexDirection: 'row', paddingHorizontal: 20, marginHorizontal: -20 },
  iCell:          { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4, borderWidth: 1, borderRadius: 14, margin: 4 },
  iCellLabel:     { fontSize: 10, fontFamily: 'Inter_400Regular', letterSpacing: 0.2 },
  iCellValueRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  iCellValue:     { fontSize: 14, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  iCellCur:       { fontSize: 9, fontFamily: 'Inter_400Regular' },

  // marginTop/marginBottom trim heroBody's `gap: 16` on both sides down to
  // the same 8pt the Goals row sits in (16 - 8 = 8), instead of the plain
  // 16 every other untouched pair in the card still uses.
  // -20/20 (not -12/12) — pushes the chips' own outer border all the way
  // to the literal screen edge; the matching padding bump keeps their
  // internal text inset unchanged (0 + 20, was 8 + 12).
  // gap removed — now that each plChip carries its own margin:4 (for the
  // edge inset), that same margin already produces an 8pt gap between
  // the two chips (4+4) on its own, matching Cash/Pending's own tiles
  // exactly. Keeping gap:8 here on top of that doubled the space between
  // the two chips to 16pt instead.
  plRow:          { flexDirection: 'row', marginTop: -8, marginBottom: -8, marginHorizontal: -20 },
  // margin:4 — same small inset Cash/Pending's own tiles now have, so
  // these chips get the same comfortable breathing room from the screen
  // edge instead of sitting flush against the literal 0pt edge.
  plChip:         { flex: 1, gap: 5, borderRadius: 18, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10, margin: 4 },
  plTop:          { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plLabel:        { flex: 1, fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  plValue:        { fontSize: 13.5, fontFamily: 'Inter_700Bold', flexShrink: 1, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  plBadge:        { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2 },
  plBadgeText:    { fontSize: 9.5, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },

  // 12, matching iStrip/plChip/heroGoalWrap — same consistency fix.
  // marginHorizontal:-12 — same plRow pattern, reaches the P/L chips' edge.
  // -20/20 (not -12/12) — border reaches the literal screen edge.
  chartWrap:  { borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 20, marginHorizontal: -20 },
  timeRow:    { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 10 },
  timePill:   { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  timePillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  // Deliberately quieter than the pills it explains — a footnote about the
  // data's age, not a control.
  trackingSince: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 7 },

  // paddingTop matches chartWrap's own rhythm (12, same hairline-vs-gap
  // combo) instead of the wider 18 it had before — that extra 6px, stacked
  // on heroBody's gap:16 between this and the time-period pills above,
  // read as a much bigger dead zone than every other border in the card.
  // Width 1 (not StyleSheet.hairlineWidth) for the same reason the
  // Cash/Pending divider needed it: hairlineWidth was rendering thin
  // enough on this device to look like a missing border.
  // paddingBottom:0 — this is the card's last element, so heroBody's own
  // paddingBottom:24 is already the full bottom margin below it; this
  // strip's own paddingBottom used to stack on top of that (20+24=44pt),
  // which is exactly the "big unused spacing" under the allocation legend.
  // paddingBottom:8 — a small explicit safety margin. paddingBottom:0
  // (relying only on heroBody's own paddingBottom:24) measured out to a
  // much tighter real gap than expected (~7-8pt, not ~24pt) — rather than
  // chase why, this restores a modest, directly-controlled minimum here.
  // 12, matching the other rows — same consistency fix.
  // marginHorizontal:-12 — same plRow pattern, reaches the P/L chips' edge.
  // -20/20 (not -12/12) — border reaches the literal screen edge. Content
  // width is unaffected (both margin and padding grew by the same +8, so
  // they cancel for the content box specifically) — the AllocationBar
  // wrapper's hardcoded 400 below does NOT need to change for this.
  allocationStrip: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 0, marginTop: -8, marginHorizontal: -20 },

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
