/**
 * Settings — Investry
 * Polished account & preferences hub.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Alert, Animated, Linking, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View,
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
const COPYRIGHT_YEAR = new Date().getFullYear();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useHaptic() {
  const { hapticsEnabled } = useAppSettings();
  return useCallback((style = Haptics.ImpactFeedbackStyle.Light) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  }, [hapticsEnabled]);
}

// ─── Pulsing live dot ─────────────────────────────────────────────────────────

function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.2, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: 1,   duration: 900, useNativeDriver: Platform.OS !== 'web' }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }} />;
}

// ─── Icon badge ────────────────────────────────────────────────────────────────

function Bdg({ icon, bg }: { icon: keyof typeof Feather.glyphMap; bg: string }) {
  return (
    <View style={[bdg.wrap, { backgroundColor: bg }]}>
      <Feather name={icon} size={15} color="#fff" />
    </View>
  );
}
const bdg = StyleSheet.create({
  wrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

// ─── Row divider ──────────────────────────────────────────────────────────────

function Div({ left = 62 }: { left?: number }) {
  const colors = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: left }} />;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Sect({ label, children, noCard }: { label: string; children: React.ReactNode; noCard?: boolean }) {
  const colors = useColors();
  const content = noCard ? children : (
    <View style={[sct.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
  return (
    <View style={sct.wrap}>
      <Text style={[sct.label, { color: colors.mutedForeground }]}>{label}</Text>
      {content}
    </View>
  );
}
const sct = StyleSheet.create({
  wrap: { gap: 9 },
  label: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.6, marginLeft: 5 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});

// ─── Nav row ───────────────────────────────────────────────────────────────────

function NavRow({
  icon, iconBg, label, sublabel, value, badge, onPress, last, destructive,
}: {
  icon: keyof typeof Feather.glyphMap; iconBg: string; label: string;
  sublabel?: string; value?: string; badge?: { text: string; color: string };
  onPress?: () => void; last?: boolean; destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <>
      <TouchableOpacity
        style={rw.row} onPress={onPress}
        activeOpacity={onPress ? 0.5 : 1} disabled={!onPress}
      >
        <Bdg icon={icon} bg={iconBg} />
        <View style={rw.body}>
          <Text style={[rw.label, { color: destructive ? colors.red : colors.text }]}>{label}</Text>
          {sublabel ? <Text style={[rw.sub, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
        </View>
        <View style={rw.trail}>
          {badge ? (
            <View style={[rw.badge, { backgroundColor: badge.color + '20', borderColor: badge.color + '40' }]}>
              <Text style={[rw.badgeTxt, { color: badge.color }]}>{badge.text}</Text>
            </View>
          ) : null}
          {value ? <Text style={[rw.val, { color: colors.mutedForeground }]}>{value}</Text> : null}
          {onPress ? <Feather name="chevron-right" size={16} color={colors.mutedForeground} /> : null}
        </View>
      </TouchableOpacity>
      {!last && <Div />}
    </>
  );
}
const rw = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14, minHeight: 56 },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  trail: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  val: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  badge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
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
      <View style={rw.row}>
        <Bdg icon={icon} bg={iconBg} />
        <View style={rw.body}>
          <Text style={[rw.label, { color: colors.text }]}>{label}</Text>
          {sublabel ? <Text style={[rw.sub, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
        </View>
        <Switch
          value={value} onValueChange={onChange}
          trackColor={{ false: colors.muted, true: colors.primary }}
          thumbColor={Platform.OS === 'android' ? (value ? colors.primary : colors.mutedForeground) : undefined}
          ios_backgroundColor={colors.muted}
        />
      </View>
      {!last && <Div />}
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
      <View style={[mo.container, { backgroundColor: colors.background }]}>
        <View style={[mo.header, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <Text style={[mo.title, { color: colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={[mo.close, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[mo.body, { paddingBottom: insets.bottom + 40 }]}>
          <Text style={[mo.content, { color: colors.textSecondary }]}>{content}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
const mo = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', flex: 1 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 24 },
  content: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 26 },
});

// ─── Profile hero card ────────────────────────────────────────────────────────

function ProfileHero({
  initials, fullName, email, verified, holdingsCount, onPress,
}: {
  initials: string; fullName: string; email: string;
  verified: boolean; holdingsCount: number; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress} activeOpacity={0.75}
      style={[ph.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* Gold accent line at top of card */}
      <View style={[ph.accentBar, { backgroundColor: colors.primary }]} />

      <View style={ph.inner}>
        {/* Avatar */}
        <View style={ph.avatarArea}>
          <View style={[ph.avatarRing, { borderColor: colors.primary }]}>
            <View style={[ph.avatarCircle, { backgroundColor: colors.primary + '1A' }]}>
              <Text style={[ph.avatarText, { color: colors.primary }]}>{initials}</Text>
            </View>
          </View>
          {verified && (
            <View style={[ph.verifyDot, { backgroundColor: colors.green, borderColor: colors.card }]}>
              <Feather name="check" size={7} color="#fff" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={ph.info}>
          <Text style={[ph.name, { color: colors.text }]} numberOfLines={1}>{fullName}</Text>
          <Text style={[ph.email, { color: colors.mutedForeground }]} numberOfLines={1}>{email}</Text>

          <View style={ph.tagsRow}>
            {verified ? (
              <View style={[ph.tag, { backgroundColor: colors.green + '18', borderColor: colors.green + '38' }]}>
                <Feather name="shield" size={9} color={colors.green} />
                <Text style={[ph.tagTxt, { color: colors.green }]}>Verified</Text>
              </View>
            ) : (
              <View style={[ph.tag, { backgroundColor: colors.red + '14', borderColor: colors.red + '30' }]}>
                <Feather name="alert-circle" size={9} color={colors.red} />
                <Text style={[ph.tagTxt, { color: colors.red }]}>Unverified</Text>
              </View>
            )}
            <View style={[ph.tag, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '38' }]}>
              <Feather name="briefcase" size={9} color={colors.primary} />
              <Text style={[ph.tagTxt, { color: colors.primary }]}>{holdingsCount} Holdings</Text>
            </View>
          </View>
        </View>

        <Feather name="chevron-right" size={17} color={colors.mutedForeground} style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );
}
const ph = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  accentBar: { height: 3, width: '100%' },
  inner: { flexDirection: 'row', alignItems: 'flex-start', padding: 18, gap: 15 },
  avatarArea: { flexShrink: 0, position: 'relative' },
  avatarRing: { width: 74, height: 74, borderRadius: 37, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatarCircle: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  verifyDot: { position: 'absolute', bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 4, paddingTop: 2 },
  name: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  email: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  tagTxt: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});

// ─── Theme preview cards ───────────────────────────────────────────────────────

function ThemeMiniPreview({ mode }: { mode: ThemeMode }) {
  const bg   = mode === 'light' ? '#F5F5F7' : mode === 'dark' ? '#060D1A' : '#0D1520';
  const card = mode === 'light' ? '#FFFFFF'  : '#0F1D32';
  const a    = '#D4AC0D';
  const r1   = mode === 'light' ? '#EBE5D8' : '#1E3050';
  const r2   = mode === 'light' ? '#E0D8CA' : '#142540';
  return (
    <View style={[tm.preview, { backgroundColor: bg }]}>
      <View style={[tm.topBar, { backgroundColor: a }]} />
      <View style={[tm.fakeCard, { backgroundColor: card }]}>
        <View style={[tm.line, { backgroundColor: a + '50', width: '55%' }]} />
        <View style={[tm.lineNarrow, { backgroundColor: r1 }]} />
        <View style={[tm.lineNarrow, { backgroundColor: r2, width: '60%' }]} />
      </View>
      <View style={tm.tabRow}>
        {[0,1,2,3].map(i => (
          <View key={i} style={[tm.tabDot, { backgroundColor: i === 0 ? a : r1 }]} />
        ))}
      </View>
    </View>
  );
}
const tm = StyleSheet.create({
  preview: { height: 76, borderRadius: 12, overflow: 'hidden', padding: 7, justifyContent: 'space-between' },
  topBar: { height: 4, borderRadius: 2, width: '60%', alignSelf: 'center', marginBottom: 2 },
  fakeCard: { flex: 1, borderRadius: 7, padding: 6, gap: 4, marginBottom: 5 },
  line: { height: 8, borderRadius: 4 },
  lineNarrow: { height: 4, borderRadius: 2, width: '80%' },
  tabRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 6 },
  tabDot: { width: 14, height: 3, borderRadius: 2 },
});

const THEME_OPTS: { key: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'light',  label: 'Light',  icon: 'sun' },
  { key: 'dark',   label: 'Dark',   icon: 'moon' },
  { key: 'system', label: 'Auto',   icon: 'smartphone' },
];

function ThemePicker({ value, onChange }: { value: ThemeMode; onChange: (m: ThemeMode) => void }) {
  const colors = useColors();
  const scales = useRef(THEME_OPTS.map(() => new Animated.Value(1))).current;

  const tap = (key: ThemeMode, i: number) => {
    onChange(key);
    Animated.sequence([
      Animated.timing(scales[i], { toValue: 0.93, duration: 70, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scales[i],  { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 22 }),
    ]).start();
  };

  return (
    <View style={[tpk.row, { paddingHorizontal: 14, paddingBottom: 16 }]}>
      {THEME_OPTS.map((item, i) => {
        const active = value === item.key;
        return (
          <Animated.View key={item.key} style={[tpk.cardWrap, { transform: [{ scale: scales[i] }] }]}>
            <Pressable
              onPress={() => tap(item.key, i)}
              style={[tpk.card, {
                borderColor: active ? colors.primary : colors.border,
                borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                backgroundColor: colors.background,
              }]}
            >
              <ThemeMiniPreview mode={item.key} />
              <View style={tpk.labelRow}>
                <Feather name={item.icon} size={11} color={active ? colors.primary : colors.mutedForeground} />
                <Text style={[tpk.label, {
                  color: active ? colors.primary : colors.mutedForeground,
                  fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
                }]}>{item.label}</Text>
              </View>
              {active && (
                <View style={[tpk.check, { backgroundColor: colors.primary }]}>
                  <Feather name="check" size={8} color={colors.primaryForeground} />
                </View>
              )}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
const tpk = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  cardWrap: { flex: 1 },
  card: { borderRadius: 15, padding: 8, gap: 8, overflow: 'hidden' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { fontSize: 12 },
  check: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

// ─── Market status card ────────────────────────────────────────────────────────

function MarketStatusCard({ onRefresh }: { onRefresh: () => void }) {
  const colors = useColors();
  const { data: prices, dataUpdatedAt, isFetching } = useMarketPrices();

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const now  = new Date();
  const day  = now.getUTCDay();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const egxOpen = day >= 0 && day <= 4 && mins >= 480 && mins < 750;
  const ok = !!prices;

  const StatusPair = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <View style={msc.pair}>
      <Text style={[msc.pairLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[msc.pairValue, { color: color ?? colors.text }]}>{value}</Text>
    </View>
  );

  return (
    <View style={[msc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={msc.header}>
        <View style={msc.headerLeft}>
          <View style={[msc.iconWrap, { backgroundColor: (ok ? colors.green : colors.red) + '1A' }]}>
            <Feather name="activity" size={15} color={ok ? colors.green : colors.red} />
          </View>
          <View style={{ gap: 3 }}>
            <Text style={[msc.title, { color: colors.text }]}>Market Status</Text>
            <View style={msc.liveRow}>
              <PulseDot color={ok ? colors.green : colors.red} size={6} />
              <Text style={[msc.liveLabel, { color: ok ? colors.green : colors.red }]}>
                {ok ? 'Connected' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[msc.refreshBtn, {
            backgroundColor: isFetching ? colors.muted : colors.primary + '16',
            borderColor: isFetching ? colors.border : colors.primary + '38',
          }]}
          onPress={onRefresh} activeOpacity={0.7} disabled={isFetching}
        >
          <Feather name="refresh-cw" size={13} color={isFetching ? colors.mutedForeground : colors.primary} />
          <Text style={[msc.refreshTxt, { color: isFetching ? colors.mutedForeground : colors.primary }]}>
            {isFetching ? 'Updating…' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[msc.hr, { backgroundColor: colors.border }]} />

      <View style={msc.grid}>
        <StatusPair label="Last Update"   value={lastUpdate} />
        <StatusPair label="Gold Source"   value="gold-api.com" />
        <StatusPair label="FX Provider"   value="er-api.com" />
        <StatusPair label="USD/EGP Rate"  value={prices ? prices.usdToEgp.toFixed(3) : '—'} />
        <StatusPair
          label="EGX Market"
          value={egxOpen ? 'Open Now' : 'Closed'}
          color={egxOpen ? colors.green : colors.mutedForeground}
        />
        <StatusPair
          label="API Health"
          value={ok ? 'Healthy' : 'Degraded'}
          color={ok ? colors.green : colors.red}
        />
      </View>
    </View>
  );
}
const msc = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 },
  refreshTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  hr: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  grid: { padding: 16, gap: 11 },
  pair: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pairLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  pairValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});

// ─── Smart footer ──────────────────────────────────────────────────────────────

function SmartFooter({ lastUpdate }: { lastUpdate: string }) {
  const colors = useColors();
  return (
    <View style={[sf.wrap, { borderTopColor: colors.border }]}>
      <Text style={[sf.brand, { color: colors.primary }]}>INVSTRY</Text>
      <Text style={[sf.tagline, { color: colors.mutedForeground }]}>Egypt Investment Tracker</Text>
      <View style={sf.meta}>
        <View style={sf.metaRow}>
          <Text style={[sf.metaKey, { color: colors.mutedForeground }]}>Version</Text>
          <Text style={[sf.metaVal, { color: colors.mutedForeground }]}>{APP_VERSION} (Build {BUILD})</Text>
        </View>
        <View style={sf.metaRow}>
          <Text style={[sf.metaKey, { color: colors.mutedForeground }]}>Last API Update</Text>
          <Text style={[sf.metaVal, { color: colors.mutedForeground }]}>{lastUpdate}</Text>
        </View>
        <View style={sf.metaRow}>
          <Text style={[sf.metaKey, { color: colors.mutedForeground }]}>Data Storage</Text>
          <Text style={[sf.metaVal, { color: colors.mutedForeground }]}>On-device only</Text>
        </View>
      </View>
      <Text style={[sf.copy, { color: colors.mutedForeground }]}>
        © {COPYRIGHT_YEAR} INVSTRY. All rights reserved.
      </Text>
      <Text style={[sf.disc, { color: colors.mutedForeground }]}>
        Market data is for informational purposes only and does not constitute financial advice. Prices may be delayed or inaccurate. Past performance does not indicate future results.
      </Text>
    </View>
  );
}
const sf = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 32, alignItems: 'center', gap: 12 },
  brand: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: 4 },
  tagline: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: -4 },
  meta: { width: '100%', gap: 7 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaKey: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  metaVal: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  copy: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  disc: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16, opacity: 0.65 },
});

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const t       = useT();
  const router  = useRouter();
  const haptic  = useHaptic();
  const { signOut } = useClerk();
  const { user } = useUser();
  const {
    themeMode, language, weightUnit, hapticsEnabled, analyticsEnabled, notifications,
    setThemeMode, setLanguage, setWeightUnit, setHapticsEnabled, setAnalyticsEnabled, setNotification,
  } = useAppSettings();
  const { holdings, removeHolding } = useHoldings();
  const { data: prices, dataUpdatedAt, refetch: refetchPrices } = useMarketPrices();

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

  // User data
  const firstName = user?.firstName ?? '';
  const lastName  = user?.lastName  ?? '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'Investor';
  const email     = user?.emailAddresses?.[0]?.emailAddress ?? '';
  const verified  = user?.hasVerifiedEmailAddress ?? false;
  const initials  = ([firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()) || email[0]?.toUpperCase() || 'I';

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  const showModal = (title: string, content: string) => { haptic(); setModal({ title, content }); };
  const openURL   = (url: string) => { haptic(); Linking.openURL(url).catch(() => Alert.alert('Could not open link')); };

  const handleHideValues = async (v: boolean) => {
    haptic(); setHideValues(v);
    await AsyncStorage.setItem('@invstry_hide_values', String(v));
  };

  const handleDeleteAll = () => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert('Delete All Data',
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
        style={[sc.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[sc.content, { paddingTop: topPad + 16, paddingBottom: botPad + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page header ─────────────────────────────────── */}
        <View style={sc.pageHeader}>
          <Text style={[sc.pageTitle, { color: colors.text }]}>{t.settings}</Text>
        </View>

        {/* ── PROFILE HERO ─────────────────────────────────── */}
        <ProfileHero
          initials={initials} fullName={fullName} email={email}
          verified={verified} holdingsCount={holdings.length}
          onPress={() => showModal('Account Details',
            `Name: ${fullName}\nEmail: ${email}\nVerified: ${verified ? 'Yes ✓' : 'Pending'}\n\nHoldings: ${holdings.length} investment${holdings.length !== 1 ? 's' : ''}\nStorage: Locally on your device only\n\nFor account changes, sign out and sign in with updated credentials.`
          )}
        />

        {/* ── ACCOUNT & SECURITY ─────────────────────────── */}
        <Sect label="ACCOUNT & SECURITY">
          <NavRow icon="lock"    iconBg="#1D4ED8" label="Change Password"    onPress={() => showModal('Change Password', 'To change your password, sign out and use "Forgot Password" on the sign-in screen. Password management is handled securely by Clerk authentication.')} />
          <NavRow icon="eye"     iconBg="#047857" label="Face ID / Biometrics" value="Off"
            onPress={() => showModal('Biometrics', 'Biometric app lock coming soon. Configure face or fingerprint unlock to protect your portfolio without re-entering your password.')} />
          <NavRow icon="link"    iconBg="#6366F1" label="Connected Accounts" value="Coming Soon"
            onPress={() => showModal('Connected Accounts', 'Link bank accounts, brokerage accounts, and other financial services to automatically import holdings. Coming in a future update.')} last />
        </Sect>

        {/* ── APPEARANCE ───────────────────────────────────── */}
        <Sect label="APPEARANCE">
          {/* Theme label row */}
          <View style={sc.themeLabel}>
            <View style={[sc.themeLabelIcon, { backgroundColor: '#8B5CF620' }]}>
              <Feather name="eye" size={14} color="#8B5CF6" />
            </View>
            <Text style={[rw.label, { color: colors.text }]}>Theme</Text>
          </View>
          <ThemePicker value={themeMode} onChange={async m => { haptic(); await setThemeMode(m); }} />
        </Sect>

        {/* ── LANGUAGE & REGION ────────────────────────────── */}
        <Sect label="LANGUAGE & REGION">
          {/* Language row with inline dropdown */}
          <TouchableOpacity
            style={rw.row}
            onPress={() => { haptic(); setLangOpen(v => !v); }}
            activeOpacity={0.55}
          >
            <Bdg icon="globe" bg="#0EA5E9" />
            <View style={rw.body}>
              <Text style={[rw.label, { color: colors.text }]}>Language</Text>
            </View>
            <View style={rw.trail}>
              <Text style={[rw.val, { color: colors.mutedForeground }]}>{language === 'ar' ? 'عربي' : 'English'}</Text>
              <Feather name={langOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.mutedForeground} />
            </View>
          </TouchableOpacity>
          {langOpen && (
            <>
              <Div left={0} />
              {(['en', 'ar'] as Language[]).map((lang, i, arr) => {
                const active = language === lang;
                return (
                  <React.Fragment key={lang}>
                    <TouchableOpacity
                      style={[rw.row, { paddingLeft: 60, backgroundColor: active ? colors.primary + '10' : 'transparent' }]}
                      onPress={async () => { haptic(); await setLanguage(lang); setLangOpen(false); }}
                      activeOpacity={0.55}
                    >
                      <View style={rw.body}>
                        <Text style={[rw.label, { color: active ? colors.primary : colors.text, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                          {lang === 'ar' ? 'عربي — Arabic' : 'English'}
                        </Text>
                      </View>
                      {active && <Feather name="check" size={16} color={colors.primary} />}
                    </TouchableOpacity>
                    {i < arr.length - 1 && <Div left={60} />}
                  </React.Fragment>
                );
              })}
              <Div left={0} />
            </>
          )}
          <Div />
          <NavRow icon="map-pin"   iconBg="#EF4444" label="Region"        value="Egypt (EG)" />
          <NavRow icon="hash"      iconBg="#374151" label="Date Format"   value="DD/MM/YYYY" />
          <NavRow icon="type"      iconBg="#6B7280" label="Number Format" value="1,234.56" />
          <NavRow icon="dollar-sign" iconBg="#059669" label="Currency"    value="EGP (ج.م)" last />
        </Sect>

        {/* ── PORTFOLIO PREFERENCES ────────────────────────── */}
        <Sect label="PORTFOLIO">
          <View style={rw.row}>
            <Bdg icon="sliders" bg="#059669" />
            <View style={rw.body}>
              <Text style={[rw.label, { color: colors.text }]}>Weight Unit</Text>
              <Text style={[rw.sub, { color: colors.mutedForeground }]}>Gold & silver display unit</Text>
            </View>
            <View style={sc.segRow}>
              {(['g', 'oz'] as WeightUnit[]).map(u => {
                const active = weightUnit === u;
                return (
                  <TouchableOpacity
                    key={u}
                    style={[sc.segChip, { backgroundColor: active ? colors.primary : colors.muted }]}
                    onPress={() => { haptic(); setWeightUnit(u); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[sc.segLabel, {
                      color: active ? colors.primaryForeground : colors.mutedForeground,
                      fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
                    }]}>{u}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <Div />
          <NavRow icon="eye-off"     iconBg="#374151"   label="Hide Portfolio Values" sublabel="Mask balances for privacy"
            value={hideValues ? 'On' : 'Off'} onPress={() => handleHideValues(!hideValues)} />
          <NavRow icon="trending-up" iconBg="#6366F1"   label="Performance Calculation" value="FIFO" last />
        </Sect>

        {/* ── NOTIFICATIONS ────────────────────────────────── */}
        <Sect label="NOTIFICATIONS">
          <ToggleRow icon="bell"      iconBg="#F59E0B" label="Price Alerts"    sublabel="Gold, silver & FX movements"    value={notifications.priceAlerts}    onChange={v => setNotification('priceAlerts', v)} />
          <ToggleRow icon="briefcase" iconBg="#8B5CF6" label="Portfolio Alerts" sublabel="Significant portfolio changes"  value={notifications.portfolioAlerts} onChange={v => setNotification('portfolioAlerts', v)} />
          <ToggleRow icon="sun"       iconBg="#EF4444" label="Daily Summary"    sublabel="Morning portfolio snapshot"     value={notifications.dailySummary}    onChange={v => setNotification('dailySummary', v)} />
          <ToggleRow icon="calendar"  iconBg="#10B981" label="Weekly Report"    sublabel="End-of-week performance recap"  value={notifications.weeklySummary}   onChange={v => setNotification('weeklySummary', v)} last />
        </Sect>

        {/* ── MARKET DATA ──────────────────────────────────── */}
        <Sect label="MARKET DATA" noCard>
          <MarketStatusCard onRefresh={() => { haptic(); refetchPrices(); }} />
        </Sect>

        {/* ── PRIVACY & DATA ───────────────────────────────── */}
        <Sect label="PRIVACY & DATA">
          <ToggleRow icon="activity"     iconBg="#6366F1" label="Analytics Sharing" sublabel="Anonymous usage data to improve the app" value={analyticsEnabled} onChange={v => setAnalyticsEnabled(v)} />
          <ToggleRow icon="alert-circle" iconBg="#F97316" label="Crash Reports"     sublabel="Automatically send crash logs"           value={analyticsEnabled} onChange={v => setAnalyticsEnabled(v)} />
          <ToggleRow icon="zap"          iconBg="#FBBF24" label="Haptic Feedback"   sublabel="Vibration on interactions"               value={hapticsEnabled}   onChange={v => setHapticsEnabled(v)} />
          <NavRow icon="shield"   iconBg="#047857" label="Privacy Settings"  sublabel="Device-level permissions" onPress={() => Linking.openSettings()} />
          <NavRow icon="download" iconBg="#0EA5E9" label="Export My Data"
            sublabel={`${holdings.length} holding${holdings.length !== 1 ? 's' : ''} ready`}
            onPress={() => { haptic(); Alert.alert('Export Data', `${holdings.length} investment${holdings.length !== 1 ? 's' : ''}.\n\nFull CSV/JSON export coming soon.`, [{ text: 'OK' }]); }} />
          <NavRow icon="trash-2"  iconBg={colors.red} label="Delete All Data" sublabel="Permanently remove all investments" onPress={handleDeleteAll} destructive last />
        </Sect>

        {/* ── SUPPORT ──────────────────────────────────────── */}
        <Sect label="SUPPORT">
          <NavRow icon="help-circle" iconBg="#0EA5E9" label="Help Center" onPress={() =>
            showModal('Help Center', 'INVSTRY tracks your gold, silver, EGX stocks, and real estate in one place.\n\n• Pull down to refresh prices\n• Tap + on the Investments tab to add a holding\n• Swipe left on a holding to delete it\n• Toggle Arabic in Settings → Language & Region\n\nFor support: support@invstry.app')} />
          <NavRow icon="mail"   iconBg="#10B981" label="Contact Support"    onPress={() => openURL('mailto:support@invstry.app?subject=INVSTRY Support')} />
          <NavRow icon="flag"   iconBg="#F59E0B" label="Report a Bug"       onPress={() => openURL(`mailto:bugs@invstry.app?subject=Bug Report — INVSTRY v${APP_VERSION}`)} />
          <NavRow icon="edit-2" iconBg="#8B5CF6" label="Request a Feature"  onPress={() => openURL('mailto:feedback@invstry.app?subject=Feature Request')} />
          <NavRow icon="star"   iconBg="#EF4444" label="Rate on App Store"  onPress={() =>
            showModal('Rate INVSTRY', 'Thank you for your support! App Store rating will be available once the app is published.')} last />
        </Sect>

        {/* ── LEGAL ────────────────────────────────────────── */}
        <Sect label="LEGAL">
          <NavRow icon="file-text"    iconBg="#374151" label="Terms of Service" onPress={() =>
            showModal('Terms of Service', 'Last updated: July 2025\n\nINVSTRY is provided for informational purposes only. Nothing in this app constitutes financial advice, investment advice, or a recommendation to buy or sell any asset.\n\nAll investment data is sourced from third-party providers and may not be 100% accurate or up to date. Past performance does not guarantee future results.\n\nYou agree to use this app at your own risk. We are not liable for any financial decisions made based on information displayed in this app.\n\nAll holdings data is stored locally on your device and is never transmitted to our servers.')} />
          <NavRow icon="lock"         iconBg="#4B5563" label="Privacy Policy"   onPress={() =>
            showModal('Privacy Policy', 'Last updated: July 2025\n\nINVSTRY does not collect or store any personal data on external servers. All portfolio data is stored locally on your device using AsyncStorage.\n\nThird-Party Services\nWe fetch live market prices from:\n• api.gold-api.com\n• Yahoo Finance\n• open.er-api.com\n\nAnalytics (optional): Anonymized usage data only. No personally identifiable information is collected.\n\nContact: privacy@invstry.app')} />
          <NavRow icon="alert-circle" iconBg="#7C3AED" label="Regulatory Disclaimer" onPress={() =>
            showModal('Regulatory Disclaimer', 'INVSTRY is not a registered investment advisor, broker-dealer, or financial institution.\n\nThis application does not provide personalized investment advice. Market data displayed is for informational purposes only and should not be used as the sole basis for any investment decision.\n\nAlways verify prices with a certified financial professional before making investment decisions.')} />
          <NavRow icon="code"         iconBg="#6B7280" label="Open Source Licenses" onPress={() =>
            showModal('Open Source', 'Built with open source software:\n\n• Expo SDK 54 (MIT)\n• React Native 0.81 (MIT)\n• @tanstack/react-query (MIT)\n• AsyncStorage (MIT)\n• expo-haptics (MIT)\n• Inter font (OFL)\n• @expo/vector-icons (MIT)\n• Clerk SDK (Commercial)\n• react-native-svg (MIT)')} last />
        </Sect>

        {/* ── SIGN OUT ─────────────────────────────────────── */}
        <TouchableOpacity
          style={[sc.signOut, { backgroundColor: colors.red + '12', borderColor: colors.red + '30' }]}
          onPress={handleSignOut} activeOpacity={0.7}
        >
          <Feather name="log-out" size={17} color={colors.red} />
          <Text style={[sc.signOutTxt, { color: colors.red }]}>Sign Out</Text>
        </TouchableOpacity>

        {/* ── SMART FOOTER ─────────────────────────────────── */}
        <SmartFooter lastUpdate={lastUpdate} />
      </ScrollView>

      {modal && (
        <DetailModal visible title={modal.title} content={modal.content} onClose={() => setModal(null)} />
      )}
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 26 },

  pageHeader: { marginBottom: 2 },
  pageTitle: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: -1.2 },

  themeLabel: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  themeLabelIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  segRow: { flexDirection: 'row', gap: 5 },
  segChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  segLabel: { fontSize: 13 },

  signOut: { borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17, gap: 10 },
  signOutTxt: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
