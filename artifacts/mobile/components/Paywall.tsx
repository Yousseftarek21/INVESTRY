import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useStableGetToken } from '@/hooks/useStableGetToken';
import { apiFetch } from '@/utils/api';
import { useSubscription } from '@/context/SubscriptionContext';

interface FeatureRow { icon: keyof typeof Feather.glyphMap; text: string }

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
  const { paywallVisible, closePaywall, plan, refresh } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');

  const features: FeatureRow[] = [
    { icon: 'briefcase', text: t.subUnlimitedInvestments },
    { icon: 'credit-card', text: t.subUnlimitedCash },
    { icon: 'target', text: t.subUnlimitedGoals },
    { icon: 'bell', text: t.subUnlimitedAlerts },
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

  return (
    <Modal visible={paywallVisible} animationType="slide" transparent onRequestClose={closePaywall}>
      <Pressable style={styles.backdrop} onPress={closePaywall} />
      <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {plan === 'pro' ? t.subCurrentPlanPro : t.subCurrentPlanFree}
          </Text>
          <TouchableOpacity onPress={closePaywall} style={[styles.close, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: colors.text }]}>{t.subUpgradeTo} {t.subComparePro}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t.subHeroSub}</Text>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t.subWhatsIncluded}</Text>
          <View style={[styles.featureList, { borderColor: colors.border }]}>
            {features.map((f, i) => (
              <View key={f.text} style={[styles.featureRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + '18' }]}>
                  <Feather name={f.icon} size={14} color={colors.primary} />
                </View>
                <Text style={[styles.featureText, { color: colors.text }]}>{f.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.billingToggle}>
            {(['monthly', 'annual'] as const).map(period => {
              const active = billingPeriod === period;
              return (
                <TouchableOpacity
                  key={period}
                  style={[styles.billingPill, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
                  onPress={() => { impact(); setBillingPeriod(period); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.billingLabel, { color: active ? colors.primaryForeground : colors.text }]}>
                    {period === 'monthly' ? t.subBillingMonthly : t.subBillingAnnual}
                  </Text>
                  <Text style={[styles.billingPrice, { color: active ? colors.primaryForeground + 'CC' : colors.mutedForeground }]}>
                    {period === 'monthly' ? t.subFromMonthly : t.subFromAnnual}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 10, marginBottom: 4 },
  header: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  eyebrow: { fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.6 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 8 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  featureList: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  featureIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_500Medium', lineHeight: 19 },
  billingToggle: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  billingPill: { flex: 1, borderRadius: 14, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center', gap: 2 },
  billingLabel: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  billingPrice: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center', marginBottom: 12 },
  cta: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16,
  },
  ctaText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
