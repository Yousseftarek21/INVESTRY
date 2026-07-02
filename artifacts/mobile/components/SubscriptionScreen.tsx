import React, { useRef, useEffect, useState } from 'react';
import {
  Animated, Linking, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, View, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useSubscription, BillingPeriod } from '@/context/SubscriptionContext';

// ─── Feature lists ─────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  { icon: 'layers',      label: 'Unlimited holdings'           },
  { icon: 'tool',        label: 'All 8 financial calculators'  },
  { icon: 'globe',       label: 'Market Intelligence'          },
  { icon: 'bar-chart-2', label: 'Portfolio Analytics'          },
  { icon: 'moon',        label: 'Zakat auto-calculation'       },
] as const;

const PRO_PLUS_EXTRAS = [
  { icon: 'activity',    label: 'Advanced performance charts'  },
  { icon: 'zap',         label: 'EGX real-time data'           },
  { icon: 'download',    label: 'CSV / JSON export'            },
  { icon: 'headphones',  label: 'Priority support'             },
] as const;

// ─── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmPurchase({
  visible, planLabel, priceString, onConfirm, onCancel, isPurchasing, accent,
}: {
  visible: boolean; planLabel: string; priceString: string;
  onConfirm: () => void; onCancel: () => void; isPurchasing: boolean; accent: string;
}) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={cm.overlay}>
        <View style={[cm.card, { borderColor: accent + '35' }]}>
          <View style={[cm.iconWrap, { backgroundColor: accent + '15', borderColor: accent + '30' }]}>
            <Feather name="star" size={28} color={accent} />
          </View>
          <Text style={cm.title}>Confirm Subscription</Text>
          <Text style={cm.msg}>
            {'Subscribing to\n'}
            <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold' }}>{planLabel}</Text>
            {'\nat '}
            <Text style={{ color: accent, fontFamily: 'Inter_700Bold' }}>{priceString}</Text>
          </Text>
          <Pressable
            onPress={onConfirm}
            disabled={isPurchasing}
            style={[cm.confirmBtn, { backgroundColor: accent }]}
          >
            {isPurchasing
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={cm.confirmTxt}>Subscribe Now</Text>
            }
          </Pressable>
          <Pressable onPress={onCancel} style={cm.cancelBtn}>
            <Text style={cm.cancelTxt}>Cancel</Text>
          </Pressable>
          <Text style={cm.legalTxt}>
            Auto-renews. Cancel anytime in your App Store / Google Play settings.
          </Text>
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

function PlanCard({
  planKey, selected, period, onSelect,
}: {
  planKey: 'pro' | 'pro_plus'; selected: boolean; period: BillingPeriod; onSelect: () => void;
}) {
  const { offerings } = useSubscription();
  const product = planKey === 'pro' ? offerings.pro : offerings.proPlus;
  const accent = planKey === 'pro' ? '#D4AC0D' : '#A47FCA';
  const isProPlus = planKey === 'pro_plus';
  const price = period === 'monthly' ? product.priceString : product.annualPriceString;
  const perMonth = period === 'annual'
    ? `≈ ${Math.round(product.annualPrice / 12).toLocaleString('en-EG')} EGP/شهر`
    : null;

  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.975, duration: 70, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scale, { toValue: 1, tension: 300, friction: 10, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    onSelect();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        style={[
          pc.card,
          selected
            ? { borderColor: accent, borderWidth: 2, backgroundColor: accent + '08' }
            : { borderColor: '#1C2D40', borderWidth: 1.5, backgroundColor: '#0B1525' },
        ]}
      >
        {selected && <View style={[pc.topBar, { backgroundColor: accent }]} />}

        {isProPlus && (
          <View style={[pc.popularTag, { backgroundColor: accent }]}>
            <Text style={pc.popularTxt}>MOST POPULAR</Text>
          </View>
        )}

        <View style={pc.row}>
          <View style={pc.info}>
            <View style={[pc.badge, { backgroundColor: accent + '1A', borderColor: accent + '35' }]}>
              <Feather name={planKey === 'pro' ? 'star' : 'zap'} size={10} color={accent} style={{ marginRight: 4 }} />
              <Text style={[pc.badgeTxt, { color: accent }]}>{planKey === 'pro' ? 'PRO' : 'PRO+'}</Text>
            </View>
            <Text style={pc.price}>{price}</Text>
            {perMonth && <Text style={pc.sub}>{perMonth}</Text>}
          </View>
          <View style={[pc.radio, { borderColor: selected ? accent : '#2A3D52' }]}>
            {selected && <View style={[pc.dot, { backgroundColor: accent }]} />}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const pc = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden' },
  topBar: { height: 2, position: 'absolute', top: 0, left: 0, right: 0 },
  popularTag: {
    position: 'absolute', top: 14, right: 14,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  popularTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 0.5 },
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

function FeatureRow({ icon, label, accent, dim }: {
  icon: string; label: string; accent: string; dim?: boolean;
}) {
  return (
    <View style={frow.row}>
      <View style={[frow.icon, { backgroundColor: accent + '18' }]}>
        <Feather name={icon as any} size={13} color={dim ? '#4A5568' : accent} />
      </View>
      <Text style={[frow.label, dim && { color: '#4A5568' }]}>{label}</Text>
      {dim && (
        <View style={[frow.plusTag, { borderColor: '#A47FCA40' }]}>
          <Text style={frow.plusTxt}>PRO+</Text>
        </View>
      )}
    </View>
  );
}

const frow = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  icon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: '#C0CDD8' },
  plusTag: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  plusTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#A47FCA', letterSpacing: 0.4 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

interface SubscriptionScreenProps {
  visible: boolean;
  onClose: () => void;
  initialPlan?: 'pro' | 'pro_plus';
}

export function SubscriptionScreen({ visible, onClose, initialPlan = 'pro' }: SubscriptionScreenProps) {
  const insets = useSafeAreaInsets();
  const { offerings, purchase, restore, isPurchasing, isRestoring } = useSubscription();

  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'pro_plus'>(initialPlan);
  const [showConfirm, setShowConfirm] = useState(false);

  const slideY = useRef(new Animated.Value(700)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedPlan(initialPlan);
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
  }, [visible, initialPlan]);

  const accent = selectedPlan === 'pro' ? '#D4AC0D' : '#A47FCA';
  const product = selectedPlan === 'pro' ? offerings.pro : offerings.proPlus;
  const currentPrice = period === 'monthly' ? product.priceString : product.annualPriceString;

  const handleConfirm = async () => {
    await purchase(selectedPlan, period);
    setShowConfirm(false);
    onClose();
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
          {/* ── Hero ────────────────────────────────────────── */}
          <View style={sw.hero}>
            <View style={sw.glow3} />
            <View style={sw.glow2} />
            <View style={sw.glow1} />
            <View style={sw.iconWrap}>
              <Feather name="star" size={32} color="#D4AC0D" />
            </View>
            <Text style={sw.heroTitle}>Investry Pro</Text>
            <Text style={sw.heroSub}>Unlock your full financial potential</Text>
          </View>

          {/* ── Billing toggle ──────────────────────────────── */}
          <View style={sw.toggleWrap}>
            <Pressable
              onPress={() => setPeriod('monthly')}
              style={[sw.toggleBtn, period === 'monthly' && sw.toggleBtnActive]}
            >
              <Text style={[sw.toggleTxt, period === 'monthly' ? sw.toggleTxtOn : sw.toggleTxtOff]}>
                Monthly
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPeriod('annual')}
              style={[sw.toggleBtn, period === 'annual' && sw.toggleBtnActive]}
            >
              <Text style={[sw.toggleTxt, period === 'annual' ? sw.toggleTxtOn : sw.toggleTxtOff]}>
                Annual
              </Text>
              <View style={sw.saveBadge}>
                <Text style={sw.saveBadgeTxt}>SAVE 33%</Text>
              </View>
            </Pressable>
          </View>

          {/* ── Plan cards ──────────────────────────────────── */}
          <View style={sw.plans}>
            <PlanCard planKey="pro"      selected={selectedPlan === 'pro'}      period={period} onSelect={() => setSelectedPlan('pro')}      />
            <PlanCard planKey="pro_plus" selected={selectedPlan === 'pro_plus'} period={period} onSelect={() => setSelectedPlan('pro_plus')} />
          </View>

          {/* ── Features ────────────────────────────────────── */}
          <View style={sw.featureCard}>
            <Text style={sw.featureTitle}>WHAT'S INCLUDED</Text>
            {PRO_FEATURES.map(f => (
              <FeatureRow key={f.label} icon={f.icon} label={f.label} accent={accent} />
            ))}
            <View style={sw.featureDivider} />
            {PRO_PLUS_EXTRAS.map(f => (
              <FeatureRow
                key={f.label} icon={f.icon} label={f.label}
                accent="#A47FCA"
                dim={selectedPlan === 'pro'}
              />
            ))}
          </View>

          {/* ── CTA ─────────────────────────────────────────── */}
          <Pressable
            onPress={() => setShowConfirm(true)}
            disabled={isPurchasing}
            style={({ pressed }) => [sw.cta, { backgroundColor: accent, opacity: pressed ? 0.88 : 1 }]}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <View style={sw.ctaRow}>
                <View>
                  <Text style={sw.ctaTop}>Continue with {selectedPlan === 'pro' ? 'Pro' : 'Pro+'}</Text>
                  <Text style={sw.ctaBottom}>{currentPrice}</Text>
                </View>
                <View style={sw.ctaArrow}>
                  <Feather name="arrow-right" size={17} color="#000" />
                </View>
              </View>
            )}
          </Pressable>

          {/* ── Footer ──────────────────────────────────────── */}
          <View style={sw.footer}>
            <Pressable onPress={() => restore()} disabled={isRestoring}>
              <Text style={sw.footerTxt}>{isRestoring ? 'Restoring…' : 'Restore Purchases'}</Text>
            </Pressable>
            <View style={sw.dot} />
            <Pressable onPress={() => Linking.openURL('https://invstry.app/terms')}>
              <Text style={sw.footerTxt}>Terms</Text>
            </Pressable>
            <View style={sw.dot} />
            <Pressable onPress={() => Linking.openURL('https://invstry.app/privacy')}>
              <Text style={sw.footerTxt}>Privacy</Text>
            </Pressable>
          </View>

          <Text style={sw.disclaimer}>
            Subscriptions auto-renew. Cancel anytime in your App Store or Google Play settings.
          </Text>
        </ScrollView>
      </Animated.View>

      <ConfirmPurchase
        visible={showConfirm}
        planLabel={product.title}
        priceString={currentPrice}
        accent={accent}
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
    backgroundColor: '#D4AC0D', opacity: 0.04,
  },
  glow2: {
    position: 'absolute', top: 36,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: '#D4AC0D', opacity: 0.07,
  },
  glow1: {
    position: 'absolute', top: 50,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#D4AC0D', opacity: 0.12,
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 28,
    backgroundColor: '#D4AC0D12', borderWidth: 1, borderColor: '#D4AC0D35',
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
  featureDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#1C2D40', marginVertical: 6 },

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
