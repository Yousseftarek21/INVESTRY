import React, { useRef, useEffect, useState } from 'react';
import {
  Alert, Animated, Linking, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, View, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { useSubscription, openWebPopup, BillingPeriod } from '@/context/SubscriptionContext';
import { useT } from '@/hooks/useTranslation';
import { LaunchBadge, LaunchBanner } from '@/components/LaunchAccess';

const ACCENT = '#C9A227';

// ─── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmPurchase({
  visible, planLabel, priceString, onConfirm, onCancel, isPurchasing,
}: {
  visible: boolean; planLabel: string; priceString: string;
  onConfirm: () => void; onCancel: () => void; isPurchasing: boolean;
}) {
  const t = useT();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={cm.overlay}>
        <View style={[cm.card, { borderColor: ACCENT + '35' }]}>
          <View style={[cm.iconWrap, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '30' }]}>
            {Platform.OS === 'ios' ? (
              <SymbolView name="rosette" tintColor={ACCENT} size={28} />
            ) : (
              <Feather name="award" size={28} color={ACCENT} />
            )}
          </View>
          <Text style={cm.title}>{t.subConfirmTitle}</Text>
          <Text style={cm.msg}>
            {t.subSubscribingTo + '\n'}
            <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold' }}>{planLabel}</Text>
            {'\n' + t.subAt + ' '}
            <Text style={{ color: ACCENT, fontFamily: 'Inter_700Bold' }}>{priceString}</Text>
          </Text>
          <Pressable
            onPress={onConfirm}
            disabled={isPurchasing}
            style={[cm.confirmBtn, { backgroundColor: ACCENT }]}
          >
            {isPurchasing
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={cm.confirmTxt}>{t.subSubscribeNow}</Text>
            }
          </Pressable>
          <Pressable onPress={onCancel} style={cm.cancelBtn}>
            <Text style={cm.cancelTxt}>{t.subCancel}</Text>
          </Pressable>
          <Text style={cm.legalTxt}>{t.subAutoRenews}</Text>
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    borderRadius: 28, borderWidth: 1, padding: 28,
    width: '100%', alignItems: 'center', gap: 16,
    backgroundColor: '#0B1525',
  },
  iconWrap: { width: 64, height: 64, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: -0.5, textAlign: 'center' },
  msg: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#7B8CA8', lineHeight: 24, textAlign: 'center' },
  confirmBtn: { width: '100%', borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  confirmTxt: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#000' },
  cancelBtn: { paddingVertical: 8 },
  cancelTxt: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#4A5568' },
  legalTxt: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#2D3748', lineHeight: 15, textAlign: 'center' },
});

// ─── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({ period }: { period: BillingPeriod }) {
  const { offerings } = useSubscription();
  const t = useT();
  const product = offerings.pro;
  const price = period === 'monthly'
    ? `${product.priceString}/${t.subMonth}`
    : `${product.annualPriceString}/${t.subYear}`;
  const perMonth = period === 'annual'
    ? `≈ ${Math.round(product.annualPrice / 12).toLocaleString('en-EG')} EGP/${t.subMonth}`
    : null;

  return (
    <View style={[pc.card, { borderColor: ACCENT, borderWidth: 2, backgroundColor: ACCENT + '08' }]}>
      <View style={[pc.topBar, { backgroundColor: ACCENT }]} />

      <View style={pc.row}>
        <View style={pc.info}>
          <View style={[pc.badge, { backgroundColor: ACCENT + '1A', borderColor: ACCENT + '35' }]}>
            <Feather name="zap" size={10} color={ACCENT} style={{ marginRight: 4 }} />
            <Text style={[pc.badgeTxt, { color: ACCENT }]}>PRO</Text>
          </View>
          <Text style={pc.price}>{price}</Text>
          {perMonth && <Text style={pc.sub}>{perMonth}</Text>}
        </View>
        <View style={[pc.radio, { borderColor: ACCENT }]}>
          <View style={[pc.dot, { backgroundColor: ACCENT }]} />
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
  price: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: -0.6 },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#5A6C80' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6 },
});

// ─── Feature row ──────────────────────────────────────────────────────────────

function FeatureRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={frow.row}>
      <View style={[frow.icon, { backgroundColor: ACCENT + '18' }]}>
        <Feather name={icon as any} size={13} color={ACCENT} />
      </View>
      <Text style={frow.label}>{label}</Text>
    </View>
  );
}

const frow = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  icon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: '#C0CDD8' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

interface SubscriptionScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function SubscriptionScreen({ visible, onClose }: SubscriptionScreenProps) {
  const insets = useSafeAreaInsets();
  const { offerings, purchase, restore, isPurchasing, isRestoring, launchAccess } = useSubscription();
  const t = useT();

  const FEATURES = [
    { icon: 'layers',      label: t.subUnlimitedInvestments },
    { icon: 'tool',        label: t.subAllCalculators       },
    { icon: 'globe',       label: t.subMarketIntelligence   },
    { icon: 'bar-chart-2', label: t.subPortfolioAnalytics   },
    { icon: 'moon',        label: t.subZakat                },
    { icon: 'activity',    label: t.subAdvancedCharts       },
    { icon: 'zap',         label: t.subEgxRealtime          },
    { icon: 'download',    label: t.subCsvExport            },
    { icon: 'headphones',  label: t.subPrioritySupport      },
  ];

  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [showConfirm, setShowConfirm] = useState(false);

  const slideY = useRef(new Animated.Value(700)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

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
      <Animated.View style={[StyleSheet.absoluteFill, sw.backdrop, { opacity: bgOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        style={[sw.sheet, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 20 }]}
      >
        <View style={sw.handle} />

        <Pressable onPress={onClose} style={sw.closeBtn} hitSlop={16}>
          <View style={sw.closeCircle}>
            <Feather name="x" size={15} color="#5A6C80" />
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
            <View style={sw.glow3} />
            <View style={sw.glow2} />
            <View style={sw.glow1} />
            <View style={sw.iconWrap}>
              {Platform.OS === 'ios' ? (
                <SymbolView name="rosette" tintColor={ACCENT} size={32} />
              ) : (
                <Feather name="award" size={32} color={ACCENT} />
              )}
            </View>
            <Text style={sw.heroTitle}>Investry Pro</Text>
            <Text style={sw.heroSub}>{t.subHeroSub}</Text>
          </View>

          {/* ── Billing toggle ──────────────────────────────── */}
          <View style={sw.toggleWrap}>
            <Pressable
              onPress={() => setPeriod('monthly')}
              style={[sw.toggleBtn, period === 'monthly' && sw.toggleBtnActive]}
            >
              <Text style={[sw.toggleTxt, period === 'monthly' ? sw.toggleTxtOn : sw.toggleTxtOff]}>
                {t.subMonthly}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPeriod('annual')}
              style={[sw.toggleBtn, period === 'annual' && sw.toggleBtnActive]}
            >
              <Text style={[sw.toggleTxt, period === 'annual' ? sw.toggleTxtOn : sw.toggleTxtOff]}>
                {t.subAnnual}
              </Text>
              <View style={sw.saveBadge}>
                <Text style={sw.saveBadgeTxt}>{t.subSave33}</Text>
              </View>
            </Pressable>
          </View>

          {/* ── Plan card ───────────────────────────────────── */}
          <View style={sw.plans}>
            <PlanCard period={period} />
          </View>

          {/* ── Features ────────────────────────────────────── */}
          <View style={sw.featureCard}>
            <Text style={sw.featureTitle}>{t.subWhatsIncluded}</Text>
            {FEATURES.map(f => (
              <FeatureRow key={f.label} icon={f.icon} label={f.label} />
            ))}
          </View>

          {/* ── CTA ─────────────────────────────────────────── */}
          {launchAccess ? (
            <LaunchBadge accent={ACCENT} style={sw.cta} />
          ) : (
            <Pressable
              onPress={() => setShowConfirm(true)}
              disabled={isPurchasing}
              style={({ pressed }) => [sw.cta, { backgroundColor: ACCENT, opacity: pressed ? 0.88 : 1 }]}
            >
              {isPurchasing ? (
                <ActivityIndicator color="#000" />
              ) : (
                <View style={sw.ctaRow}>
                  <View>
                    <Text style={sw.ctaTop}>{t.subContinueWith} Pro</Text>
                    <Text style={sw.ctaBottom}>{currentPrice}</Text>
                  </View>
                  <View style={sw.ctaArrow}>
                    <Feather name="arrow-right" size={17} color="#000" />
                  </View>
                </View>
              )}
            </Pressable>
          )}

          {/* ── Footer ──────────────────────────────────────── */}
          <View style={sw.footer}>
            {!launchAccess && (
              <>
                <Pressable onPress={() => restore()} disabled={isRestoring}>
                  <Text style={sw.footerTxt}>{isRestoring ? t.subRestoring : t.subRestorePurchases}</Text>
                </Pressable>
                <View style={sw.dot} />
              </>
            )}
            <Pressable onPress={() => Linking.openURL('https://investry.app/terms')}>
              <Text style={sw.footerTxt}>{t.subTerms}</Text>
            </Pressable>
            <View style={sw.dot} />
            <Pressable onPress={() => Linking.openURL('https://investry.app/privacy')}>
              <Text style={sw.footerTxt}>{t.subPrivacy}</Text>
            </Pressable>
          </View>

          <Text style={sw.disclaimer}>{t.subDisclaimer}</Text>
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
  backdrop: { backgroundColor: 'rgba(0,0,0,0.75)' },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#060D1A',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderTopWidth: 1, borderColor: '#1C2D40',
    maxHeight: '95%',
  },
  handle: {
    alignSelf: 'center', width: 42, height: 4,
    borderRadius: 2, backgroundColor: '#1C2D40',
    marginTop: 12, marginBottom: 2,
  },
  closeBtn: { position: 'absolute', top: 16, right: 18, zIndex: 10 },
  closeCircle: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#0B1525',
    borderWidth: 1, borderColor: '#1C2D40', alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 20 },

  // Hero
  hero: { alignItems: 'center', paddingTop: 52, paddingBottom: 26, gap: 10 },
  glow3: {
    position: 'absolute', top: 18,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#A47FCA', opacity: 0.04,
  },
  glow2: {
    position: 'absolute', top: 36,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: '#A47FCA', opacity: 0.07,
  },
  glow1: {
    position: 'absolute', top: 50,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#A47FCA', opacity: 0.12,
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 28,
    backgroundColor: '#A47FCA12', borderWidth: 1, borderColor: '#A47FCA35',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 30, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: -1 },
  heroSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#5A6C80', textAlign: 'center' },

  // Toggle
  toggleWrap: {
    flexDirection: 'row', backgroundColor: '#0B1525',
    borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#1C2D40', marginBottom: 14,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, borderRadius: 13, gap: 7,
  },
  toggleBtnActive: { backgroundColor: '#162235' },
  toggleTxt: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  toggleTxtOn: { color: '#fff' },
  toggleTxtOff: { color: '#4A5568' },
  saveBadge: { backgroundColor: '#10B981', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  saveBadgeTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.5 },

  // Plans
  plans: { gap: 10, marginBottom: 16 },

  // Features
  featureCard: {
    backgroundColor: '#0B1525', borderRadius: 20,
    borderWidth: 1, borderColor: '#1C2D40',
    padding: 18, marginBottom: 20,
  },
  featureTitle: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: '#3A4D62',
    letterSpacing: 1, marginBottom: 8,
  },

  // CTA
  cta: {
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 22,
    minHeight: 68, justifyContent: 'center', marginBottom: 18,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaTop: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: -0.3 },
  ctaBottom: { fontSize: 13, fontFamily: 'Inter_500Medium', color: 'rgba(0,0,0,0.55)', marginTop: 2 },
  ctaArrow: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.14)', alignItems: 'center', justifyContent: 'center',
  },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 },
  footerTxt: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#3A4D62' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#1C2D40' },
  disclaimer: {
    fontSize: 10, fontFamily: 'Inter_400Regular', color: '#2A3A4A',
    lineHeight: 15, textAlign: 'center', marginBottom: 4,
  },
});
