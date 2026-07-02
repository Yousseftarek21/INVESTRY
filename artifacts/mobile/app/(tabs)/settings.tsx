import React, { useState, useEffect } from 'react';
import {
  Alert, Linking, Modal, Platform, ScrollView,
  StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useClerk, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useAppSettings, ThemeMode, WeightUnit } from '@/context/AppSettingsContext';
import { useHoldings } from '@/context/HoldingsContext';
import { Language } from '@/i18n';

const APP_VERSION = '1.0.0';
const BUILD = '100';

// ─── Row primitives ───────────────────────────────────────────────────────────

function IconBadge({ icon, bg }: { icon: keyof typeof Feather.glyphMap; bg: string }) {
  return (
    <View style={[p.badge, { backgroundColor: bg }]}>
      <Feather name={icon} size={15} color="#fff" />
    </View>
  );
}

function Divider({ indent = 54 }: { indent?: number }) {
  const colors = useColors();
  return <View style={[p.divider, { backgroundColor: colors.border, marginLeft: indent }]} />;
}

function NavRow({
  icon, iconBg, label, sublabel, value, onPress, last, destructive,
}: {
  icon: keyof typeof Feather.glyphMap; iconBg: string; label: string;
  sublabel?: string; value?: string; onPress?: () => void; last?: boolean; destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <>
      <TouchableOpacity
        style={p.row} onPress={onPress}
        activeOpacity={onPress ? 0.55 : 1} disabled={!onPress}
      >
        <IconBadge icon={icon} bg={iconBg} />
        <View style={p.rowBody}>
          <Text style={[p.label, { color: destructive ? colors.red : colors.text }]}>{label}</Text>
          {sublabel ? <Text style={[p.sub, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
        </View>
        <View style={p.rowRight}>
          {value ? <Text style={[p.val, { color: colors.mutedForeground }]}>{value}</Text> : null}
          {onPress ? <Feather name="chevron-right" size={16} color={colors.mutedForeground} /> : null}
        </View>
      </TouchableOpacity>
      {!last && <Divider />}
    </>
  );
}

function ToggleRow({
  icon, iconBg, label, sublabel, value, onChange, last,
}: {
  icon: keyof typeof Feather.glyphMap; iconBg: string; label: string;
  sublabel?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
}) {
  const colors = useColors();
  return (
    <>
      <View style={p.row}>
        <IconBadge icon={icon} bg={iconBg} />
        <View style={p.rowBody}>
          <Text style={[p.label, { color: colors.text }]}>{label}</Text>
          {sublabel ? <Text style={[p.sub, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
        </View>
        <Switch
          value={value} onValueChange={onChange}
          trackColor={{ false: colors.muted, true: colors.primary }}
          thumbColor={Platform.OS === 'android' ? (value ? colors.primary : colors.mutedForeground) : undefined}
          ios_backgroundColor={colors.muted}
        />
      </View>
      {!last && <Divider />}
    </>
  );
}

const p = StyleSheet.create({
  badge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 13, minHeight: 52 },
  rowBody: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  val: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={sec.wrap}>
      <Text style={[sec.header, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[sec.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}
const sec = StyleSheet.create({
  wrap: { gap: 7 },
  header: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.4, marginLeft: 6 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
});

// ─── Profile avatar ────────────────────────────────────────────────────────────

function Avatar({ initials, size = 72 }: { initials: string; size?: number }) {
  const colors = useColors();
  return (
    <View style={[av.ring, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, borderColor: colors.primary }]}>
      <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + '22' }]}>
        <Text style={[av.text, { fontSize: size * 0.36, color: colors.primary }]}>{initials}</Text>
      </View>
    </View>
  );
}
const av = StyleSheet.create({
  ring: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
});

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({ visible, title, content, onClose }: {
  visible: boolean; title: string; content: string; onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[dm.container, { backgroundColor: colors.background }]}>
        <View style={[dm.header, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <Text style={[dm.title, { color: colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={[dm.close, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[dm.body, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={[dm.content, { color: colors.textSecondary }]}>{content}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
const dm = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', flex: 1 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 24 },
  content: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 24 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const {
    themeMode, language, weightUnit, hapticsEnabled, analyticsEnabled, notifications,
    setThemeMode, setLanguage, setWeightUnit, setHapticsEnabled, setAnalyticsEnabled, setNotification,
  } = useAppSettings();
  const { holdings, removeHolding } = useHoldings();

  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [hideValues, setHideValues] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@invstry_hide_values').then(v => {
      if (v === 'true') setHideValues(true);
    });
  }, []);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  // ── User info ─────────────────────────────────────────────────────────────────
  const firstName = user?.firstName ?? '';
  const lastName  = user?.lastName  ?? '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'Investor';
  const email     = user?.emailAddresses?.[0]?.emailAddress ?? '';
  const verified  = user?.hasVerifiedEmailAddress ?? false;
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || email[0]?.toUpperCase() || 'I';

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const haptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  };

  const showModal = (title: string, content: string) => { haptic(); setModal({ title, content }); };
  const openURL  = (url: string) => { haptic(); Linking.openURL(url).catch(() => Alert.alert('Could not open link')); };

  const handleTheme = async (mode: ThemeMode) => { haptic(); await setThemeMode(mode); };
  const handleLang  = async (lang: Language)  => { haptic(); await setLanguage(lang); setLangOpen(false); };

  const handleHideValues = async (v: boolean) => {
    haptic();
    setHideValues(v);
    await AsyncStorage.setItem('@invstry_hide_values', String(v));
  };

  const handleClearCache = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Clear Cache', 'This removes temporary price data. Your investments are safe.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('@invstry_price_cache');
          if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleExportData = () => {
    haptic();
    Alert.alert('Export Data', `${holdings.length} investment${holdings.length !== 1 ? 's' : ''} ready to export.\n\nFull CSV/JSON export coming soon.`, [{ text: 'OK' }]);
  };

  const handleDeleteAll = () => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete All Data',
      'This permanently removes all your investments and preferences. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything', style: 'destructive',
          onPress: async () => {
            for (const h of holdings) removeHolding(h.id);
            await AsyncStorage.multiRemove([
              '@invstry_theme', '@invstry_lang', '@invstry_weight',
              '@invstry_haptics', '@invstry_analytics', '@invstry_notif', '@invstry_hide_values',
            ]);
            if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/welcome' as any);
        },
      },
    ]);
  };

  const THEMES: { key: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'light', label: t.light, icon: 'sun' },
    { key: 'dark',  label: t.dark,  icon: 'moon' },
    { key: 'system',label: t.system,icon: 'smartphone' },
  ];

  return (
    <>
      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[s.content, { paddingTop: topPad + 16, paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page title ────────────────────────────────────────────── */}
        <View style={s.pageHeader}>
          <Text style={[s.pageTitle, { color: colors.text }]}>{t.settings}</Text>
          <View style={[s.versionBadge, { backgroundColor: colors.muted }]}>
            <Text style={[s.versionTxt, { color: colors.mutedForeground }]}>v{APP_VERSION}</Text>
          </View>
        </View>

        {/* ── Profile card ──────────────────────────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.75}
          style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => showModal('Account', `Name: ${fullName}\nEmail: ${email}\nVerified: ${verified ? 'Yes ✓' : 'Pending'}\nHoldings: ${holdings.length}`)}
        >
          <Avatar initials={initials} size={64} />
          <View style={s.profileInfo}>
            <View style={s.profileNameRow}>
              <Text style={[s.profileName, { color: colors.text }]} numberOfLines={1}>{fullName}</Text>
              {verified && (
                <View style={[s.verifiedBadge, { backgroundColor: colors.green + '20', borderColor: colors.green + '40' }]}>
                  <Feather name="check-circle" size={10} color={colors.green} />
                  <Text style={[s.verifiedTxt, { color: colors.green }]}>Verified</Text>
                </View>
              )}
            </View>
            <Text style={[s.profileEmail, { color: colors.mutedForeground }]} numberOfLines={1}>{email}</Text>
            <Text style={[s.profileMeta, { color: colors.mutedForeground }]}>
              {holdings.length} holding{holdings.length !== 1 ? 's' : ''} · INVSTRY
            </Text>
          </View>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* ── APPEARANCE ────────────────────────────────────────────── */}
        <Section label="APPEARANCE">
          {/* Theme */}
          <View style={s.themeWrap}>
            <View style={[s.themeHeader]}>
              <IconBadge icon="eye" bg="#8B5CF6" />
              <Text style={[p.label, { color: colors.text }]}>Theme</Text>
            </View>
            <View style={s.themeRow}>
              {THEMES.map(item => {
                const active = themeMode === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[s.themeChip, {
                      backgroundColor: active ? colors.primary : colors.muted,
                      borderColor: active ? colors.primary : 'transparent',
                    }]}
                    onPress={() => handleTheme(item.key)}
                    activeOpacity={0.7}
                  >
                    <Feather name={item.icon} size={14} color={active ? colors.primaryForeground : colors.mutedForeground} />
                    <Text style={[s.themeChipLabel, { color: active ? colors.primaryForeground : colors.mutedForeground, fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <Divider indent={0} />
          {/* Language */}
          <TouchableOpacity
            style={p.row}
            onPress={() => { haptic(); setLangOpen(v => !v); }}
            activeOpacity={0.6}
          >
            <IconBadge icon="globe" bg="#0EA5E9" />
            <View style={p.rowBody}>
              <Text style={[p.label, { color: colors.text }]}>Language</Text>
            </View>
            <View style={p.rowRight}>
              <Text style={[p.val, { color: colors.mutedForeground }]}>{language === 'ar' ? 'عربي' : 'English'}</Text>
              <Feather name={langOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.mutedForeground} />
            </View>
          </TouchableOpacity>
          {langOpen && (
            <>
              <Divider indent={0} />
              {(['en', 'ar'] as Language[]).map((lang, i, arr) => {
                const active = language === lang;
                const isLast = i === arr.length - 1;
                return (
                  <React.Fragment key={lang}>
                    <TouchableOpacity
                      style={[p.row, { paddingLeft: 62, backgroundColor: active ? colors.primary + '12' : 'transparent' }]}
                      onPress={() => handleLang(lang)}
                      activeOpacity={0.6}
                    >
                      <Text style={[p.label, { color: active ? colors.primary : colors.text, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                        {lang === 'ar' ? 'عربي — Arabic' : 'English'}
                      </Text>
                      {active && <Feather name="check" size={15} color={colors.primary} />}
                    </TouchableOpacity>
                    {!isLast && <Divider indent={62} />}
                  </React.Fragment>
                );
              })}
            </>
          )}
        </Section>

        {/* ── PORTFOLIO ─────────────────────────────────────────────── */}
        <Section label="PORTFOLIO">
          <View style={p.row}>
            <IconBadge icon="sliders" bg="#059669" />
            <View style={p.rowBody}>
              <Text style={[p.label, { color: colors.text }]}>Weight Unit</Text>
              <Text style={[p.sub, { color: colors.mutedForeground }]}>For gold & silver display</Text>
            </View>
            <View style={s.segRow}>
              {(['g', 'oz'] as WeightUnit[]).map(u => {
                const active = weightUnit === u;
                return (
                  <TouchableOpacity
                    key={u}
                    style={[s.segChip, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : 'transparent' }]}
                    onPress={() => { haptic(); setWeightUnit(u); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.segLabel, { color: active ? colors.primaryForeground : colors.mutedForeground, fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium' }]}>{u}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <Divider />
          <NavRow icon="eye-off" iconBg="#374151" label="Hide Portfolio Values" value={hideValues ? 'On' : 'Off'}
            onPress={() => handleHideValues(!hideValues)} />
          <NavRow icon="refresh-cw" iconBg="#0EA5E9" label="Auto-refresh" value="Every 60s" last />
        </Section>

        {/* ── NOTIFICATIONS ─────────────────────────────────────────── */}
        <Section label="NOTIFICATIONS">
          <ToggleRow icon="bell" iconBg="#F59E0B" label="Price Alerts" sublabel="Gold, silver & currency moves"
            value={notifications.priceAlerts} onChange={v => setNotification('priceAlerts', v)} />
          <ToggleRow icon="briefcase" iconBg="#8B5CF6" label="Portfolio Alerts" sublabel="Significant portfolio movements"
            value={notifications.portfolioAlerts} onChange={v => setNotification('portfolioAlerts', v)} />
          <ToggleRow icon="sun" iconBg="#EF4444" label="Daily Summary" sublabel="Morning portfolio snapshot"
            value={notifications.dailySummary} onChange={v => setNotification('dailySummary', v)} />
          <ToggleRow icon="calendar" iconBg="#10B981" label="Weekly Report" sublabel="End-of-week performance"
            value={notifications.weeklySummary} onChange={v => setNotification('weeklySummary', v)} last />
        </Section>

        {/* ── MARKET DATA ───────────────────────────────────────────── */}
        <Section label="MARKET DATA">
          <NavRow icon="award"       iconBg="#D4AC0D" label="Gold Source"     value="gold-api.com" />
          <NavRow icon="circle"      iconBg="#9CA3AF" label="Silver Source"   value="gold-api.com" />
          <NavRow icon="bar-chart-2" iconBg="#3B82F6" label="Stock Exchange"  value="Yahoo Finance" />
          <NavRow icon="dollar-sign" iconBg="#059669" label="FX Provider"     value="er-api.com" />
          <NavRow icon="refresh-cw"  iconBg="#6366F1" label="Clear Cache" onPress={handleClearCache} last />
        </Section>

        {/* ── PRIVACY & SECURITY ────────────────────────────────────── */}
        <Section label="PRIVACY & SECURITY">
          <ToggleRow icon="activity"     iconBg="#6366F1" label="Analytics" sublabel="Anonymous usage data"
            value={analyticsEnabled} onChange={v => setAnalyticsEnabled(v)} />
          <ToggleRow icon="alert-circle" iconBg="#F97316" label="Crash Reports" sublabel="Auto-send crash logs"
            value={analyticsEnabled} onChange={v => setAnalyticsEnabled(v)} />
          <ToggleRow icon="zap"          iconBg="#FBBF24" label="Haptic Feedback" sublabel="Vibration on interactions"
            value={hapticsEnabled}   onChange={v => setHapticsEnabled(v)} />
          <NavRow icon="lock"   iconBg="#1D4ED8" label="App Lock" value="Off"
            onPress={() => showModal('App Lock', 'Biometric and passcode lock can be configured in your device Settings → Privacy & Security.')} />
          <NavRow icon="shield" iconBg="#047857" label="Privacy Settings" onPress={() => Linking.openSettings()} />
          <NavRow icon="download" iconBg="#0EA5E9" label="Export My Data" onPress={handleExportData} />
          <NavRow icon="trash-2"  iconBg={colors.red} label="Delete All Data" onPress={handleDeleteAll} destructive last />
        </Section>

        {/* ── SUPPORT ───────────────────────────────────────────────── */}
        <Section label="SUPPORT">
          <NavRow icon="help-circle" iconBg="#0EA5E9" label="Help Center" onPress={() =>
            showModal('Help Center',
              'INVSTRY tracks your gold, silver, EGX stocks, and real estate in one place.\n\n• Pull down to refresh prices\n• Tap + on the Investments tab to add a holding\n• Swipe left on a holding to delete it\n• Toggle Arabic in Settings → Language\n\nFor help, contact us at support@invstry.app'
            )} />
          <NavRow icon="mail"  iconBg="#10B981" label="Contact Support"   onPress={() => openURL('mailto:support@invstry.app?subject=INVSTRY Support')} />
          <NavRow icon="flag"  iconBg="#F59E0B" label="Report a Bug"      onPress={() => openURL('mailto:bugs@invstry.app?subject=Bug Report — INVSTRY v' + APP_VERSION)} />
          <NavRow icon="star"  iconBg="#EF4444" label="Rate on App Store" onPress={() =>
            showModal('Rate INVSTRY', 'Thank you! App Store rating will be available once the app is published.')} last />
        </Section>

        {/* ── LEGAL ─────────────────────────────────────────────────── */}
        <Section label="LEGAL">
          <NavRow icon="file-text"   iconBg="#374151" label="Terms of Service" onPress={() =>
            showModal('Terms of Service',
              'Last updated: July 2025\n\nINVSTRY is provided for informational purposes only. Nothing in this app constitutes financial advice, investment advice, or a recommendation to buy or sell any asset.\n\nAll investment data is sourced from third-party providers and may not be 100% accurate or up to date. Past performance does not guarantee future results.\n\nYou agree to use this app at your own risk. We are not liable for any financial decisions made based on information displayed in this app.\n\nAll holdings data is stored locally on your device and is never transmitted to our servers.'
            )} />
          <NavRow icon="lock"        iconBg="#4B5563" label="Privacy Policy" onPress={() =>
            showModal('Privacy Policy',
              'Last updated: July 2025\n\nData We Collect\nINVSTRY does not collect or store any personal data on external servers. All portfolio data is stored locally on your device.\n\nThird-Party Services\nWe fetch live market prices from:\n• api.gold-api.com\n• Yahoo Finance\n• open.er-api.com\n\nAnalytics (optional)\nIf enabled, anonymized usage analytics help us improve the app. No personally identifiable information is collected.\n\nContact: privacy@invstry.app'
            )} />
          <NavRow icon="alert-circle" iconBg="#7C3AED" label="Regulatory Disclaimer" onPress={() =>
            showModal('Regulatory Disclaimer',
              'INVSTRY is not a registered investment advisor, broker-dealer, or financial institution.\n\nThis application does not provide personalized investment advice. Market data displayed is for informational purposes only and should not be used as the sole basis for any investment decision.\n\nPrecious metal and currency prices are fetched from third-party APIs and may be delayed or inaccurate. Always verify prices with a certified financial professional before making investment decisions.'
            )} />
          <NavRow icon="code" iconBg="#6B7280" label="Open Source Licenses" onPress={() =>
            showModal('Open Source',
              'This app is built with:\n\n• Expo SDK 54\n• React Native 0.81\n• React Query (@tanstack/react-query)\n• AsyncStorage\n• expo-haptics\n• Inter font (Google Fonts)\n• @expo/vector-icons (Feather)\n• Clerk Authentication\n• react-native-svg'
            )} last />
        </Section>

        {/* ── ABOUT ─────────────────────────────────────────────────── */}
        <Section label="ABOUT">
          <NavRow icon="info"    iconBg="#6366F1" label="Version"     value={`${APP_VERSION} (${BUILD})`} />
          <NavRow icon="map-pin" iconBg="#EF4444" label="Made in"     value="🇪🇬 Cairo, Egypt" />
          <NavRow icon="gift"    iconBg="#10B981" label="What's New"  onPress={() =>
            showModal("What's New in v" + APP_VERSION,
              "• Analytics tab with portfolio health score\n• Market heatmap overview\n• Category tabs in Markets\n• Full Arabic language support\n• Live gold & silver prices\n• EGX stock tracking\n• Dark navy premium theme"
            )} last />
        </Section>

        {/* ── SIGN OUT button ───────────────────────────────────────── */}
        <TouchableOpacity
          style={[s.signOutBtn, { backgroundColor: colors.red + '14', borderColor: colors.red + '35' }]}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={17} color={colors.red} />
          <Text style={[s.signOutLabel, { color: colors.red }]}>Sign Out</Text>
        </TouchableOpacity>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <View style={[s.footer, { borderTopColor: colors.border }]}>
          <Text style={[s.footerBrand, { color: colors.primary }]}>INVSTRY</Text>
          <Text style={[s.footerTag, { color: colors.mutedForeground }]}>{t.footerTagline}</Text>
          <Text style={[s.footerDisc, { color: colors.mutedForeground }]}>Not financial advice. For informational use only.</Text>
        </View>
      </ScrollView>

      {modal && (
        <DetailModal visible title={modal.title} content={modal.content} onClose={() => setModal(null)} />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 22 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pageTitle: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: -1.2 },
  versionBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  versionTxt: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  // Profile card
  profileCard: {
    borderRadius: 22, borderWidth: 1, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  profileInfo: { flex: 1, minWidth: 0, gap: 3 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  profileName: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2,
  },
  verifiedTxt: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  profileEmail: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  profileMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },

  // Theme
  themeWrap: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 14, gap: 12 },
  themeHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 11,
  },
  themeChipLabel: { fontSize: 13 },

  // Segment
  segRow: { flexDirection: 'row', gap: 5 },
  segChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  segLabel: { fontSize: 13 },

  // Sign out
  signOutBtn: {
    borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, gap: 10,
  },
  signOutLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  // Footer
  footer: { alignItems: 'center', paddingTop: 24, gap: 5, borderTopWidth: StyleSheet.hairlineWidth },
  footerBrand: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  footerTag: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  footerDisc: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16, paddingHorizontal: 20 },
});
