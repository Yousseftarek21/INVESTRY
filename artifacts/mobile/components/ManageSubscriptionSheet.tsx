import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Purchases from 'react-native-purchases';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { REVENUECAT_ENTITLEMENT_ID } from '@/utils/revenuecat';

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
          <View style={styles.body}>
            <View style={[styles.planCard, { borderColor: colors.primary + '3A', backgroundColor: colors.primary + '10' }]}>
              <View style={[styles.planIcon, { backgroundColor: colors.primary + '22' }]}>
                <Feather name="award" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planName, { color: colors.text }]}>
                  {t.subComparePro}{billingPeriodLabel ? ` — ${billingPeriodLabel}` : ''}
                </Text>
                <Text style={[styles.planStatus, { color: colors.green }]}>{t.subStatusActive}</Text>
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

            <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.subManageHint}</Text>

            <TouchableOpacity
              style={[styles.cta, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={openAppleSettings}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaText, { color: colors.text }]}>{t.subManageInAppStore}</Text>
              <Feather name="external-link" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 10, marginBottom: 4 },
  header: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 6, gap: 4 },

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

  hint: { fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18, marginTop: 16, marginBottom: 16 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 16, borderWidth: 1,
  },
  ctaText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
