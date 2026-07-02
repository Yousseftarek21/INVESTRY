import React, { useState, useEffect, useRef } from 'react';
import {
  Alert, Animated, Linking, Modal, Platform, Pressable, ScrollView,
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
import { useMarketPrices } from '@/hooks/usePrices';
import { Language } from '@/i18n';

const APP_VERSION = '1.0.0';
const BUILD = '100';

// ─── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ initials, size = 68 }: { initials: string; size?: number }) {
  const colors = useColors();
  return (
    <View style={[av.ring, {
      width: size + 5, height: size + 5,
      borderRadius: (size + 5) / 2,
      borderColor: colors.primary,
    }]}>
      <View style={[av.circle, {
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primary + '22',
      }]}>
        <Text style={[av.text, { fontSize: size * 0.37, color: colors.primary }]}>
          {initials}
        </Text>
      </View>
    </View>
  );
}
const av = StyleSheet.create({
  ring: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
});

// ─── Section ───────────────────────────────────────────────────────────────────

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
  wrap: { gap: 8 },
  header: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.5, marginLeft: 4 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});

// ─── Divider ───────────────────────────────────────────────────────────────────

function Divider({ indent = 56 }: { indent?: number }) {
  const colors = useColors();
  return <View style={[div.line, { backgroundColor: colors.border, marginLeft: indent }]} />;
}
const div = StyleSheet.create({ line: { height: StyleSheet.hairlineWidth } });

// ─── Icon badge ────────────────────────────────────────────────────────────────

function IconBadge({ icon, bg }: { icon: keyof typeof Feather.glyphMap; bg: string }) {
  return (
    <View style={[ib.badge, { backgroundColor: bg }]}>
      <Feather name={icon} size={15} color="#fff" />
    </View>
  );
}
const ib = StyleSheet.create({
  badge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

// ─── Nav row ───────────────────────────────────────────────────────────────────

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
        style={nr.row} onPress={onPress}
        activeOpacity={onPress ? 0.55 : 1} disabled={!onPress}
      >
        <IconBadge icon={icon} bg={iconBg} />
        <View style={nr.body}>
          <Text style={[nr.label, { color: destructive ? colors.red : colors.text }]}>{label}</Text>
          {sublabel ? <Text style={[nr.sub, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
        </View>
        <View style={nr.right}>
          {value ? <Text style={[nr.val, { color: colors.mutedForeground }]}>{value}</Text> : null}
          {onPress ? <Feather name="chevron-right" size={16} color={colors.mutedForeground} /> : null}
        </View>
      </TouchableOpacity>
      {!last && <Divider />}
    </>
  );
}
const nr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14, minHeight: 54 },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  val: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});

// ─── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  icon, iconBg, label, sublabel, value, onChange, last,
}: {
  icon: keyof typeof Feather.glyphMap; iconBg: string; label: string;
  sublabel?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
}) {
  const colors = useColors();
  return (
    <>
      <View style={nr.row}>
        <IconBadge icon={icon} bg={iconBg} />
        <View style={nr.body}>
          <Text style={[nr.label, { color: colors.text }]}>{label}</Text>
          {sublabel ? <Text style={[nr.sub, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
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

// ─── Detail modal ──────────────────────────────────────────────────────────────

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
          <Text style={[dm.content, { color: colors.textSecondary ?? colors.mutedForeground }]}>{content}</Text>
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

// ─── Theme preview cards ────────────────────────────────────────────────────────

function ThemeMiniPreview({ mode }: { mode: ThemeMode }) {
  const isDark = mode === 'dark' || mode === 'system';
  const bg      = mode === 'light' ? '#F5F5F7' : mode === 'dark' ? '#060D1A' : '#0F1923';
  const card    = mode === 'light' ? '#FFFFFF'  : mode === 'dark' ? '#0D1B2E' : '#162235';
  const accent  = '#D4AC0D';
  const line1   = mode === 'light' ? '#E5E5EA' : '#1E3050';
  const line2   = mode === 'light' ? '#D1D1D6' : '#162440';

  return (
    <View style={[tmp.preview, { backgroundColor: bg }]}>
      {/* Fake status bar */}
      <View style={[tmp.topBar, { backgroundColor: accent }]} />
      {/* Fake card */}
      <View style={[tmp.card, { backgroundColor: card }]}>
        <View style={[tmp.row1, { backgroundColor: accent + (isDark ? '40' : '30') }]} />
        <View style={[tmp.row2, { backgroundColor: line1 }]} />
        <View style={[tmp.row3, { backgroundColor: line2 }]} />
      </View>
      {/* Fake bottom bar */}
      <View style={tmp.tabRow}>
        {[0,1,2,3].map(i => (
          <View key={i} style={[tmp.tabDot, { backgroundColor: i === 0 ? accent : line1 }]} />
        ))}
      </View>
    </View>
  );
}
const tmp = StyleSheet.create({
  preview: { height: 72, borderRadius: 11, overflow: 'hidden', padding: 6, justifyContent: 'space-between' },
  topBar: { height: 4, borderRadius: 2, width: '60%', alignSelf: 'center', marginBottom: 2 },
  card: { flex: 1, borderRadius: 6, padding: 5, gap: 3, marginBottom: 4 },
  row1: { height: 8, borderRadius: 3, width: '55%' },
  row2: { height: 4, borderRadius: 2, width: '80%' },
  row3: { height: 4, borderRadius: 2, width: '65%' },
  tabRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8 },
  tabDot: { width: 14, height: 3, borderRadius: 2 },
});

function ThemePicker({ value, onChange }: { value: ThemeMode; onChange: (m: ThemeMode) => void }) {
  const colors = useColors();
  const THEMES: { key: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'light',  label: 'Light',  icon: 'sun' },
    { key: 'dark',   label: 'Dark',   icon: 'moon' },
    { key: 'system', label: 'Auto',   icon: 'smartphone' },
  ];

  const scales = useRef(THEMES.map(() => new Animated.Value(1))).current;

  const tap = (key: ThemeMode, i: number) => {
    onChange(key);
    Animated.sequence([
      Animated.timing(scales[i], { toValue: 0.92, duration: 80, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scales[i],  { toValue: 1,    useNativeDriver: Platform.OS !== 'web', speed: 20 }),
    ]).start();
  };

  return (
    <View style={tp.wrap}>
      {THEMES.map((item, i) => {
        const active = value === item.key;
        return (
          <Animated.View key={item.key} style={[tp.cardWrap, { transform: [{ scale: scales[i] }] }]}>
            <Pressable onPress={() => tap(item.key, i)} style={[
              tp.card,
              {
                borderColor: active ? colors.primary : colors.border,
                borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                backgroundColor: colors.background,
              },
            ]}>
              <ThemeMiniPreview mode={item.key} />
              <View style={tp.labelRow}>
                <Feather name={item.icon} size={11} color={active ? colors.primary : colors.mutedForeground} />
                <Text style={[tp.label, { color: active ? colors.primary : colors.mutedForeground, fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
                  {item.label}
                </Text>
              </View>
              {active && (
                <View style={[tp.check, { backgroundColor: colors.primary }]}>
                  <Feather name="check" size={8} color="#fff" />
                </View>
              )}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
const tp = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 18 },
  cardWrap: { flex: 1 },
  card: { borderRadius: 14, padding: 8, gap: 8, overflow: 'hidden' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontSize: 12 },
  check: { position: 'absolute', top: 7, right: 7, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

// ─── Market status card ────────────────────────────────────────────────────────

function MarketStatusCard({ onRefresh, isRefreshing }: { onRefresh: () => void; isRefreshing: boolean }) {
  const colors = useColors();
  const { data: prices, dataUpdatedAt } = useMarketPrices();

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  // Egyptian market hours (Sun–Thu 10:00–14:30 CLT = UTC+2)
  const now  = new Date();
  const day  = now.getUTCDay();     // 0=Sun,1=Mon…6=Sat
  const hour = now.getUTCHours() * 60 + now.getUTCMinutes();
  const egxOpen = day >= 0 && day <= 4 && hour >= 480 && hour < 750; // 10:00–12:30 UTC = 12:00–14:30 CLT
  const connected = !!prices;

  const dotOp = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotOp, { toValue: 0.2, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(dotOp, { toValue: 1,   duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);

  const StatusRow = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <View style={ms.statusRow}>
      <Text style={[ms.statusLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[ms.statusValue, { color: color ?? colors.text }]}>{value}</Text>
    </View>
  );

  return (
    <View style={[ms.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={ms.cardHeader}>
        <View style={ms.headerLeft}>
          <View style={[ms.iconWrap, { backgroundColor: connected ? colors.green + '20' : colors.red + '20' }]}>
            <Feather name="wifi" size={14} color={connected ? colors.green : colors.red} />
          </View>
          <View>
            <Text style={[ms.cardTitle, { color: colors.text }]}>Market Data</Text>
            <View style={ms.liveRow}>
              <Animated.View style={[ms.dot, { backgroundColor: connected ? colors.green : colors.red, opacity: dotOp }]} />
              <Text style={[ms.liveText, { color: connected ? colors.green : colors.red }]}>
                {connected ? 'Connected' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[ms.refreshBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '35' }]}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Feather name="refresh-cw" size={13} color={colors.primary} />
          <Text style={[ms.refreshTxt, { color: colors.primary }]}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={[ms.divider, { backgroundColor: colors.border }]} />

      {/* Status grid */}
      <View style={ms.grid}>
        <StatusRow label="Last Update" value={lastUpdate} />
        <StatusRow label="Gold Source" value="gold-api.com" />
        <StatusRow label="FX Provider" value="er-api.com" />
        <StatusRow
          label="EGX Market"
          value={egxOpen ? 'Open' : 'Closed'}
          color={egxOpen ? colors.green : colors.mutedForeground}
        />
        <StatusRow
          label="API Health"
          value={connected ? 'Healthy' : 'Degraded'}
          color={connected ? colors.green : colors.red}
        />
        <StatusRow label="USD/EGP" value={prices ? prices.usdToEgp.toFixed(3) : '—'} />
      </View>
    </View>
  );
}
const ms = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  refreshTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  grid: { padding: 16, gap: 10 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  statusValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});

// ─── Smart footer ──────────────────────────────────────────────────────────────

function SmartFooter({ lastApiUpdate }: { lastApiUpdate: string }) {
  const colors = useColors();
  const year = new Date().getFullYear();
  return (
    <View style={[sf.wrap, { borderTopColor: colors.border }]}>
      <Text style={[sf.brand, { color: colors.primary }]}>INVSTRY</Text>
      <View style={sf.meta}>
        <MetaRow label="Version" value={`${APP_VERSION} (${BUILD})`} colors={colors} />
        <MetaRow label="Last API Update" value={lastApiUpdate} colors={colors} />
        <MetaRow label="Data Storage" value="On-device only" colors={colors} />
      </View>
      <Text style={[sf.copy, { color: colors.mutedForeground }]}>© {year} INVSTRY · Egypt Investment Tracker</Text>
      <Text style={[sf.disc, { color: colors.mutedForeground }]}>
        Market data is for informational purposes only and does not constitute financial advice. Prices may be delayed.
      </Text>
    </View>
  );
}
function MetaRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={sf.metaRow}>
      <Text style={[sf.metaLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[sf.metaValue, { color: colors.mutedForeground }]}>{value}</Text>
    </View>
  );
}
const sf = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 28, alignItems: 'center', gap: 14 },
  brand: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 3.5 },
  meta: { width: '100%', gap: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  metaValue: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  copy: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  disc: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16, paddingHorizontal: 8, opacity: 0.7 },
});

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const t        = useT();
  const router   = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const {
    themeMode, language, weightUnit, hapticsEnabled, analyticsEnabled, notifications,
    setThemeMode, setLanguage, setWeightUnit, setHapticsEnabled, setAnalyticsEnabled, setNotification,
  } = useAppSettings();
  const { holdings, removeHolding } = useHoldings();
  const { data: prices, dataUpdatedAt, refetch: refetchPrices, isFetching } = useMarketPrices();

  const [modal, setModal]         = useState<{ title: string; content: string } | null>(null);
  const [langOpen, setLangOpen]   = useState(false);
  const [hideValues, setHideValues] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@invstry_hide_values').then(v => {
      if (v === 'true') setHideValues(true);
    });
  }, []);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  // ── User info ──────────────────────────────────────────────────────────────
  const firstName = user?.firstName ?? '';
  const lastName  = user?.lastName  ?? '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'Investor';
  const email     = user?.emailAddresses?.[0]?.emailAddress ?? '';
  const verified  = user?.hasVerifiedEmailAddress ?? false;
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()
                    || email[0]?.toUpperCase() || 'I';

  const lastApiUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  // ── Helpers ────────────────────────────────────────────────────────────────
  const haptic   = (s = Haptics.ImpactFeedbackStyle.Light) => { if (hapticsEnabled) Haptics.impactAsync(s); };
  const showModal = (title: string, content: string) => { haptic(); setModal({ title, content }); };
  const openURL   = (url: string) => { haptic(); Linking.openURL(url).catch(() => Alert.alert('Could not open link')); };

  const handleTheme = async (mode: ThemeMode) => { haptic(); await setThemeMode(mode); };
  const handleLang  = async (lang: Language)  => { haptic(); await setLanguage(lang); setLangOpen(false); };
  const handleHideValues = async (v: boolean) => {
    haptic(); setHideValues(v);
    await AsyncStorage.setItem('@invstry_hide_values', String(v));
  };

  const handleClearCache = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Clear Cache', 'Removes temporary price data. Your investments are safe.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await AsyncStorage.removeItem('@invstry_price_cache');
        if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }},
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
      'Permanently removes all investments and preferences. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: async () => {
          for (const h of holdings) removeHolding(h.id);
          await AsyncStorage.multiRemove([
            '@invstry_theme', '@invstry_lang', '@invstry_weight',
            '@invstry_haptics', '@invstry_analytics', '@invstry_notif', '@invstry_hide_values',
          ]);
          if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }},
      ]
    );
  };

  const handleSignOut = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await signOut();
        router.replace('/(auth)/welcome' as any);
      }},
    ]);
  };

  return (
    <>
      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[s.content, { paddingTop: topPad + 16, paddingBottom: botPad + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page title ─────────────────────────────────────────────── */}
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
          onPress={() => showModal('Account Details',
            `Name: ${fullName}\nEmail: ${email}\nVerified: ${verified ? 'Yes ✓' : 'Pending'}\n\nHoldings: ${holdings.length} investment${holdings.length !== 1 ? 's' : ''}\nData: Stored locally on your device`
          )}
        >
          <Avatar initials={initials} size={62} />
          <View style={s.profileInfo}>
            <View style={s.profileNameRow}>
              <Text style={[s.profileName, { color: colors.text }]} numberOfLines={1}>{fullName}</Text>
              {verified && (
                <View style={[s.verifiedBadge, { backgroundColor: colors.green + '1A', borderColor: colors.green + '40' }]}>
                  <Feather name="check-circle" size={10} color={colors.green} />
                  <Text style={[s.verifiedTxt, { color: colors.green }]}>Verified</Text>
                </View>
              )}
            </View>
            <Text style={[s.profileEmail, { color: colors.mutedForeground }]} numberOfLines={1}>{email}</Text>
            <Text style={[s.profileMeta, { color: colors.mutedForeground }]}>
              {holdings.length} holding{holdings.length !== 1 ? 's' : ''} · Egypt Portfolio
            </Text>
          </View>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* ── APPEARANCE ───────────────────────────────────────────── */}
        <Section label="APPEARANCE">
          <View style={s.themeHeader}>
            <View style={[s.themeIconWrap, { backgroundColor: '#8B5CF620' }]}>
              <Feather name="eye" size={13} color="#8B5CF6" />
            </View>
            <Text style={[nr.label, { color: colors.text }]}>Theme</Text>
          </View>
          <ThemePicker value={themeMode} onChange={handleTheme} />
          <Divider indent={0} />
          {/* Language */}
          <TouchableOpacity
            style={nr.row}
            onPress={() => { haptic(); setLangOpen(v => !v); }}
            activeOpacity={0.6}
          >
            <IconBadge icon="globe" bg="#0EA5E9" />
            <View style={nr.body}>
              <Text style={[nr.label, { color: colors.text }]}>Language</Text>
            </View>
            <View style={nr.right}>
              <Text style={[nr.val, { color: colors.mutedForeground }]}>{language === 'ar' ? 'عربي' : 'English'}</Text>
              <Feather name={langOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.mutedForeground} />
            </View>
          </TouchableOpacity>
          {langOpen && (
            <>
              <Divider indent={0} />
              {(['en', 'ar'] as Language[]).map((lang, i, arr) => {
                const active = language === lang;
                return (
                  <React.Fragment key={lang}>
                    <TouchableOpacity
                      style={[nr.row, { paddingLeft: 62, backgroundColor: active ? colors.primary + '12' : 'transparent' }]}
                      onPress={() => handleLang(lang)} activeOpacity={0.6}
                    >
                      <Text style={[nr.label, { color: active ? colors.primary : colors.text, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                        {lang === 'ar' ? 'عربي — Arabic' : 'English'}
                      </Text>
                      {active && <Feather name="check" size={15} color={colors.primary} />}
                    </TouchableOpacity>
                    {i < arr.length - 1 && <Divider indent={62} />}
                  </React.Fragment>
                );
              })}
            </>
          )}
        </Section>

        {/* ── PORTFOLIO ─────────────────────────────────────────────── */}
        <Section label="PORTFOLIO">
          <View style={nr.row}>
            <IconBadge icon="sliders" bg="#059669" />
            <View style={nr.body}>
              <Text style={[nr.label, { color: colors.text }]}>Weight Unit</Text>
              <Text style={[nr.sub, { color: colors.mutedForeground }]}>Gold & silver display unit</Text>
            </View>
            <View style={s.segRow}>
              {(['g', 'oz'] as WeightUnit[]).map(u => {
                const active = weightUnit === u;
                return (
                  <TouchableOpacity
                    key={u}
                    style={[s.segChip, { backgroundColor: active ? colors.primary : colors.muted }]}
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
          <NavRow icon="eye-off" iconBg="#374151" label="Hide Portfolio Values"
            sublabel="Mask balances for privacy"
            value={hideValues ? 'On' : 'Off'}
            onPress={() => handleHideValues(!hideValues)} />
          <NavRow icon="refresh-cw" iconBg="#0EA5E9" label="Auto-refresh" value="Every 60s" last />
        </Section>

        {/* ── NOTIFICATIONS ─────────────────────────────────────────── */}
        <Section label="NOTIFICATIONS">
          <ToggleRow icon="bell"      iconBg="#F59E0B" label="Price Alerts"    sublabel="Gold, silver & FX movements" value={notifications.priceAlerts}     onChange={v => setNotification('priceAlerts', v)} />
          <ToggleRow icon="briefcase" iconBg="#8B5CF6" label="Portfolio Alerts" sublabel="Significant portfolio moves"  value={notifications.portfolioAlerts}  onChange={v => setNotification('portfolioAlerts', v)} />
          <ToggleRow icon="sun"       iconBg="#EF4444" label="Daily Summary"    sublabel="Morning portfolio snapshot"   value={notifications.dailySummary}     onChange={v => setNotification('dailySummary', v)} />
          <ToggleRow icon="calendar"  iconBg="#10B981" label="Weekly Report"    sublabel="End-of-week performance"      value={notifications.weeklySummary}    onChange={v => setNotification('weeklySummary', v)} last />
        </Section>

        {/* ── MARKET DATA STATUS ────────────────────────────────────── */}
        <View style={sec.wrap}>
          <Text style={[sec.header, { color: colors.mutedForeground }]}>MARKET DATA</Text>
          <MarketStatusCard onRefresh={() => { haptic(); refetchPrices(); }} isRefreshing={isFetching} />
        </View>

        {/* ── PRIVACY & SECURITY ────────────────────────────────────── */}
        <Section label="PRIVACY & SECURITY">
          <ToggleRow icon="activity"     iconBg="#6366F1" label="Analytics"      sublabel="Anonymous usage data"        value={analyticsEnabled}  onChange={v => setAnalyticsEnabled(v)} />
          <ToggleRow icon="alert-circle" iconBg="#F97316" label="Crash Reports"  sublabel="Auto-send crash logs"        value={analyticsEnabled}  onChange={v => setAnalyticsEnabled(v)} />
          <ToggleRow icon="zap"          iconBg="#FBBF24" label="Haptic Feedback" sublabel="Vibration on interactions"  value={hapticsEnabled}    onChange={v => setHapticsEnabled(v)} />
          <NavRow icon="lock"       iconBg="#1D4ED8" label="App Lock"        value="Off"
            onPress={() => showModal('App Lock', 'Biometric and passcode lock can be configured in your device Settings → Privacy & Security.')} />
          <NavRow icon="shield"     iconBg="#047857" label="Privacy Settings" onPress={() => Linking.openSettings()} />
          <NavRow icon="download"   iconBg="#0EA5E9" label="Export My Data"   onPress={handleExportData} />
          <NavRow icon="trash-2"    iconBg={colors.red} label="Delete All Data" onPress={handleDeleteAll} destructive last />
        </Section>

        {/* ── SUPPORT ───────────────────────────────────────────────── */}
        <Section label="SUPPORT">
          <NavRow icon="help-circle" iconBg="#0EA5E9" label="Help Center" onPress={() =>
            showModal('Help Center', 'INVSTRY tracks your gold, silver, EGX stocks, and real estate in one place.\n\n• Pull down to refresh prices\n• Tap + on the Investments tab to add a holding\n• Swipe left on a holding to delete it\n• Toggle Arabic in Settings → Language\n\nFor help: support@invstry.app')} />
          <NavRow icon="mail"  iconBg="#10B981" label="Contact Support"   onPress={() => openURL('mailto:support@invstry.app?subject=INVSTRY Support')} />
          <NavRow icon="flag"  iconBg="#F59E0B" label="Report a Bug"      onPress={() => openURL('mailto:bugs@invstry.app?subject=Bug Report — INVSTRY v' + APP_VERSION)} />
          <NavRow icon="star"  iconBg="#EF4444" label="Rate on App Store" onPress={() =>
            showModal('Rate INVSTRY', 'Thank you! App Store rating will be available once the app is published.')} last />
        </Section>

        {/* ── LEGAL ─────────────────────────────────────────────────── */}
        <Section label="LEGAL">
          <NavRow icon="file-text"    iconBg="#374151" label="Terms of Service" onPress={() =>
            showModal('Terms of Service', 'Last updated: July 2025\n\nINVSTRY is provided for informational purposes only. Nothing in this app constitutes financial advice, investment advice, or a recommendation to buy or sell any asset.\n\nAll investment data is sourced from third-party providers and may not be 100% accurate or up to date. Past performance does not guarantee future results.\n\nYou agree to use this app at your own risk.')} />
          <NavRow icon="lock"         iconBg="#4B5563" label="Privacy Policy"   onPress={() =>
            showModal('Privacy Policy', 'Last updated: July 2025\n\nINVSTRY does not collect or store any personal data on external servers. All portfolio data is stored locally on your device.\n\nThird-Party Services: api.gold-api.com, Yahoo Finance, open.er-api.com\n\nAnalytics (optional): Anonymized usage data only. No PII collected.\n\nContact: privacy@invstry.app')} />
          <NavRow icon="alert-circle" iconBg="#7C3AED" label="Regulatory Disclaimer" onPress={() =>
            showModal('Regulatory Disclaimer', 'INVSTRY is not a registered investment advisor, broker-dealer, or financial institution.\n\nThis application does not provide personalized investment advice. Market data is for informational purposes only.\n\nAlways verify prices with a certified financial professional before making investment decisions.')} />
          <NavRow icon="code"         iconBg="#6B7280" label="Open Source Licenses" onPress={() =>
            showModal('Open Source', 'Built with:\n\n• Expo SDK 54\n• React Native 0.81\n• React Query (@tanstack/react-query)\n• AsyncStorage\n• expo-haptics\n• Inter font (Google Fonts)\n• @expo/vector-icons (Feather)\n• Clerk Authentication\n• react-native-svg')} last />
        </Section>

        {/* ── SIGN OUT ───────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[s.signOutBtn, { backgroundColor: colors.red + '14', borderColor: colors.red + '35' }]}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={17} color={colors.red} />
          <Text style={[s.signOutLabel, { color: colors.red }]}>Sign Out</Text>
        </TouchableOpacity>

        {/* ── SMART FOOTER ──────────────────────────────────────────── */}
        <SmartFooter lastApiUpdate={lastApiUpdate} />
      </ScrollView>

      {modal && (
        <DetailModal visible title={modal.title} content={modal.content} onClose={() => setModal(null)} />
      )}
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 24 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: -1.2 },
  versionBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  versionTxt: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  // Profile card
  profileCard: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 15 },
  profileInfo: { flex: 1, minWidth: 0, gap: 4 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  profileName: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedTxt: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  profileEmail: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  profileMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  // Theme section header
  themeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  themeIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Segment
  segRow: { flexDirection: 'row', gap: 5 },
  segChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  segLabel: { fontSize: 13 },

  // Sign out
  signOutBtn: { borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  signOutLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
