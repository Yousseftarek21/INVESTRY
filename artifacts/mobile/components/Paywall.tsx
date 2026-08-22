import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useStableGetToken } from '@/hooks/useStableGetToken';
import { apiFetch } from '@/utils/api';
import { useSubscription } from '@/context/SubscriptionContext';

interface FeatureRow { icon: keyof typeof Feather.glyphMap; text: string }

// Kept in sync by hand with subFromMonthly/subFromAnnual's display text
// (i18n/index.ts) — only used here to compute the "save X% vs monthly"
// badge, not sent anywhere; the real amount charged is whatever
// STRIPE_PRICE_ID_MONTHLY/ANNUAL resolve to server-side.
const MONTHLY_PRICE = 89;
const ANNUAL_PRICE = 852; // 71/month × 12
const ANNUAL_SAVINGS_PCT = Math.round((1 - (ANNUAL_PRICE / 12) / MONTHLY_PRICE) * 100);

// Opens the website's Stripe Checkout in an in-app browser — the same
// create-checkout-session route the website itself calls, just triggered
// from the app now. See SubscriptionContext.tsx for why this is a website
// redirect rather than a native In-App Purchase.
export function Paywall() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact } = useHaptic();
  const getToken = useStableGetToken();
  const { paywallVisible, closePaywall, refresh } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');

  const features: FeatureRow[] = [
    { icon: 'briefcase', text: t.subUnlimitedInvestments },
    { icon: 'credit-card', text: t.subUnlimitedCash },
    { icon: 'target', text: t.subUnlimitedGoals },
    { icon: 'bell', text: t.subNotificationsFull },
    { icon: 'cpu', text: t.subAiAssistantFull },
    { icon: 'trending-up', text: t.subMarketIntelligence },
    { icon: 'bar-chart-2', text: t.subPortfolioAnalytics },
  ];

  const subscribe = async () => {
    impact();
    setError(false);
    setLoading(true);
    try {
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
      // SubscriptionContext.
      refresh();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (!paywallVisible) return null;

  const isAnnual = billingPeriod === 'annual';
  const priceWhole = isAnnual ? Math.round(ANNUAL_PRICE / 12) : MONTHLY_PRICE;

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
                  {period === 'annual' && (
                    <View style={[styles.savingsBadge, { backgroundColor: active ? colors.primary : colors.border }]}>
                      <Text style={[styles.savingsBadgeText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                        -{ANNUAL_SAVINGS_PCT}%
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Price card */}
          <View style={[styles.priceCard, { borderColor: colors.primary }]}>
            <ExpoLinearGradient
              colors={[colors.primary + '26', colors.primary + '08']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {isAnnual && (
              <View style={[styles.ribbon, { backgroundColor: colors.primary }]}>
                <Text style={[styles.ribbonText, { color: colors.primaryForeground }]}>-{ANNUAL_SAVINGS_PCT}%</Text>
              </View>
            )}

            <View style={styles.planRow}>
              <View style={[styles.planIcon, { backgroundColor: colors.primary + '22' }]}>
                <Feather name="award" size={13} color={colors.primary} />
              </View>
              <Text style={[styles.planName, { color: colors.primary }]}>{t.subComparePro}</Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={[styles.priceCurrency, { color: colors.text }]}>EGP</Text>
              <Text style={[styles.priceWhole, { color: colors.text }]}>
                {priceWhole}
              </Text>
              <Text style={[styles.pricePeriod, { color: colors.mutedForeground }]}>/{t.subBillingMonthly.toLowerCase()}</Text>
            </View>
            {isAnnual && (
              <Text style={[styles.billedAnnually, { color: colors.mutedForeground }]}>
                {t.subFromAnnual} · {t.subSaveVsMonthly}
              </Text>
            )}
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>{t.subHeroSub}</Text>

            <View style={[styles.divider, { borderColor: colors.primary + '30' }]} />

            {features.map(f => (
              <View key={f.text} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.green + '20' }]}>
                  <Feather name="check" size={11} color={colors.green} />
                </View>
                <Text style={[styles.featureText, { color: colors.text }]}>{f.text}</Text>
              </View>
            ))}
          </View>

          {error && (
            <Text style={[styles.errorText, { color: colors.red }]}>{t.subCheckoutErrorDesc}</Text>
          )}

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={subscribe}
            disabled={loading}
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

  priceCard: { borderRadius: 22, borderWidth: 1.5, padding: 20, paddingTop: 22, marginBottom: 16, overflow: 'hidden' },
  ribbon: { position: 'absolute', top: 14, end: 14, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  ribbonText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  planIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: 13, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  priceCurrency: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  priceWhole: { fontSize: 44, fontFamily: 'Inter_700Bold', letterSpacing: -1.2 },
  pricePeriod: { fontSize: 15, fontFamily: 'Inter_400Regular', marginBottom: 7 },
  billedAnnually: { fontSize: 12.5, fontFamily: 'Inter_500Medium', marginTop: 3 },
  heroSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginTop: 12 },
  divider: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 16 },

  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  featureIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_500Medium', lineHeight: 19 },

  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center', marginBottom: 12 },
  cta: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16,
  },
  ctaText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
