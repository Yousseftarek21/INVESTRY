import React, { useEffect, useRef, useState } from 'react';
import { Animated, ActivityIndicator, Alert, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage } from 'react-native-purchases';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useStableGetToken } from '@/hooks/useStableGetToken';
import { apiFetch } from '@/utils/api';
import { useSubscription } from '@/context/SubscriptionContext';
import { isIOSIAPAvailable, REVENUECAT_ENTITLEMENT_ID } from '@/utils/revenuecat';
import { getPaywallHighlights } from '@/constants/subscriptionFeatures';

// Fallback display numbers for the Android/web Stripe path only — kept in
// sync by hand with subFromMonthly/subFromAnnual's display text
// (i18n/index.ts). On iOS the real price always comes from the App Store via
// RevenueCat (pkg.product.priceString/pricePerMonthString below), never
// these constants — Apple requires showing its own store price, not a
// custom one.
const MONTHLY_PRICE = 79;
const ANNUAL_PRICE = 799; // ~66.6/month × 12
const FALLBACK_SAVINGS_PCT = Math.round((1 - (ANNUAL_PRICE / 12) / MONTHLY_PRICE) * 100);

// iOS: native In-App Purchase via RevenueCat — required by App Store
// Guideline 3.1.1 for an app that unlocks paid digital features (this app
// was rejected twice for a website-checkout redirect; see
// SubscriptionContext.tsx for the full history). Android/web: the existing
// Stripe website-checkout redirect, which isn't subject to that rule.
export function Paywall() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact } = useHaptic();
  const getToken = useStableGetToken();
  const { paywallVisible, closePaywall, refresh, markProLocally } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');

  const iosIAP = isIOSIAPAvailable();
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null);
  const [annualPkg, setAnnualPkg] = useState<PurchasesPackage | null>(null);
  const [offeringsLoading, setOfferingsLoading] = useState(iosIAP);
  const [offeringsError, setOfferingsError] = useState(false);

  // Same "physical membership card" signature as TierCard.tsx's own sweep
  // (Pro is the thing that ultimately unlocks a tier card, so the two
  // moments deliberately share a visual language) — a one-time shine sweep
  // across the price card the first time the paywall opens, not looped.
  const shine = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!paywallVisible) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    shine.setValue(0);
    Animated.timing(shine, {
      toValue: 1, duration: 1300, delay: 200,
      easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, [paywallVisible, shine]);

  useEffect(() => {
    if (!iosIAP || !paywallVisible) return;
    let active = true;
    setOfferingsLoading(true);
    setOfferingsError(false);
    Purchases.getOfferings()
      .then((offerings) => {
        if (!active) return;
        const current = offerings.current;
        setMonthlyPkg(current?.monthly ?? null);
        setAnnualPkg(current?.annual ?? null);
        if (!current?.monthly && !current?.annual) setOfferingsError(true);
      })
      .catch(() => { if (active) setOfferingsError(true); })
      .finally(() => { if (active) setOfferingsLoading(false); });
    return () => { active = false; };
  }, [iosIAP, paywallVisible]);

  const highlights = getPaywallHighlights(t);

  const subscribeViaStripe = async () => {
    const token = await getToken();
    if (!token) { setError(true); return; }
    const res = await apiFetch('/api/stripe/create-checkout-session', token, {
      method: 'POST',
      body: JSON.stringify({ billingPeriod }),
    });
    if (!res.ok) { setError(true); return; }
    const { url } = (await res.json()) as { url?: string };
    if (!url) { setError(true); return; }
    await WebBrowser.openBrowserAsync(url);
    // The user just came back from checkout (completed, cancelled, or
    // just closed it) — re-check entitlement right away rather than
    // waiting for the next app-foreground refetch that already exists in
    // SubscriptionContext. No client-side proof of payment exists here
    // (unlike IAP's customerInfo), so this can't optimistically unlock —
    // just keep polling until Stripe's webhook lands.
    reconcileWithServer();
  };

  // RevenueCat's own webhook to our backend is async — it can take a few
  // seconds to land, so a single refresh() right after purchasing can still
  // read the old "free" row. markProLocally() (called by the caller before
  // this runs) already unlocked the UI instantly off StoreKit's own
  // confirmation; this just keeps nudging the server-backed copy until it
  // catches up, so a later cold start reads real, reconciled server state
  // instead of a value that only ever existed on this device.
  const reconcileWithServer = () => {
    refresh();
    [3000, 8000, 15000].forEach(delay => setTimeout(refresh, delay));
  };

  const subscribeViaIAP = async () => {
    const pkg = billingPeriod === 'annual' ? annualPkg : monthlyPkg;
    if (!pkg) { setError(true); return; }
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]) {
        markProLocally(billingPeriod);
        closePaywall();
        Alert.alert(t.subPaymentSuccessTitle, t.subPaymentSuccessDesc);
        reconcileWithServer();
      }
    } catch (err: any) {
      // A user tapping Cancel on the App Store's own purchase sheet isn't an
      // error state — stay on the paywall quietly instead of showing a banner.
      if (err?.code !== PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        setError(true);
      }
    }
  };

  const subscribe = async () => {
    impact();
    setError(false);
    setLoading(true);
    try {
      if (iosIAP) await subscribeViaIAP();
      else await subscribeViaStripe();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Apple requires a way to restore a prior purchase without paying again
  // (e.g. reinstalling, or a family-shared subscription).
  const restore = async () => {
    if (restoring) return;
    impact();
    setError(false);
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]) {
        markProLocally(billingPeriod);
        closePaywall();
        Alert.alert(t.subRestoreSuccessTitle, t.subRestoreSuccessDesc);
        reconcileWithServer();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setRestoring(false);
    }
  };

  if (!paywallVisible) return null;

  const isAnnual = billingPeriod === 'annual';
  const activePkg = iosIAP ? (isAnnual ? annualPkg : monthlyPkg) : null;

  // The big number: real App Store per-month-equivalent price on iOS (once
  // loaded), the Stripe display number everywhere else.
  const iosPriceWhole = activePkg ? (activePkg.product.pricePerMonthString ?? activePkg.product.priceString) : null;
  const stripePriceWhole = isAnnual ? Math.round(ANNUAL_PRICE / 12) : MONTHLY_PRICE;

  const savingsPct = iosIAP
    ? (monthlyPkg && annualPkg && monthlyPkg.product.price > 0
      ? Math.round((1 - (annualPkg.product.price / 12) / monthlyPkg.product.price) * 100)
      : null)
    : FALLBACK_SAVINGS_PCT;

  const canSubscribe = iosIAP ? (!!activePkg && !offeringsLoading) : true;
  const showLoadingPrice = iosIAP && offeringsLoading;
  const showUnavailable = iosIAP && !offeringsLoading && (offeringsError || !activePkg);

  return (
    <Modal visible={paywallVisible} animationType="slide" transparent onRequestClose={closePaywall}>
      <Pressable style={styles.backdrop} onPress={closePaywall} />
      <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t.subUpgradeTo} {t.subComparePro}</Text>
          <TouchableOpacity onPress={closePaywall} style={[styles.close, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Billing toggle */}
          <View style={[styles.billingToggle, { backgroundColor: colors.muted }]}>
            {(['annual', 'monthly'] as const).map(period => {
              const active = billingPeriod === period;
              return (
                <TouchableOpacity
                  key={period}
                  style={[styles.billingPill, active && { backgroundColor: colors.card }]}
                  onPress={() => { impact(); setBillingPeriod(period); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.billingLabel, { color: active ? colors.text : colors.mutedForeground }]}>
                    {period === 'monthly' ? t.subBillingMonthly : t.subBillingAnnual}
                  </Text>
                  {period === 'annual' && !!savingsPct && savingsPct > 0 && (
                    <View style={[styles.savingsBadge, { backgroundColor: active ? colors.primary : colors.border }]}>
                      <Text style={[styles.savingsBadgeText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                        -{savingsPct}%
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Price card — the same "physical membership card" language as
              TierCard.tsx (rich gradient, scrim for legibility, a one-time
              shine sweep), not that card's tier palette specifically (Pro
              is its own concept, orthogonal to net-worth Tiers) but the
              app's own gold identity (colors.primary) carried through as a
              foil gradient instead of the flat bordered box this used to
              be. */}
          <View style={styles.priceCardWrap}>
            <ExpoLinearGradient
              colors={[colors.primary, '#C79A2E', '#241C08']}
              start={{ x: 0.05, y: 0 }}
              end={{ x: 0.95, y: 1 }}
              style={styles.priceCard}
            >
              <ExpoLinearGradient
                colors={['rgba(0,0,0,0.04)', 'rgba(0,0,0,0.38)']}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.sweep,
                  {
                    transform: [
                      { rotate: '18deg' },
                      { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-260, 340] }) },
                    ],
                  },
                ]}
              />

              {isAnnual && !!savingsPct && savingsPct > 0 && (
                <View style={styles.ribbon}>
                  <Text style={styles.ribbonText}>-{savingsPct}%</Text>
                </View>
              )}

              {/* Just the issuer mark now — a second "PRO" badge used to sit
                  here too, pinned to this row's right edge, which overlapped
                  the savings ribbon (also top-right, absolutely positioned)
                  whenever both were showing. This card already reads as the
                  Pro plan (the sheet's own title says "Upgrade to Pro"), so
                  the ribbon keeps that corner instead of contesting it. */}
              <View style={styles.planRow}>
                <Text style={styles.issuer}>INVESTRY</Text>
              </View>

              <View style={styles.priceRow}>
                {showLoadingPrice ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : showUnavailable ? (
                  <Text style={styles.pricePeriod}>{t.subPricingUnavailable}</Text>
                ) : (
                  <>
                    {!iosIAP && <Text style={styles.priceCurrency}>EGP</Text>}
                    <Text style={styles.priceWhole}>
                      {iosIAP ? iosPriceWhole : stripePriceWhole}
                    </Text>
                    <Text style={styles.pricePeriod}>/{t.subBillingMonthly.toLowerCase()}</Text>
                  </>
                )}
              </View>
              {isAnnual && !showLoadingPrice && !showUnavailable && (
                <Text style={styles.billedAnnually}>
                  {iosIAP && activePkg ? activePkg.product.priceString : t.subFromAnnual} · {t.subSaveVsMonthly}
                </Text>
              )}
              <Text style={styles.heroSub}>{t.subHeroSub}</Text>

              <View style={styles.divider} />

              {highlights.map(f => (
                <View key={f.text} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Feather name="check" size={11} color="#2b2308" />
                  </View>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </ExpoLinearGradient>
          </View>

          {/* Most of the app isn't a paywall at all — make that explicit
              rather than letting the checklist above read as "everything
              is locked." */}
          <View style={styles.alsoFreeSection}>
            <Text style={[styles.compareSectionTitle, { color: colors.mutedForeground }]}>{t.subAlsoFreeTitle}</Text>
            <View style={styles.alsoFreeGrid}>
              {[t.financialToolsTitle, t.markets, t.dailyHistoryLabel, t.leaderboardTitle, t.referralScreenTitle, t.shariahScreening, t.tbillsCalculator].map(item => (
                <View key={item} style={styles.alsoFreeChip}>
                  <Feather name="check" size={10} color={colors.mutedForeground} />
                  <Text style={[styles.alsoFreeText, { color: colors.mutedForeground }]}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {error && (
            <Text style={[styles.errorText, { color: colors.red }]}>{t.subCheckoutErrorDesc}</Text>
          )}

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.primary, opacity: (loading || !canSubscribe) ? 0.7 : 1 }]}
            onPress={subscribe}
            disabled={loading || !canSubscribe}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
                {t.subUpgradeTo} {t.subComparePro}
              </Text>
            )}
          </TouchableOpacity>

          {iosIAP && (
            <TouchableOpacity onPress={restore} disabled={restoring} style={styles.restoreBtn} activeOpacity={0.7}>
              {restoring ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : (
                <Text style={[styles.restoreText, { color: colors.mutedForeground }]}>{t.subRestorePurchases}</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 10, marginBottom: 4 },
  header: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 6 },

  billingToggle: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 16 },
  billingPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, paddingVertical: 10 },
  billingLabel: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  savingsBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  savingsBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },

  // Wrapped separately from the gradient itself so the shadow (which needs
  // overflow: visible) and the gradient's own overflow: hidden (needed to
  // clip the sweep + rounded corners) don't fight on the same view.
  priceCardWrap: {
    borderRadius: 24, marginBottom: 16,
    shadowColor: '#C79A2E', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  priceCard: { borderRadius: 24, padding: 20, paddingTop: 22, overflow: 'hidden' },
  sweep: { position: 'absolute', top: -100, bottom: -100, width: 100, backgroundColor: 'rgba(255,255,255,0.16)' },
  ribbon: { position: 'absolute', top: 14, end: 14, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: '#fff' },
  ribbonText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#241C08' },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  issuer: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 2.2, color: 'rgba(255,255,255,0.92)' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, minHeight: 44 },
  priceCurrency: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 6, color: '#fff' },
  priceWhole: { fontSize: 36, fontFamily: 'Inter_800ExtraBold', letterSpacing: -1, color: '#fff' },
  pricePeriod: { fontSize: 15, fontFamily: 'Inter_400Regular', marginBottom: 7, color: 'rgba(255,255,255,0.75)' },
  billedAnnually: { fontSize: 12.5, fontFamily: 'Inter_500Medium', marginTop: 3, color: 'rgba(255,255,255,0.75)' },
  heroSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginTop: 12, color: 'rgba(255,255,255,0.75)' },
  divider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.28)', marginVertical: 16 },

  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  featureIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  featureText: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_500Medium', lineHeight: 19, color: 'rgba(255,255,255,0.94)' },

  alsoFreeSection: { marginBottom: 16 },
  compareSectionTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 },
  alsoFreeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  alsoFreeChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  alsoFreeText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center', marginBottom: 12 },
  cta: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16,
  },
  ctaText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  restoreBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  restoreText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
