import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useAppSettings, ThemeMode } from '@/context/AppSettingsContext';
import { Language } from '@/i18n';

const APP_VERSION = '1.0.0';

function SectionLabel({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function SettingsRow({ icon, label, value, last }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={15} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      {value ? <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { themeMode, language, setThemeMode, setLanguage } = useAppSettings();

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleTheme = async (mode: ThemeMode) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setThemeMode(mode);
  };

  const handleLanguage = async (lang: Language) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setLanguage(lang);
  };

  const THEMES: { key: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'light', label: t.light, icon: 'sun' },
    { key: 'dark', label: t.dark, icon: 'moon' },
    { key: 'system', label: t.system, icon: 'smartphone' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topInsets + 16, paddingBottom: botInsets + 90 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.text }]}>{t.settings}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44' }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>INVST</Text>
        </View>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <SectionLabel label={t.appearance} />
        <SettingsCard>
          <View style={[styles.segmentedRow]}>
            {THEMES.map((item, i) => {
              const active = themeMode === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.segment,
                    active && { backgroundColor: colors.primary },
                    i === 0 && styles.segmentFirst,
                    i === THEMES.length - 1 && styles.segmentLast,
                  ]}
                  onPress={() => handleTheme(item.key)}
                  activeOpacity={0.8}
                >
                  <Feather
                    name={item.icon}
                    size={14}
                    color={active ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text style={[
                    styles.segmentText,
                    { color: active ? colors.primaryForeground : colors.mutedForeground },
                    active && styles.segmentTextActive,
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingsCard>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <SectionLabel label={t.language} />
        <View style={styles.langRow}>
          {([['en', t.english, 'EN'], ['ar', t.arabic, 'عر']] as [Language, string, string][]).map(([lang, label, abbr]) => {
            const active = language === lang;
            return (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.langCard,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    flex: 1,
                  },
                ]}
                onPress={() => handleLanguage(lang)}
                activeOpacity={0.8}
              >
                <Text style={[styles.langAbbr, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                  {abbr}
                </Text>
                <Text style={[styles.langLabel, { color: active ? colors.primaryForeground : colors.text }]}>
                  {label}
                </Text>
                {active && (
                  <View style={styles.langCheck}>
                    <Feather name="check" size={14} color={colors.primaryForeground} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Market Data */}
      <View style={styles.section}>
        <SectionLabel label={t.marketData} />
        <SettingsCard>
          <SettingsRow icon="zap" label={t.autoRefresh} value="5 min" />
          <SettingsRow icon="database" label="Source" value="Yahoo Finance" last />
        </SettingsCard>
      </View>

      {/* About */}
      <View style={styles.section}>
        <SectionLabel label={t.about} />
        <SettingsCard>
          <SettingsRow icon="info" label={t.version} value={APP_VERSION} />
          <SettingsRow icon="map-pin" label={t.madeInEgypt} last />
        </SettingsCard>
      </View>

      {/* Gold bar decoration */}
      <View style={[styles.goldBar, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '33' }]}>
        <Text style={[styles.goldBarText, { color: colors.primary }]}>INVST</Text>
        <Text style={[styles.goldBarSub, { color: colors.mutedForeground }]}>
          {language === 'ar' ? 'مصر · بيانات حية' : 'Egypt · Live Data'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  screenTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  section: { gap: 8 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  segmentedRow: { flexDirection: 'row', padding: 6, gap: 4 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentFirst: { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  segmentLast: { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  segmentText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  segmentTextActive: { fontFamily: 'Inter_600SemiBold' },
  langRow: { flexDirection: 'row', gap: 10 },
  langCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  langAbbr: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  langLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  langCheck: { position: 'absolute', top: 10, right: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  rowValue: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  goldBar: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  goldBarText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  goldBarSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
