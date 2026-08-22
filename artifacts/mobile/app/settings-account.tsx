import React, { useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backChevron } from '@/utils/rtl';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useAppSettings } from '@/context/AppSettingsContext';
import { DetailModal } from '@/components/DetailModal';
import { Sect, NavRow, ToggleRow, settingsScreenStyles as s } from '@/components/SettingsPrimitives';

export default function SettingsAccountScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact: haptic } = useHaptic();
  const { biometricLock, setBiometricLock } = useAppSettings();

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
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.settingsCatAccount}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false}>
          <Sect label={t.settingsSectAccount}>
            <NavRow icon="lock" iconBg="#1D4ED8" label={t.changePassword}
              onPress={() => showModal(t.changePassword, 'To change your password, sign out and use "Forgot Password" on the sign-in screen. Password management is handled securely by Clerk authentication.')} />
            <NavRow icon="link" iconBg="#6366F1" label={t.connectedAccounts} value={t.comingSoonLabel}
              onPress={() => showModal(t.connectedAccounts, 'Link bank accounts, brokerage accounts, and other financial services to automatically import your investments — planned for a future update, not yet available.')} />
            <ToggleRow icon="lock" iconBg="#6366F1" label={t.biometricLock} sublabel={t.biometricLockDesc} value={biometricLock} onChange={v => { haptic(); setBiometricLock(v); }} last />
          </Sect>
        </ScrollView>
      </View>
      {modal && (
        <DetailModal visible title={modal.title} content={modal.content} onClose={() => setModal(null)} />
      )}
    </>
  );
}
