import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Purchases from 'react-native-purchases';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { REVENUECAT_ENTITLEMENT_ID } from '@/utils/revenuecat';
import { getPaywallHighlights } from '@/constants/subscriptionFeatures';
import { PlanCompareRow } from '@/components/PlanCompareRow';

interface Props { visible: boolean; onClose: () => void }

// Shown before handing an iOS Pro subscriber off to Apple's own
// subscription-management screen — Apple requires the actual cancel action
// to happen in their system settings (no app can process it directly), but
// there's no reason the user should leave the app with zero context first.
// This reads the real entitlement straight from RevenueCat's CustomerInfo
// (plan, renewal date, auto-renew status) so what they see here is always
// accurate, not a guess.
export function ManageSubscriptionSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [willRenew, setWillRenew] = useState<boolean | null>(null);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const [billingPeriodLabel, setBillingPeriodLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setWillRenew(null);
    setRenewalDate(null);
    setBillingPeriodLabel(null);
    Purchases.getCustomerInfo()
      .then(info => {
        if (!active) return;
        const ent = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
        if (ent) {
          setWillRenew(ent.willRenew);
          setRenewalDate(ent.expirationDate);
          setBillingPeriodLabel(ent.productIdentifier.includes('annual') ? t.subBillingAnnual : t.subBillingMonthly);
        }
      })
      .catch(() => null)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const openAppleSettings = () => {
    impact();
    Linking.openURL('itms-apps://apps.apple.com/account/subscriptions').catch(() => null);
  };

  const formattedDate = renewalDate
    ? new Date(renewalDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const features = getPaywallHighlights(t);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t.subYourSubscription}</Text>
          <TouchableOpacity onPress={onClose} style={[styles.close, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.planCard, { borderColor: colors.primary + '3A', backgroundColor: colors.primary + '10' }]}>
              <View style={[styles.planIcon, { backgroundColor: colors.primary + '22' }]}>
                <Feather name="award" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planName, { color: colors.text }]}>
                  {t.subComparePro}{billingPeriodLabel ? ` — ${billingPeriodLabel}` : ''}
                </Text>
                <Text style={[styles.planStatus, { color: colors.primary }]}>{t.subStatusActive}</Text>
              </View>
            </View>

            {formattedDate && (
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>
                  {willRenew ? t.subRenewsOn : t.subExpiresOn}
                </Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>{formattedDate}</Text>
              </View>
            )}

            {willRenew !== null && (
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{t.subAutoRenew}</Text>
                <Text style={[styles.rowValue, { color: willRenew ? colors.green : colors.red }]}>
                  {willRenew ? t.subAutoRenewOn : t.subAutoRenewOff}
                </Text>
              </View>
            )}

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t.subWhatsIncluded}</Text>
            {features.map(f => (
              <View key={f.text} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="check" size={11} color={colors.primary} />
                </View>
                <Text style={[styles.featureText, { color: colors.text }]}>{f.text}</Text>
              </View>
            ))}

            {/* Same full comparison shown on the Paywall — a Pro subscriber
                should be able to see exactly what they're getting for the
                price too, not just a shorter highlights list. */}
            <View style={[styles.compareCard, { borderColor: colors.border }]}>
              <View style={styles.compareHeaderRow}>
                <View style={{ flex: 1.6 }} />
                <Text style={[styles.compareHeaderLabel, { color: colors.mutedForeground }]}>{t.subPlanFree}</Text>
                <Text style={[styles.compareHeaderLabel, { color: colors.primary }]}>{t.subComparePro}</Text>
              </View>
              <PlanCompareRow label={t.holdings} freeValue={t.subCompareHoldingsFree} proValue={t.subCompareHoldingsPro} />
              <PlanCompareRow label={t.cashAccounts} freeValue={t.subCompareCashFree} proValue={t.subCompareCashPro} />
              <PlanCompareRow label={t.subRecurringIncomeFull} freeValue={t.subCompareRecurringFree} proValue={t.subCompareRecurringPro} />
              <PlanCompareRow label={t.goals} freeValue={t.subCompareGoalsFree} proValue={t.subCompareGoalsPro} />
              <PlanCompareRow label={t.priceAlertsLabel} freeValue={t.subComparePriceAlertsFree} proValue={t.subComparePriceAlertsPro} />
              <PlanCompareRow label={t.settingsCatNotifications} freeValue={t.subCompareNotificationsFree} proValue={t.subCompareNotificationsPro} locked />
              <PlanCompareRow label={t.aiAssistantTitle} freeValue={t.subCompareAiFree} proValue={t.subCompareAiPro} locked />
              <PlanCompareRow label={t.subMarketIntelligence} freeValue={t.subCompareMarketIntelFree} proValue={t.subCompareMarketIntelPro} locked />
              <PlanCompareRow label={t.subPortfolioAnalytics} freeValue={t.subComparePortfolioAnalyticsFree} proValue={t.subComparePortfolioAnalyticsPro} locked />
              <PlanCompareRow label={t.fixPlanTitle} freeValue={t.subCompareFixPlanFree} proValue={t.subCompareFixPlanPro} locked />
            </View>

            <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.subManageHint}</Text>

            <TouchableOpacity
              style={[styles.cta, { backgroundColor: colors.red + '15', borderColor: colors.red + '35' }]}
              onPress={openAppleSettings}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaText, { color: colors.red }]}>{t.subCancelSubscription}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryCta}
              onPress={openAppleSettings}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryCtaText, { color: colors.mutedForeground }]}>{t.subManageInAppStore}</Text>
              <Feather name="external-link" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 10, marginBottom: 4 },
  header: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 6 },
  bodyContent: { gap: 4, paddingBottom: 8 },

  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1.5, padding: 16, marginBottom: 16,
  },
  planIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  planStatus: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 2 },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  rowValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  sectionLabel: {
    fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 20, marginBottom: 10,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  featureIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_500Medium', lineHeight: 19 },

  compareCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 18 },
  compareHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  compareHeaderLabel: { flex: 1, fontSize: 10.5, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6 },

  hint: { fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18, marginTop: 20, marginBottom: 16 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 16, borderWidth: 1,
  },
  ctaText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  secondaryCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14,
  },
  secondaryCtaText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
