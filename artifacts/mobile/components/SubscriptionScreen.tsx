import React, { useRef, useEffect, useState } from 'react';
import {
  Alert, Animated, Linking, Modal, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, View, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useSubscription, openWebPopup, BillingPeriod } from '@/context/SubscriptionContext';
import { useT } from '@/hooks/useTranslation';
import { useColors } from '@/hooks/useColors';
import { LaunchBanner } from '@/components/LaunchAccess';

// ─── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmPurchase({
  visible, planLabel, priceString, onConfirm, onCancel, isPurchasing,
}: {
  visible: boolean; planLabel: string; priceString: string;
  onConfirm: () => void; onCancel: () => void; isPurchasing: boolean;
}) {
  const t = useT();
  const colors = useColors();
  const accent = colors.primary;
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={cm.overlay}>
        <View style={[cm.card, { backgroundColor: colors.card, borderColor: accent + '35' }]}>
          <Text style={[cm.title, { color: colors.text }]}>{t.subConfirmTitle}</Text>
          <Text style={[cm.msg, { color: colors.mutedForeground }]}>
            {t.subSubscribingTo + '\n'}
            <Text style={{ color: colors.text, fontFamily: 'Inter_700Bold' }}>{planLabel}</Text>
            {'\n' + t.subAt + ' '}
            <Text style={{ color: accent, fontFamily: 'Inter_700Bold' }}>{priceString}</Text>
          </Text>
          <Pressable
            onPress={onConfirm}
            disabled={isPurchasing}
            style={[cm.confirmBtn, { backgroundColor: accent }]}
          >
            {isPurchasing
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Text style={[cm.confirmTxt, { color: colors.primaryForeground }]}>{t.subSubscribeNow}</Text>
            }
          </Pressable>
          <Pressable onPress={onCancel} style={cm.cancelBtn}>
            <Text style={[cm.cancelTxt, { color: colors.mutedForeground }]}>{t.subCancel}</Text>
          </Pressable>
          <Text style={[cm.legalTxt, { color: colors.mutedForeground }]}>{t.subAutoRenews}</Text>
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    borderRadius: 28, borderWidth: 1, padding: 28,
    width: '100%', alignItems: 'center', gap: 16,
  },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, textAlign: 'center' },
  msg: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 24, textAlign: 'center' },
  confirmBtn: { width: '100%', borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  confirmTxt: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  cancelBtn: { paddingVertical: 8 },
  cancelTxt: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  legalTxt: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 15, textAlign: 'center' },
});

// ─── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({ period }: { period: BillingPeriod }) {
  const { offerings } = useSubscription();
  const t = useT();
  const colors = useColors();
  const accent = colors.primary;
  const product = offerings.pro;
  const price = period === 'monthly'
    ? `${product.priceString}/${t.subMonth}`
    : `${product.annualPriceString}/${t.subYear}`;
  const perMonth = period === 'annual'
    ? `≈ ${Math.round(product.annualPrice / 12).toLocaleString('en-EG')} EGP/${t.subMonth}`
    : null;

  return (
    <View style={[pc.card, { borderColor: accent, borderWidth: 2, backgroundColor: accent + '08' }]}>
      <View style={[pc.topBar, { backgroundColor: accent }]} />

      <View style={pc.row}>
        <View style={pc.info}>
          <View style={[pc.badge, { backgroundColor: accent + '1A', borderColor: accent + '35' }]}>
            <Text style={[pc.badgeTxt, { color: accent }]}>PRO</Text>
          </View>
          <Text style={[pc.price, { color: colors.text }]}>{price}</Text>
          {perMonth && <Text style={[pc.sub, { color: colors.mutedForeground }]}>{perMonth}</Text>}
        </View>
        <View style={[pc.radio, { borderColor: accent }]}>
          <View style={[pc.dot, { backgroundColor: accent }]} />
        </View>
      </View>
    </View>
  );
}

const pc = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden' },
  topBar: { height: 2, position: 'absolute', top: 0, left: 0, right: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 22 },
  info: { gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeTxt: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  price: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6 },
});

// ─── Feature row ──────────────────────────────────────────────────────────────

function FeatureRow({ icon, label }: { icon: string; label: string }) {
  const colors = useColors();
  const accent = colors.primary;
  return (
    <View style={frow.row}>
      <View style={[frow.icon, { backgroundColor: accent + '18' }]}>
        <Feather name={icon as any} size={13} color={accent} />
      </View>
      <Text style={[frow.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const frow = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  icon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
});

// ─── Free vs Pro compare table ─────────────────────────────────────────────────

function CompareTable() {
  const colors = useColors();
  const t = useT();
  const accent = colors.primary;

  const ROWS: { label: string; free: string | false; pro: string | true }[] = [
    { label: t.subCompareHoldings, free: '3', pro: t.subCompareUnlimited },
    { label: t.subMarketIntelligence, free: false, pro: true },
    { label: t.subPortfolioAnalytics, free: false, pro: true },
  ];

  return (
    <View style={[cmp.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={cmp.headerRow}>
        <View style={cmp.labelCol} />
        <Text style={[cmp.headerTxt, cmp.col, { color: colors.mutedForeground }]}>{t.subCompareFree}</Text>
        <Text style={[cmp.headerTxt, cmp.col, { color: accent }]}>{t.subComparePro}</Text>
      </View>
      {ROWS.map((r, i) => (
        <View
          key={r.label}
          style={[cmp.row, i < ROWS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
        >
          <Text style={[cmp.rowLabel, cmp.labelCol, { color: colors.text }]} numberOfLines={1}>{r.label}</Text>
          <View style={cmp.col}>
            {typeof r.free === 'string'
              ? <Text style={[cmp.cellTxt, { color: colors.mutedForeground }]}>{r.free}</Text>
              : <Feather name="x" size={14} color={colors.mutedForeground} />}
          </View>
          <View style={cmp.col}>
            {typeof r.pro === 'string'
              ? <Text style={[cmp.cellTxt, cmp.cellTxtPro, { color: accent }]}>{r.pro}</Text>
              : <Feather name="check" size={15} color={accent} />}
          </View>
        </View>
      ))}
    </View>
  );
}

const cmp = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingHorizontal: 16, paddingBottom: 8 },
  headerTxt: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  labelCol: { flex: 1 },
  rowLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  col: { width: 56, alignItems: 'center' },
  cellTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  cellTxtPro: { fontFamily: 'Inter_700Bold' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

interface SubscriptionScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function SubscriptionScreen({ visible, onClose }: SubscriptionScreenProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const accent = colors.primary;
  const onAccent = colors.primaryForeground;
  const { offerings, purchase, restore, isPurchasing, isRestoring, launchAccess } = useSubscription();
  const t = useT();

  const FEATURES = [
    { icon: 'layers',      label: t.subUnlimitedInvestments  },
    { icon: 'globe',       label: t.subLiveRates             },
    { icon: 'cpu',         label: t.subPersonalizedSignals   },
    { icon: 'bar-chart-2', label: t.subHealthScore           },
    { icon: 'activity',    label: t.subFullCharts            },
    { icon: 'pie-chart',   label: t.subAllocationBreakdown   },
    { icon: 'award',       label: t.subTopPerformers         },
    { icon: 'zap',         label: t.subSmartInsights         },
  ];

  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [showConfirm, setShowConfirm] = useState(false);

  const slideY = useRef(new Animated.Value(700)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(0);

  // PanResponder is created once via useRef, so its callbacks close over
  // whatever `onClose` was on the first render. Route through a ref kept
  // current every render so a swipe-dismiss always calls the latest one.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const snapOpen = () => {
    Animated.spring(slideY, { toValue: 0, damping: 26, stiffness: 230, useNativeDriver: Platform.OS !== 'web' }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        slideY.stopAnimation((value) => { dragStart.current = value; });
      },
      onPanResponderMove: (_, gesture) => {
        slideY.setValue(Math.max(0, dragStart.current + gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.8) {
          Animated.timing(slideY, { toValue: 800, duration: 200, useNativeDriver: Platform.OS !== 'web' })
            .start(() => onCloseRef.current());
        } else {
          snapOpen();
        }
      },
      onPanResponderTerminate: snapOpen,
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0, damping: 26, stiffness: 230,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    } else {
      slideY.setValue(700);
      bgOpacity.setValue(0);
    }
  }, [visible]);

  const product = offerings.pro;
  const currentPrice = period === 'monthly'
    ? `${product.priceString}/${t.subMonth}`
    : `${product.annualPriceString}/${t.subYear}`;

  const handleConfirm = async () => {
    // Must be called synchronously, before any `await`, so the popup isn't
    // blocked by the browser (it needs to happen inside the click's
    // original user-gesture window). No-op on native.
    const webPopup = openWebPopup();
    try {
      const success = await purchase(period, webPopup);
      setShowConfirm(false);
      onClose();
      if (success) {
        Alert.alert(t.subThankYouTitle, t.subThankYouBody);
      } else if (launchAccess) {
        // `purchase()` short-circuits during Launch Access without calling
        // any backend — this is the preview flow, not a failed real charge.
        Alert.alert(t.subPurchaseUnavailableTitle, t.subPurchaseUnavailableBody);
      }
    } catch {
      webPopup?.close();
      setShowConfirm(false);
      Alert.alert(
        t.subPurchaseUnavailableTitle,
        t.subPurchaseUnavailableBody,
      );
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* Dimmed backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: bgOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        style={[
          sw.sheet,
          { backgroundColor: colors.card, borderColor: colors.border },
          { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={sw.dragZone} {...panResponder.panHandlers}>
          <View style={[sw.handle, { backgroundColor: colors.border }]} />
        </View>

        <Pressable onPress={onClose} style={sw.closeBtn} hitSlop={16}>
          <View style={[sw.closeCircle, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </View>
        </Pressable>

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={sw.scroll}
        >
          {launchAccess && <LaunchBanner />}

          {/* ── Hero ────────────────────────────────────────── */}
          <View style={sw.hero}>
            <View style={[sw.iconWrap, { backgroundColor: accent + '15', borderColor: accent + '35' }]}>
              <Feather name="star" size={30} color={accent} />
            </View>
            <Text style={[sw.heroTitle, { color: colors.text }]}>Investry Pro</Text>
            <Text style={[sw.heroSub, { color: colors.mutedForeground }]}>{t.subHeroSub}</Text>
          </View>

          {/* ── Free vs Pro ─────────────────────────────────── */}
          <CompareTable />

          {/* ── Billing toggle ──────────────────────────────── */}
          <View style={[sw.toggleWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setPeriod('monthly')}
              style={[sw.toggleBtn, period === 'monthly' && { backgroundColor: colors.card }]}
            >
              <Text style={[sw.toggleTxt, { color: period === 'monthly' ? colors.text : colors.mutedForeground }]}>
                {t.subMonthly}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPeriod('annual')}
              style={[sw.toggleBtn, period === 'annual' && { backgroundColor: colors.card }]}
            >
              <Text style={[sw.toggleTxt, { color: period === 'annual' ? colors.text : colors.mutedForeground }]}>
                {t.subAnnual}
              </Text>
              <View style={[sw.saveBadge, { backgroundColor: colors.green }]}>
                <Text style={sw.saveBadgeTxt}>{t.subSave33}</Text>
              </View>
            </Pressable>
          </View>

          {/* ── Plan card ───────────────────────────────────── */}
          <View style={sw.plans}>
            <PlanCard period={period} />
          </View>

          {/* ── Features ────────────────────────────────────── */}
          <View style={[sw.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[sw.featureTitle, { color: colors.mutedForeground }]}>{t.subWhatsIncluded}</Text>
            {FEATURES.map(f => (
              <FeatureRow key={f.label} icon={f.icon} label={f.label} />
            ))}
          </View>

          {/* ── CTA ─────────────────────────────────────────── */}
          {/* Always shown, even during Launch Access, so the paywall stays
              clickable as a preview of the real subscribe flow — no charge
              is ever attempted (see handleConfirm/purchase()). */}
          <Pressable
            onPress={() => setShowConfirm(true)}
            disabled={isPurchasing}
            style={({ pressed }) => [sw.cta, { backgroundColor: accent, opacity: pressed ? 0.88 : 1 }]}
          >
            {isPurchasing ? (
              <ActivityIndicator color={onAccent} />
            ) : (
              <View style={sw.ctaRow}>
                <View>
                  <Text style={[sw.ctaTop, { color: onAccent }]}>{t.subContinueWith} Pro</Text>
                  <Text style={[sw.ctaBottom, { color: onAccent + 'A0' }]}>{currentPrice}</Text>
                </View>
                <View style={[sw.ctaArrow, { backgroundColor: onAccent + '22' }]}>
                  <Feather name="arrow-right" size={17} color={onAccent} />
                </View>
              </View>
            )}
          </Pressable>

          {/* ── Footer ──────────────────────────────────────── */}
          <View style={sw.footer}>
            {!launchAccess && (
              <>
                <Pressable onPress={() => restore()} disabled={isRestoring}>
                  <Text style={[sw.footerTxt, { color: colors.mutedForeground }]}>{isRestoring ? t.subRestoring : t.subRestorePurchases}</Text>
                </Pressable>
                <View style={[sw.dot, { backgroundColor: colors.border }]} />
              </>
            )}
            <Pressable onPress={() => Linking.openURL('https://investry.app/terms')}>
              <Text style={[sw.footerTxt, { color: colors.mutedForeground }]}>{t.subTerms}</Text>
            </Pressable>
            <View style={[sw.dot, { backgroundColor: colors.border }]} />
            <Pressable onPress={() => Linking.openURL('https://investry.app/privacy')}>
              <Text style={[sw.footerTxt, { color: colors.mutedForeground }]}>{t.subPrivacy}</Text>
            </Pressable>
          </View>

          <Text style={[sw.disclaimer, { color: colors.mutedForeground }]}>{t.subDisclaimer}</Text>
        </ScrollView>
      </Animated.View>

      <ConfirmPurchase
        visible={showConfirm}
        planLabel={product.title}
        priceString={currentPrice}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        isPurchasing={isPurchasing}
      />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sw = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderTopWidth: 1,
    maxHeight: '95%',
  },
  dragZone: {
    width: '100%', alignItems: 'center',
    paddingTop: 12, paddingBottom: 10,
  },
  handle: {
    width: 42, height: 4,
    borderRadius: 2,
  },
  closeBtn: { position: 'absolute', top: 16, end: 18, zIndex: 10 },
  closeCircle: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 20 },

  // Hero
  hero: { alignItems: 'center', paddingTop: 52, paddingBottom: 26, gap: 10 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  heroSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  // Toggle
  toggleWrap: {
    flexDirection: 'row',
    borderRadius: 16, padding: 4, borderWidth: 1, marginBottom: 14,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, borderRadius: 13, gap: 7,
  },
  toggleTxt: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  saveBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  saveBadgeTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.5 },

  // Plans
  plans: { gap: 10, marginBottom: 16 },

  // Features
  featureCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18, marginBottom: 20,
  },
  featureTitle: {
    fontSize: 11, fontFamily: 'Inter_700Bold',
    letterSpacing: 1, marginBottom: 8,
  },

  // CTA
  cta: {
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 22,
    minHeight: 68, justifyContent: 'center', marginBottom: 18,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaTop: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  ctaBottom: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2 },
  ctaArrow: {
    width: 38, height: 38, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 },
  footerTxt: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  disclaimer: {
    fontSize: 10, fontFamily: 'Inter_400Regular',
    lineHeight: 15, textAlign: 'center', marginBottom: 4, opacity: 0.7,
  },
});
