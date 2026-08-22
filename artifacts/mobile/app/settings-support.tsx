import React, { useState } from 'react';
import { Linking, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { backChevron } from '@/utils/rtl';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { DetailModal } from '@/components/DetailModal';
import { Sect, NavRow, settingsScreenStyles as s } from '@/components/SettingsPrimitives';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function SettingsSupportScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact: haptic } = useHaptic();

  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  const showModal = (title: string, content: string) => { haptic(); setModal({ title, content }); };
  const openURL = (url: string) => { haptic(); Linking.openURL(url).catch(() => showModal(t.couldNotOpenLink, t.couldNotOpenLinkDesc)); };

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
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.settingsCatSupport}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false}>
          <Sect label={t.settingsSectSupport}>
            <NavRow icon="help-circle" iconBg="#0EA5E9" label={t.helpCenter} onPress={() => { haptic(); router.push('/help-center' as any); }} />
            <NavRow icon="mail" iconBg="#10B981" label={t.contactSupport} onPress={() => openURL('mailto:support@investry.app?subject=INVESTRY Support')} />
            <NavRow icon="flag" iconBg="#F59E0B" label={t.reportBug} onPress={() => openURL(`mailto:bugs@investry.app?subject=Bug Report — INVESTRY v${APP_VERSION}`)} />
            <NavRow icon="edit-2" iconBg="#8B5CF6" label={t.requestFeature} onPress={() => openURL('mailto:feedback@investry.app?subject=Feature Request')} />
            <NavRow icon="star" iconBg="#EF4444" label={t.rateAppStore} onPress={() =>
              openURL(Platform.OS === 'ios'
                ? 'https://apps.apple.com/app/id6787447052?action=write-review'
                : 'https://play.google.com/store/apps/details?id=com.investry.app')} last />
          </Sect>

          <Sect label={t.settingsSectLegal}>
            <NavRow icon="file-text" iconBg="#374151" label={t.termsOfService} onPress={() =>
              showModal(t.termsOfService, t.termsOfServiceBody)} />
            <NavRow icon="lock" iconBg="#4B5563" label={t.privacyPolicy} onPress={() =>
              showModal(t.privacyPolicy, t.privacyPolicyBody)} />
            <NavRow icon="alert-circle" iconBg="#7C3AED" label={t.regulatoryDisclaimer} onPress={() =>
              showModal(t.regulatoryDisclaimer, 'INVESTRY is not a registered investment advisor, broker-dealer, or financial institution.\n\nThis application does not provide personalized investment advice. Market data displayed is for informational purposes only and should not be used as the sole basis for any investment decision.\n\nAlways verify prices with a certified financial professional before making investment decisions.')} last />
          </Sect>
        </ScrollView>
      </View>
      {modal && (
        <DetailModal visible title={modal.title} content={modal.content} onClose={() => setModal(null)} />
      )}
    </>
  );
}
