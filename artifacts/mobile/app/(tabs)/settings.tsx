import React, { useState } from 'react';
import {
  Alert, Linking, Modal, Platform, ScrollView,
  StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useAppSettings, ThemeMode, WeightUnit } from '@/context/AppSettingsContext';
import { useHoldings } from '@/context/HoldingsContext';
import { Language } from '@/i18n';

const APP_VERSION = '1.0.0';
const BUILD = '100';

// ─── Reusable primitives ────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{label}</Text>;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function RowDivider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function IconBadge({ icon, bg }: { icon: keyof typeof Feather.glyphMap; bg: string }) {
  return (
    <View style={[styles.iconBadge, { backgroundColor: bg }]}>
      <Feather name={icon} size={14} color="#fff" />
    </View>
  );
}

function NavRow({
  icon, iconBg, label, value, onPress, last, destructive,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        activeOpacity={onPress ? 0.6 : 1}
        disabled={!onPress}
      >
        <IconBadge icon={icon} bg={iconBg} />
        <Text style={[styles.rowLabel, { color: destructive ? colors.red : colors.text }]}>{label}</Text>
        <View style={styles.rowRight}>
          {value ? <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text> : null}
          {onPress ? <Feather name="chevron-right" size={15} color={colors.mutedForeground} /> : null}
        </View>
      </TouchableOpacity>
      {!last && <RowDivider />}
    </>
  );
}

function ToggleRow({
  icon, iconBg, label, sublabel, value, onChange, last,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <>
      <View style={styles.row}>
        <IconBadge icon={icon} bg={iconBg} />
        <View style={styles.toggleLabelWrap}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
          {sublabel ? <Text style={[styles.rowSublabel, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.muted, true: colors.primary }}
          thumbColor={Platform.OS === 'android' ? (value ? colors.primary : colors.mutedForeground) : undefined}
          ios_backgroundColor={colors.muted}
        />
      </View>
      {!last && <RowDivider />}
    </>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function DetailModal({
  visible, title, content, onClose,
}: {
  visible: boolean; title: string; content: string; onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[styles.modalBody, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={[styles.modalContent, { color: colors.textSecondary }]}>{content}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const { signOut } = useClerk();
  const {
    themeMode, language, weightUnit, hapticsEnabled, analyticsEnabled, notifications,
    setThemeMode, setLanguage, setWeightUnit, setHapticsEnabled, setAnalyticsEnabled, setNotification,
  } = useAppSettings();
  const { holdings, removeHolding } = useHoldings();

  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const haptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  };

  const handleTheme = async (mode: ThemeMode) => {
    haptic();
    await setThemeMode(mode);
  };

  const handleLanguage = async (lang: Language) => {
    haptic();
    await setLanguage(lang);
  };

  const handleWeightUnit = async (unit: WeightUnit) => {
    haptic();
    await setWeightUnit(unit);
  };

  const handleToggle = async (
    setter: (v: boolean) => Promise<void>,
    value: boolean,
  ) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setter(!value);
  };

  const handleClearCache = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Clear Cache',
      'This will clear temporary price data. Your investments will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('@invstry_price_cache');
            if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    haptic();
    const data = JSON.stringify({ holdings, exportedAt: new Date().toISOString() }, null, 2);
    Alert.alert('Export Data', `Your data is ready.\n\n${holdings.length} investments`, [
      { text: 'OK' },
    ]);
  };

  const handleDeleteAll = () => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete All Data',
      'This will permanently remove all your investments and preferences. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything', style: 'destructive',
          onPress: async () => {
            for (const h of holdings) removeHolding(h.id);
            await AsyncStorage.multiRemove([
              '@invstry_theme', '@invstry_lang', '@invstry_weight',
              '@invstry_haptics', '@invstry_analytics', '@invstry_notif',
            ]);
            if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/welcome' as any);
          },
        },
      ]
    );
  };

  const openURL = (url: string) => {
    haptic();
    Linking.openURL(url).catch(() => Alert.alert('Could not open link'));
  };

  const showModal = (title: string, content: string) => {
    haptic();
    setModal({ title, content });
  };

  const THEMES: { key: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'light', label: t.light, icon: 'sun' },
    { key: 'dark', label: t.dark, icon: 'moon' },
    { key: 'system', label: t.system, icon: 'smartphone' },
  ];

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: topInsets + 20, paddingBottom: botInsets + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>{t.settings}</Text>
          <View style={[styles.versionPill, { backgroundColor: colors.muted }]}>
            <Text style={[styles.versionPillText, { color: colors.mutedForeground }]}>v{APP_VERSION}</Text>
          </View>
        </View>

        {/* ── APPEARANCE ── */}
        <View style={styles.section}>
          <SectionHeader label={t.appearance} />
          <SectionCard>
            <View style={[styles.row, { paddingBottom: 8 }]}>
              <IconBadge icon="eye" bg="#8B5CF6" />
              <Text style={[styles.rowLabel, { color: colors.text }]}>Theme</Text>
            </View>
            <View style={styles.themeSegment}>
              {THEMES.map((item) => {
                const active = themeMode === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.themeChip,
                      active
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: 'transparent', borderColor: colors.border },
                    ]}
                    onPress={() => handleTheme(item.key)}
                    activeOpacity={0.75}
                  >
                    <Feather name={item.icon} size={14} color={active ? colors.primaryForeground : colors.mutedForeground} />
                    <Text style={[styles.themeChipLabel, { color: active ? colors.primaryForeground : colors.mutedForeground }, active && styles.bold]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </SectionCard>
        </View>

        {/* ── LANGUAGE ── */}
        <View style={styles.section}>
          <SectionHeader label={t.language} />
          <SectionCard>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setLangDropdownOpen(v => !v)}
              activeOpacity={0.6}
            >
              <IconBadge icon="globe" bg="#0EA5E9" />
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t.language}</Text>
              <View style={styles.rowRight}>
                <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
                  {language === 'ar' ? 'عربي' : 'English'}
                </Text>
                <Feather
                  name={langDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={colors.mutedForeground}
                />
              </View>
            </TouchableOpacity>

            {langDropdownOpen && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border, marginLeft: 0 }]} />
                {(['en', 'ar'] as Language[]).map((lang, i, arr) => {
                  const active = language === lang;
                  const isLast = i === arr.length - 1;
                  return (
                    <React.Fragment key={lang}>
                      <TouchableOpacity
                        style={[styles.row, styles.dropdownOptionRow, { backgroundColor: active ? colors.primary + '14' : 'transparent' }]}
                        onPress={() => { handleLanguage(lang); setLangDropdownOpen(false); }}
                        activeOpacity={0.6}
                      >
                        <View style={styles.dropdownIndent} />
                        <Text style={[styles.rowLabel, { color: active ? colors.primary : colors.text }]}>
                          {lang === 'ar' ? 'عربي — Arabic' : 'English'}
                        </Text>
                        {active && <Feather name="check" size={15} color={colors.primary} />}
                      </TouchableOpacity>
                      {!isLast && <View style={[styles.divider, { backgroundColor: colors.border, marginLeft: 55 }]} />}
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </SectionCard>
        </View>

        {/* ── PORTFOLIO PREFERENCES ── */}
        <View style={styles.section}>
          <SectionHeader label="PORTFOLIO" />
          <SectionCard>
            {/* Weight unit */}
            <View style={[styles.row, styles.rowNoChevron]}>
              <IconBadge icon="sliders" bg="#059669" />
              <Text style={[styles.rowLabel, { color: colors.text }]}>Weight Unit</Text>
              <View style={styles.segmentSmall}>
                {(['g', 'oz'] as WeightUnit[]).map(u => {
                  const active = weightUnit === u;
                  return (
                    <TouchableOpacity
                      key={u}
                      style={[
                        styles.segmentSmallChip,
                        {
                          backgroundColor: active ? colors.primary : colors.muted,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => handleWeightUnit(u)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.segmentSmallLabel, { color: active ? colors.primaryForeground : colors.mutedForeground }, active && styles.bold]}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <RowDivider />
            <NavRow icon="refresh-cw" iconBg="#0EA5E9" label="Auto-refresh" value="Every 2 min" last />
          </SectionCard>
        </View>

        {/* ── MARKET PREFERENCES ── */}
        <View style={styles.section}>
          <SectionHeader label={t.marketData} />
          <SectionCard>
            <NavRow icon="award" iconBg="#D4AC0D" label="Gold Source" value="gold-api.com" />
            <NavRow icon="circle" iconBg="#9CA3AF" label="Silver Source" value="goldprice.org" />
            <NavRow icon="bar-chart-2" iconBg="#3B82F6" label="Stock Exchange" value="EGX" last />
          </SectionCard>
        </View>

        {/* ── NOTIFICATIONS ── */}
        <View style={styles.section}>
          <SectionHeader label="NOTIFICATIONS" />
          <SectionCard>
            <ToggleRow
              icon="bell" iconBg="#F59E0B"
              label="Price Alerts"
              sublabel="Gold, silver & currency changes"
              value={notifications.priceAlerts}
              onChange={(v) => setNotification('priceAlerts', v)}
            />
            <ToggleRow
              icon="briefcase" iconBg="#8B5CF6"
              label="Portfolio Alerts"
              sublabel="Significant portfolio movements"
              value={notifications.portfolioAlerts}
              onChange={(v) => setNotification('portfolioAlerts', v)}
            />
            <ToggleRow
              icon="sun" iconBg="#EF4444"
              label="Daily Summary"
              sublabel="Morning portfolio snapshot"
              value={notifications.dailySummary}
              onChange={(v) => setNotification('dailySummary', v)}
            />
            <ToggleRow
              icon="calendar" iconBg="#10B981"
              label="Weekly Summary"
              sublabel="End-of-week performance report"
              value={notifications.weeklySummary}
              onChange={(v) => setNotification('weeklySummary', v)}
              last
            />
          </SectionCard>
        </View>

        {/* ── PRIVACY & DATA ── */}
        <View style={styles.section}>
          <SectionHeader label="PRIVACY & DATA" />
          <SectionCard>
            <ToggleRow
              icon="activity" iconBg="#6366F1"
              label="Analytics"
              sublabel="Help improve the app anonymously"
              value={analyticsEnabled}
              onChange={async () => handleToggle(setAnalyticsEnabled, analyticsEnabled)}
            />
            <ToggleRow
              icon="alert-triangle" iconBg="#F97316"
              label="Crash Reports"
              sublabel="Automatically send crash logs"
              value={analyticsEnabled}
              onChange={async () => handleToggle(setAnalyticsEnabled, analyticsEnabled)}
            />
            <NavRow
              icon="download" iconBg="#0EA5E9"
              label="Export My Data"
              onPress={handleExportData}
            />
            <NavRow
              icon="trash-2" iconBg={colors.red}
              label="Delete All Data"
              onPress={handleDeleteAll}
              destructive
              last
            />
          </SectionCard>
        </View>

        {/* ── ACCESSIBILITY ── */}
        <View style={styles.section}>
          <SectionHeader label="ACCESSIBILITY" />
          <SectionCard>
            <ToggleRow
              icon="zap" iconBg="#FBBF24"
              label="Haptic Feedback"
              sublabel="Vibration on interactions"
              value={hapticsEnabled}
              onChange={async () => handleToggle(setHapticsEnabled, hapticsEnabled)}
            />
            <NavRow
              icon="type" iconBg="#6B7280"
              label="Text Size"
              value="System"
              last
            />
          </SectionCard>
        </View>

        {/* ── SECURITY ── */}
        <View style={styles.section}>
          <SectionHeader label="SECURITY" />
          <SectionCard>
            <NavRow icon="lock" iconBg="#1D4ED8" label="App Lock" value="Off" onPress={() =>
              showModal('App Lock', 'Biometric and passcode lock can be configured in your device Settings → Privacy & Security.')
            } />
            <NavRow icon="shield" iconBg="#047857" label="Privacy Settings" onPress={() =>
              Linking.openSettings()
            } last />
          </SectionCard>
        </View>

        {/* ── SUPPORT ── */}
        <View style={styles.section}>
          <SectionHeader label="SUPPORT" />
          <SectionCard>
            <NavRow icon="help-circle" iconBg="#0EA5E9" label="Help Center" onPress={() =>
              showModal('Help Center', 'INVSTRY tracks your gold, silver, EGX stocks, and real estate in one place.\n\n• Pull down to refresh prices\n• Tap + on the Investments tab to add a holding\n• Swipe left on a holding to delete it\n• Toggle Arabic in Settings → Language\n\nFor further assistance, contact us at support@invstry.app')
            } />
            <NavRow icon="mail" iconBg="#10B981" label="Contact Support" onPress={() =>
              openURL('mailto:support@invstry.app?subject=INVSTRY Support')
            } />
            <NavRow icon="flag" iconBg="#F59E0B" label="Report a Bug" onPress={() =>
              openURL('mailto:bugs@invstry.app?subject=Bug Report — INVSTRY v' + APP_VERSION)
            } />
            <NavRow icon="star" iconBg="#EF4444" label="Rate on App Store" onPress={() =>
              showModal('Rate INVSTRY', 'Thank you for your support! App Store rating will be available once the app is published.')
            } last />
          </SectionCard>
        </View>

        {/* ── ABOUT ── */}
        <View style={styles.section}>
          <SectionHeader label={t.about} />
          <SectionCard>
            <NavRow icon="info" iconBg="#6366F1" label={t.version} value={`${APP_VERSION} (${BUILD})`} />
            <NavRow icon="map-pin" iconBg="#EF4444" label={t.madeInEgypt} value="🇪🇬 Cairo" />
            <NavRow icon="gift" iconBg="#10B981" label="What's New" onPress={() =>
              showModal("What's New in v" + APP_VERSION,
                "• Redesigned portfolio & markets screens\n• Full Arabic language support\n• Live gold & silver prices via gold-api.com\n• EGX stock tracking with live prices\n• Dark navy premium theme\n• Weight unit preference (grams / oz)\n• Notification preferences"
              )
            } />
            <NavRow icon="code" iconBg="#6B7280" label="Open Source Licenses" onPress={() =>
              showModal('Open Source', 'This app is built with:\n\n• Expo SDK 54\n• React Native 0.81\n• React Query\n• @tanstack/react-query\n• AsyncStorage\n• expo-haptics\n• Inter font (Google Fonts)\n• @expo/vector-icons (Feather)')
            } last />
          </SectionCard>
        </View>

        {/* ── LEGAL ── */}
        <View style={styles.section}>
          <SectionHeader label="LEGAL" />
          <SectionCard>
            <NavRow icon="file-text" iconBg="#374151" label="Terms of Service" onPress={() =>
              showModal('Terms of Service',
                'Last updated: July 2024\n\nINVSTRY is provided for informational purposes only. Nothing in this app constitutes financial advice, investment advice, or a recommendation to buy or sell any asset.\n\nAll investment data is sourced from third-party providers and may not be 100% accurate or up to date. Past performance does not guarantee future results.\n\nYou agree to use this app at your own risk. We are not liable for any financial decisions made based on information displayed in this app.\n\nAll holdings data is stored locally on your device and is never transmitted to our servers.'
              )
            } />
            <NavRow icon="lock" iconBg="#4B5563" label="Privacy Policy" onPress={() =>
              showModal('Privacy Policy',
                'Last updated: July 2024\n\nData We Collect\nINVSTRY does not collect or store any personal data on external servers. All portfolio data (your holdings, preferences) is stored locally on your device using AsyncStorage.\n\nThird-Party Services\nWe fetch live market prices from:\n• api.gold-api.com\n• goldprice.org\n• Yahoo Finance\n• open.er-api.com\n\nThese services may collect anonymized request data per their own privacy policies.\n\nAnalytics (optional)\nIf enabled, anonymized usage analytics help us improve the app. No personally identifiable information is collected.\n\nContact: privacy@invstry.app'
              )
            } />
            <NavRow icon="alert-circle" iconBg="#7C3AED" label="Regulatory Disclaimer" onPress={() =>
              showModal('Regulatory Disclaimer',
                'INVSTRY is not a registered investment advisor, broker-dealer, or financial institution.\n\nThis application does not provide personalized investment advice. Market data displayed is for informational purposes only and should not be used as the sole basis for any investment decision.\n\nPrecious metal and currency prices are fetched from third-party APIs and may be delayed or inaccurate. Always verify prices with a certified financial professional before making investment decisions.\n\nEGX stock prices shown are for reference only and may not reflect real-time trading prices.'
              )
            } last />
          </SectionCard>
        </View>

        {/* ── ACCOUNT ── */}
        <View style={styles.section}>
          <SectionHeader label="ACCOUNT" />
          <SectionCard>
            <NavRow
              icon="log-out"
              iconBg={colors.red}
              label="Sign Out"
              onPress={handleSignOut}
              destructive
              last
            />
          </SectionCard>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerBrand, { color: colors.primary }]}>INVSTRY</Text>
          <Text style={[styles.footerTagline, { color: colors.mutedForeground }]}>{t.footerTagline}</Text>
        </View>
      </ScrollView>

      {/* Detail Modal */}
      {modal && (
        <DetailModal
          visible={!!modal}
          title={modal.title}
          content={modal.content}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  screenTitle: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  versionPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  versionPillText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  section: { gap: 6, marginBottom: 10 },
  sectionHeader: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2, marginLeft: 4, marginBottom: 2 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 13,
  },
  rowNoChevron: {},
  rowLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowValue: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  rowSublabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  toggleLabelWrap: { flex: 1, gap: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 55 },
  bold: { fontFamily: 'Inter_700Bold' },

  iconBadge: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  // Theme
  themeSegment: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 12 },
  themeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  themeChipLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  // Language dropdown
  dropdownOptionRow: { paddingVertical: 12 },
  dropdownIndent: { width: 43 },

  // Segment small
  segmentSmall: { flexDirection: 'row', gap: 4 },
  segmentSmallChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  segmentSmallLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  // Footer
  footer: { alignItems: 'center', paddingTop: 28, gap: 5, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10 },
  footerBrand: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  footerTagline: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', flex: 1 },
  modalClose: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 24 },
  modalContent: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 24 },
});
