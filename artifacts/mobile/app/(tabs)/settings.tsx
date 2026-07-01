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

function Card({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function InfoRow({ icon, iconBg, label, value, last }: {
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  label: string;
  value?: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[
      styles.infoRow,
      !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <View style={[styles.rowIconWrap, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={14} color={colors.text} />
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
      contentContainerStyle={[styles.content, { paddingTop: topInsets + 20, paddingBottom: botInsets + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>{t.settings}</Text>
        <View style={[styles.versionPill, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.versionPillText, { color: colors.mutedForeground }]}>v{APP_VERSION}</Text>
        </View>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <SectionLabel label={t.appearance} />
        <Card>
          <View style={styles.themeRow}>
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
                  <Feather
                    name={item.icon}
                    size={15}
                    color={active ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text style={[
                    styles.themeChipLabel,
                    { color: active ? colors.primaryForeground : colors.mutedForeground },
                    active && styles.themeChipLabelActive,
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <SectionLabel label={t.language} />
        <View style={styles.langRow}>
          {(['en', 'ar'] as Language[]).map((lang) => {
            const active = language === lang;
            const isAr = lang === 'ar';
            return (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.langCard,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleLanguage(lang)}
                activeOpacity={0.8}
              >
                {active && (
                  <View style={styles.langCheckWrap}>
                    <Feather name="check-circle" size={16} color={colors.primaryForeground} />
                  </View>
                )}
                <Text style={[styles.langEmoji]}>{isAr ? '🇪🇬' : '🇺🇸'}</Text>
                <Text style={[styles.langCode, { color: active ? colors.primaryForeground : colors.text }]}>
                  {isAr ? 'عربي' : 'EN'}
                </Text>
                <Text style={[styles.langName, { color: active ? colors.primaryForeground + 'CC' : colors.mutedForeground }]}>
                  {isAr ? t.arabic : t.english}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Market Data */}
      <View style={styles.section}>
        <SectionLabel label={t.marketData} />
        <Card>
          <InfoRow icon="zap" iconBg="#FFD70020" label={t.autoRefresh} value="2 min" />
          <InfoRow icon="globe" iconBg="#4A9EFF20" label="Primary Source" value="gold-api.com" />
          <InfoRow icon="layers" iconBg="#A47FCA20" label="Fallback" value="goldprice.org" last />
        </Card>
      </View>

      {/* About */}
      <View style={styles.section}>
        <SectionLabel label={t.about} />
        <Card>
          <InfoRow icon="info" iconBg="#00D4AA20" label={t.version} value={APP_VERSION} />
          <InfoRow icon="map-pin" iconBg="#FF444420" label={t.madeInEgypt} last />
        </Card>
      </View>

      {/* Footer brand */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerBrand, { color: colors.primary }]}>INVSTRY</Text>
        <Text style={[styles.footerTagline, { color: colors.mutedForeground }]}>
          {t.footerTagline}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 22 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  screenTitle: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  versionPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  versionPillText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  section: { gap: 10 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  themeRow: { flexDirection: 'row', gap: 6, padding: 8 },
  themeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1,
  },
  themeChipLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  themeChipLabelActive: { fontFamily: 'Inter_700Bold' },
  langRow: { flexDirection: 'row', gap: 10 },
  langCard: {
    flex: 1, borderRadius: 18, borderWidth: 1,
    padding: 20, alignItems: 'center', gap: 5, position: 'relative',
  },
  langCheckWrap: { position: 'absolute', top: 12, right: 12 },
  langEmoji: { fontSize: 28, marginBottom: 4 },
  langCode: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  langName: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 13,
  },
  rowIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  rowValue: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  footer: { alignItems: 'center', paddingTop: 24, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
  footerBrand: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  footerTagline: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
