import React from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backChevron } from '@/utils/rtl';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { LockedFeatureCard } from '@/components/LockedFeatureCard';
import { Sect, NavRow, ToggleRow, settingsScreenStyles as s } from '@/components/SettingsPrimitives';

export default function SettingsNotificationsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { notifications, setNotification } = useAppSettings();
  const { featuresUnlocked } = useSubscription();

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
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.settingsCatNotifications}</Text>
          <View style={{ width: 22 }} />
        </View>

        {!featuresUnlocked ? (
          <View style={{ flex: 1, padding: 24 }}>
            <LockedFeatureCard feature={t.settingsCatNotifications} description={t.settingsCatNotificationsSub} fullScreen />
          </View>
        ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false}>
          <Sect label={t.settingsSectNotifications}>
            <ToggleRow icon="bell" iconBg="#F59E0B" label={t.priceAlertsLabel} sublabel={t.priceAlertsDesc} value={notifications.priceAlerts} onChange={v => setNotification('priceAlerts', v)} />
            <NavRow icon="sliders" iconBg="#F59E0B" label={t.managePriceAlerts} sublabel={t.managePriceAlertsDesc}
              onPress={() => router.push('/price-alerts' as any)} />
            <ToggleRow icon="briefcase" iconBg="#8B5CF6" label={t.portfolioAlertsLabel} sublabel={t.portfolioAlertsDesc} value={notifications.portfolioAlerts} onChange={v => setNotification('portfolioAlerts', v)} />
            <NavRow icon="pie-chart" iconBg="#8B5CF6" label={t.rebalancingAlertsLabel} sublabel={t.rebalancingAlertsDesc}
              onPress={() => router.push('/target-allocation' as any)} />
            <ToggleRow icon="sun" iconBg="#EF4444" label={t.dailySummaryLabel} sublabel={t.dailySummaryDesc} value={notifications.dailySummary} onChange={v => setNotification('dailySummary', v)} />
            <ToggleRow icon="calendar" iconBg="#10B981" label={t.weeklyReportLabel} sublabel={t.weeklyReportDesc} value={notifications.weeklySummary} onChange={v => setNotification('weeklySummary', v)} />
            <ToggleRow icon="message-circle" iconBg="#EC4899" label={t.feedbackAlertsLabel} sublabel={t.feedbackAlertsDesc} value={notifications.feedbackAlerts} onChange={v => setNotification('feedbackAlerts', v)} last />
          </Sect>
        </ScrollView>
        )}
      </View>
    </>
  );
}
