import React, { useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backChevron } from '@/utils/rtl';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { DetailModal } from '@/components/DetailModal';
import { Sect, NavRow, settingsScreenStyles as s } from '@/components/SettingsPrimitives';

export default function SettingsPortfolioScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact: haptic } = useHaptic();

  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  const showModal = (title: string, content: string) => { haptic(); setModal({ title, content }); };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.settingsCatPortfolio}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false}>
          <Sect label={t.settingsSectPortfolio}>
            <NavRow icon="award" iconBg="#8b5cf6" label={t.tiersPageTitle} sublabel={t.tiersRowSublabel}
              onPress={() => { haptic(); router.push('/tiers' as any); }} last />
          </Sect>

          <Sect label={t.settingsSectCalculations}>
            <NavRow icon="trending-up" iconBg="#6366F1" label={t.performanceCalc} value="FIFO"
              onPress={() => showModal(t.performanceCalc, 'Gain/loss is calculated using First-In, First-Out (FIFO): each investment\'s current value is compared against its recorded purchase price.\n\nAlternate calculation methods (LIFO, average cost) are not yet supported — this is coming in a future update.')} />
            <NavRow icon="percent" iconBg="#22C55E" label={t.fixedIncomeCalc}
              onPress={() => showModal(t.fixedIncomeCalc, 'Interest accrues using simple interest (not compounded): principal × rate × days elapsed ÷ 365.\n\nFor monthly or quarterly payout certificates, the bank pays interest out to a linked account each period instead of adding it back to the certificate — so the value shown here stays flat at your principal until maturity. Only "At Maturity" products accrue toward a lump-sum payout.\n\nThis matches how Egyptian bank certificates and deposits are actually structured.')} />
            <NavRow icon="activity" iconBg="#4A9EFF" label={t.chartMethodology}
              onPress={() => showModal(t.chartMethodology, 'Performance charts use your real recorded snapshots and today\'s live total — no data points are invented. Where multiple real points exist, a smoothing curve is drawn between them; with only two points (e.g. a single day), the line is straight because there\'s nothing yet to curve.\n\nThe inflation comparison uses Egypt\'s latest official annual rate (World Bank/CAPMAS CPI data), updated once a year — treat it as a yearly benchmark, not a live monthly figure.')} last />
          </Sect>
        </ScrollView>
      </View>
      {modal && (
        <DetailModal visible title={modal.title} content={modal.content} onClose={() => setModal(null)} />
      )}
    </>
  );
}
