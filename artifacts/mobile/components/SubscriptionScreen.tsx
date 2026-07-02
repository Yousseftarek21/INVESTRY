/**
 * Investry Pro — Subscription Paywall
 * Follows Apple HIG & Google Material Design 3 guidelines.
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  Animated, Linking, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, View, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSubscription, BillingPeriod } from '@/context/SubscriptionContext';

// ─── Feature list ─────────────────────────────────────────────────────────────

const FEATURES = [
  { label: 'Portfolio tracking',         free: true,  pro: true,  proPlus: true  },
  { label: 'Live market prices',         free: true,  pro: true,  proPlus: true  },
  { label: 'Up to 10 holdings',          free: true,  pro: true,  proPlus: true  },
  { label: 'All 8 financial calculators',free: false, pro: true,  proPlus: true  },
  { label: 'Unlimited holdings',         free: false, pro: true,  proPlus: true  },
  { label: 'Market Intelligence',        free: false, pro: true,  proPlus: true  },
  { label: 'Portfolio Analytics',        free: false, pro: true,  proPlus: true  },
  { label: 'Zakat auto-calculation',     free: false, pro: true,  proPlus: true  },
  { label: 'Advanced performance charts',free: false, pro: false, proPlus: true  },
  { label: 'EGX real-time data',         free: false, pro: false, proPlus: true  },
  { label: 'CSV / JSON export',          free: false, pro: false, proPlus: true  },
  { label: 'Priority support',           free: false, pro: false, proPlus: true  },
] as const;

// ─── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmPurchase({
  visible, planLabel, priceString, onConfirm, onCancel, isPurchasing,
}: {
  visible: boolean; planLabel: string; priceString: string;
  onConfirm: () => void; onCancel: () => void; isPurchasing: boolean;
}) {
  const colors = useColors();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={cp.overlay}>
        <View style={[cp.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={cp.iconWrap}>
            <Feather name="star" size={26} color="#D4AC0D" />
          </View>
          <Text style={[cp.title, { color: colors.text }]}>Confirm Purchase</Text>
          <Text style={[cp.msg, { color: colors.mutedForeground }]}>
            You're about to subscribe to{'\n'}
            <Text style={{ color: colors.text, fontFamily: 'Inter_700Bold' }}>{planLabel}</Text>
            {'\n'}at <Text style={{ color: '#D4AC0D', fontFamily: 'Inter_700Bold' }}>{priceString}</Text>
          </Text>
          <View style={cp.row}>
            <Pressable
              onPress={onCancel}
              style={[cp.btn, { backgroundColor: colors.muted }]}
            >
              <Text style={[cp.btnTxt, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[cp.btn, { backgroundColor: '#D4AC0D' }]}
              disabled={isPurchasing}
            >
              {isPurchasing
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={[cp.btnTxt, { color: '#000', fontFamily: 'Inter_700Bold' }]}>Subscribe</Text>
              }
            </Pressable>
          </View>
          <Text style={[cp.legal, { color: colors.mutedForeground }]}>
            Payment will be charged to your Apple ID / Google Play account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
const cp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { borderRadius: 24, borderWidth: 1, padding: 24, width: '100%', alignItems: 'center', gap: 14 },
  iconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#D4AC0D18', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  msg: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, width: '100%' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  btnTxt: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  legal: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 15, textAlign: 'center' },
});

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  planKey, selected, period, onSelect,
}: {
  planKey: 'pro' | 'pro_plus';
  selected: boolean;
  period: BillingPeriod;
  onSelect: () => void;
}) {
  const colors = useColors();
  const { offerings } = useSubscription();
  const product = planKey === 'pro' ? offerings.pro : offerings.proPlus;
  const accentColor = planKey === 'pro' ? '#D4AC0D' : '#A47FCA';
  const label = planKey === 'pro' ? 'PRO' : 'PRO+';
  const isPopular = planKey === 'pro_plus';
  const price = period === 'monthly' ? product.priceString : product.annualPriceString;
  const perMonth = period === 'annual'
    ? `$${(product.annualPrice / 12).toFixed(2)}/mo`
    : product.priceString;

  return (
    <Pressable
      onPress={onSelect}
      style={[
        pc.card,
        { backgroundColor: colors.card, borderColor: selected ? accentColor : colors.border },
        selected && { borderWidth: 2 },
      ]}
    >
      {/* Top accent */}
      <View style={[pc.topAccent, { backgroundColor: accentColor }]} />

      {/* Popular badge */}
      {isPopular && (
        <View style={[pc.popularBadge, { backgroundColor: accentColor }]}>
          <Text style={pc.popularTxt}>MOST POPULAR</Text>
        </View>
      )}

      {/* Plan label */}
      <View style={[pc.labelWrap, { backgroundColor: accentColor + '18' }]}>
        <Feather name={planKey === 'pro' ? 'star' : 'zap'} size={12} color={accentColor} style={{ marginRight: 5 }} />
        <Text style={[pc.labelTxt, { color: accentColor }]}>{label}</Text>
      </View>

      {/* Price */}
      <Text style={[pc.price, { color: colors.text }]}>{price}</Text>
      {period === 'annual' && (
        <Text style={[pc.perMonth, { color: colors.mutedForeground }]}>{perMonth} billed annually</Text>
      )}

      {/* Selected indicator */}
      <View style={[pc.radioOuter, { borderColor: selected ? accentColor : colors.border }]}>
        {selected && <View style={[pc.radioInner, { backgroundColor: accentColor }]} />}
      </View>
    </Pressable>
  );
}
const pc = StyleSheet.create({
  card: {
    flex: 1, borderRadius: 18, borderWidth: 1,
    overflow: 'hidden', alignItems: 'center', paddingTop: 18, paddingBottom: 16, paddingHorizontal: 12, gap: 8,
  },
  topAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  popularBadge: { position: 'absolute', top: 12, right: -1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  popularTxt: { fontSize: 8, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 0.5 },
  labelWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  labelTxt: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  price: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, textAlign: 'center' },
  perMonth: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
});

// ─── Feature row ──────────────────────────────────────────────────────────────

function FeatureRow({
  label, hasFree, hasPro, hasProPlus,
}: {
  label: string; hasFree: boolean; hasPro: boolean; hasProPlus: boolean;
}) {
  const colors = useColors();
  const Check = ({ has, color }: { has: boolean; color: string }) => (
    <View style={fr.checkCell}>
      {has
        ? <Feather name="check" size={14} color={color} />
        : <View style={[fr.dash, { backgroundColor: colors.border }]} />
      }
    </View>
  );
  return (
    <View style={[fr.row, { borderBottomColor: colors.border }]}>
      <Text style={[fr.label, { color: colors.textSecondary ?? colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
      <Check has={hasFree}    color={colors.green} />
      <Check has={hasPro}     color="#D4AC0D" />
      <Check has={hasProPlus} color="#A47FCA" />
    </View>
  );
}
const fr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  checkCell: { width: 52, alignItems: 'center' },
  dash: { width: 14, height: 2, borderRadius: 1 },
});

// ─── Main paywall ─────────────────────────────────────────────────────────────

interface SubscriptionScreenProps {
  visible: boolean;
  onClose: () => void;
  initialPlan?: 'pro' | 'pro_plus';
}

export function SubscriptionScreen({ visible, onClose, initialPlan = 'pro' }: SubscriptionScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { offerings, purchase, restore, isPurchasing, isRestoring, plan } = useSubscription();

  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'pro_plus'>(initialPlan);
  const [showConfirm, setShowConfirm] = useState(false);

  // Slide-up animation
  const slideY = useRef(new Animated.Value(600)).current;
  useEffect(() => {
    if (visible) {
      setSelectedPlan(initialPlan);
      Animated.spring(slideY, {
        toValue: 0, damping: 22, stiffness: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else {
      slideY.setValue(600);
    }
  }, [visible, initialPlan]);

  const product = selectedPlan === 'pro' ? offerings.pro : offerings.proPlus;
  const currentPrice = period === 'monthly' ? product.priceString : product.annualPriceString;
  const planLabel = product.title;

  const handleContinue = () => setShowConfirm(true);

  const handleConfirm = async () => {
    await purchase(selectedPlan, period);
    setShowConfirm(false);
    onClose();
  };

  const handleRestore = async () => {
    await restore();
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={[sw.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <Animated.View
          style={[
            sw.sheet,
            { backgroundColor: colors.background, transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 20 },
          ]}
        >
          {/* Drag handle */}
          <View style={[sw.handle, { backgroundColor: colors.border }]} />

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Close */}
            <Pressable onPress={onClose} style={sw.closeBtn} hitSlop={12}>
              <View style={[sw.closeCircle, { backgroundColor: colors.muted }]}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </View>
            </Pressable>

            {/* Hero */}
            <View style={sw.hero}>
              <View style={[sw.crownWrap, { backgroundColor: '#D4AC0D18', borderColor: '#D4AC0D30' }]}>
                <Feather name="star" size={32} color="#D4AC0D" />
              </View>
              <Text style={[sw.heroTitle, { color: colors.text }]}>Investry Pro</Text>
              <Text style={[sw.heroSub, { color: colors.mutedForeground }]}>
                Unlock your financial intelligence
              </Text>
            </View>

            {/* Period toggle */}
            <View style={[sw.periodWrap, { backgroundColor: colors.muted }]}>
              <Pressable
                onPress={() => setPeriod('monthly')}
                style={[sw.periodBtn, period === 'monthly' && { backgroundColor: colors.card }]}
              >
                <Text style={[sw.periodTxt, { color: period === 'monthly' ? colors.text : colors.mutedForeground }]}>
                  Monthly
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPeriod('annual')}
                style={[sw.periodBtn, period === 'annual' && { backgroundColor: colors.card }]}
              >
                <Text style={[sw.periodTxt, { color: period === 'annual' ? colors.text : colors.mutedForeground }]}>
                  Annual
                </Text>
                <View style={sw.saveBadge}>
                  <Text style={sw.saveTxt}>SAVE 33%</Text>
                </View>
              </Pressable>
            </View>

            {/* Plan cards */}
            <View style={sw.planRow}>
              <PlanCard
                planKey="pro"
                selected={selectedPlan === 'pro'}
                period={period}
                onSelect={() => setSelectedPlan('pro')}
              />
              <PlanCard
                planKey="pro_plus"
                selected={selectedPlan === 'pro_plus'}
                period={period}
                onSelect={() => setSelectedPlan('pro_plus')}
              />
            </View>

            {/* Feature comparison */}
            <View style={sw.tableSection}>
              <Text style={[sw.tableTitle, { color: colors.text }]}>What's included</Text>

              {/* Table header */}
              <View style={[sw.tableHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }} />
                <View style={fr.checkCell}>
                  <Text style={[sw.colHead, { color: colors.mutedForeground }]}>Free</Text>
                </View>
                <View style={fr.checkCell}>
                  <Text style={[sw.colHead, { color: '#D4AC0D' }]}>Pro</Text>
                </View>
                <View style={fr.checkCell}>
                  <Text style={[sw.colHead, { color: '#A47FCA' }]}>Pro+</Text>
                </View>
              </View>

              {FEATURES.map(f => (
                <FeatureRow
                  key={f.label}
                  label={f.label}
                  hasFree={f.free}
                  hasPro={f.pro}
                  hasProPlus={f.proPlus}
                />
              ))}
            </View>

            {/* CTA */}
            <Pressable
              onPress={handleContinue}
              disabled={isPurchasing}
              style={({ pressed }) => [
                sw.cta,
                { backgroundColor: selectedPlan === 'pro' ? '#D4AC0D' : '#A47FCA', opacity: pressed ? 0.88 : 1 },
              ]}
            >
              {isPurchasing
                ? <ActivityIndicator color="#000" />
                : (
                  <>
                    <Feather name="zap" size={16} color="#000" style={{ marginRight: 8 }} />
                    <Text style={sw.ctaTxt}>
                      Continue with {planLabel} · {currentPrice}
                    </Text>
                  </>
                )
              }
            </Pressable>

            {/* Footer links */}
            <View style={sw.footer}>
              <Pressable onPress={handleRestore} disabled={isRestoring}>
                <Text style={[sw.footerLink, { color: colors.mutedForeground }]}>
                  {isRestoring ? 'Restoring…' : 'Restore Purchases'}
                </Text>
              </Pressable>
              <Text style={[sw.footerDot, { color: colors.border }]}>·</Text>
              <Pressable onPress={() => Linking.openURL('https://invstry.app/terms')}>
                <Text style={[sw.footerLink, { color: colors.mutedForeground }]}>Terms</Text>
              </Pressable>
              <Text style={[sw.footerDot, { color: colors.border }]}>·</Text>
              <Pressable onPress={() => Linking.openURL('https://invstry.app/privacy')}>
                <Text style={[sw.footerLink, { color: colors.mutedForeground }]}>Privacy</Text>
              </Pressable>
            </View>

            <Text style={[sw.disclaimer, { color: colors.mutedForeground }]}>
              Subscriptions auto-renew unless cancelled 24 hours before renewal. Manage in App Store / Google Play Settings.
            </Text>
          </ScrollView>
        </Animated.View>
      </View>

      <ConfirmPurchase
        visible={showConfirm}
        planLabel={planLabel}
        priceString={currentPrice}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        isPurchasing={isPurchasing}
      />
    </Modal>
  );
}

const sw = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '94%' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 10 },

  closeBtn: { position: 'absolute', top: 16, right: 20, zIndex: 10 },
  closeCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', paddingTop: 48, paddingBottom: 24, gap: 10, paddingHorizontal: 24 },
  crownWrap: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  heroTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  heroSub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  periodWrap: { flexDirection: 'row', borderRadius: 14, padding: 4, marginHorizontal: 20, marginBottom: 16 },
  periodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 11, gap: 6 },
  periodTxt: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  saveBadge: { backgroundColor: '#10B981', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  saveTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.5 },

  planRow: { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginBottom: 28 },

  tableSection: { marginHorizontal: 20, marginBottom: 28 },
  tableTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 14 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  colHead: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textAlign: 'center' },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, borderRadius: 16, paddingVertical: 17, gap: 4, marginBottom: 16,
  },
  ctaTxt: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#000' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  footerLink: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  footerDot: { fontSize: 12 },

  disclaimer: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 15, textAlign: 'center', marginHorizontal: 24, marginBottom: 8 },
});
