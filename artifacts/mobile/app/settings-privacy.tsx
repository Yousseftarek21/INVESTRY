import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useClerk, useUser } from '@clerk/expo';
import { backChevron } from '@/utils/rtl';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useHoldings } from '@/context/HoldingsContext';
import { useCash } from '@/context/CashContext';
import { useMarketPrices } from '@/hooks/usePrices';
import { apiFetch } from '@/utils/api';
import { exportPortfolioAsCsv, exportPortfolioAsPdf } from '@/utils/exportPortfolio';
import { DetailModal } from '@/components/DetailModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Sect, NavRow, ToggleRow, settingsScreenStyles as s } from '@/components/SettingsPrimitives';

export default function SettingsPrivacyScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact: haptic, notify } = useHaptic();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { getToken } = useAuth();
  const {
    analyticsEnabled, setAnalyticsEnabled, crashReportsEnabled, setCrashReportsEnabled,
  } = useAppSettings();
  const { holdings, removeHolding } = useHoldings();
  const { cashAccounts } = useCash();
  const { data: prices } = useMarketPrices();

  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; title: string; message: string; label: string; danger: boolean } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const showModal = (title: string, content: string) => { haptic(); setModal({ title, content }); };

  const firstName = user?.firstName ?? '';
  const lastName = user?.lastName ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Investor';
  const displayName = (user?.unsafeMetadata?.displayName as string | undefined) ?? '';
  const profileName = displayName.trim() || fullName;

  const handleDeleteAll = () => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    setConfirm({ id: 'delete', title: t.deleteAllData, message: t.deleteAllDataConfirmMsg, label: t.deleteEverything, danger: true });
  };

  const handleDeleteAccount = () => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    setConfirm({ id: 'deleteAccount', title: t.deleteAccount, message: t.deleteAccountConfirmMsg, label: t.deleteAccount, danger: true });
  };

  const handleDeleteMenu = () => {
    haptic();
    Alert.alert(t.deleteAccount, undefined, [
      { text: t.deleteAllData, onPress: handleDeleteAll, style: 'destructive' },
      { text: t.deleteAccount, onPress: handleDeleteAccount, style: 'destructive' },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const handleExportCsv = async () => {
    haptic();
    try {
      await exportPortfolioAsCsv(holdings, cashAccounts, prices);
    } catch {
      Alert.alert(t.exportFailed, t.exportFailedDesc);
    }
  };

  const handleExportPdf = async () => {
    haptic();
    try {
      await exportPortfolioAsPdf(holdings, cashAccounts, prices, { userName: profileName });
    } catch {
      Alert.alert(t.exportFailed, t.exportFailedDesc);
    }
  };

  const handleExport = () => {
    haptic();
    Alert.alert(t.exportMyData, undefined, [
      { text: t.exportAsCsv, onPress: handleExportCsv },
      { text: t.exportAsPdf, onPress: handleExportPdf },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    if (confirm.id === 'delete') {
      for (const h of holdings) removeHolding(h.id);
      await AsyncStorage.multiRemove([
        '@invstry_theme', '@invstry_lang', '@invstry_weight',
        '@invstry_haptics', '@invstry_analytics', '@invstry_notif', '@invstry_hide_values',
      ]);
      notify(Haptics.NotificationFeedbackType.Warning);
    } else if (confirm.id === 'deleteAccount') {
      setConfirm(null);
      setDeletingAccount(true);
      try {
        const token = await getToken();
        if (!token) throw new Error('No auth token');
        const res = await apiFetch('/api/account', token, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        await signOut();
        router.replace('/(auth)/welcome' as any);
      } catch {
        showModal(t.deleteAccountFailed, t.deleteAccountFailedDesc);
      } finally {
        setDeletingAccount(false);
      }
      return;
    }
    setConfirm(null);
  };

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
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.settingsCatPrivacy}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false}>
          <Sect label={t.settingsSectPrivacy}>
            <ToggleRow icon="activity" iconBg="#6366F1" label={t.analyticsSharingLabel} sublabel={t.analyticsSharingDesc} value={analyticsEnabled} onChange={v => setAnalyticsEnabled(v)} />
            <ToggleRow icon="alert-circle" iconBg="#F97316" label={t.crashReportsLabel} sublabel={t.crashReportsDesc} value={crashReportsEnabled} onChange={v => setCrashReportsEnabled(v)} />
            <NavRow icon="shield" iconBg="#047857" label={t.privacySettingsLabel} sublabel={t.privacySettingsDesc} onPress={() => Linking.openSettings()} />
            <NavRow icon="download" iconBg="#0EA5E9" label={t.exportMyData}
              sublabel={`${holdings.length} ${t.investmentsLabel} · CSV / PDF`}
              onPress={handleExport} />
            <NavRow icon="trash-2" iconBg={colors.red} label={t.deleteAccount} sublabel={t.deleteAccountRowDesc} onPress={handleDeleteMenu} destructive last />
          </Sect>
        </ScrollView>
      </View>
      {modal && (
        <DetailModal visible title={modal.title} content={modal.content} onClose={() => setModal(null)} />
      )}
      {confirm && (
        <ConfirmModal
          visible
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {deletingAccount && (
        <Modal visible transparent animationType="fade">
          <View style={cm.overlay}>
            <View style={[cm.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center' }]}>
              <ActivityIndicator color={colors.red} size="large" />
              <Text style={{ color: colors.mutedForeground, marginTop: 16, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 }}>{t.deletingAccount}</Text>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { borderRadius: 20, borderWidth: 1, padding: 24, width: '100%', gap: 16 },
});
