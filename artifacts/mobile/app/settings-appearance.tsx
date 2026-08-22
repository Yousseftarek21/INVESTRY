import React, { useRef, useState } from 'react';
import {
  Alert, Animated, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backChevron } from '@/utils/rtl';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useAppSettings, ThemeMode, DisplayCurrency, ALL_DISPLAY_CURRENCIES } from '@/context/AppSettingsContext';
import { Language } from '@/i18n';
import { DetailModal } from '@/components/DetailModal';
import { Sect, NavRow, ToggleRow, Div, settingsScreenStyles as s } from '@/components/SettingsPrimitives';

// ─── Theme mini preview ─────────────────────────────────────────────────────

function ThemeMiniPreview({ mode }: { mode: ThemeMode }) {
  const bg   = mode === 'light' ? '#FFFFFF' : '#000000';
  const card = mode === 'light' ? '#FDFBF7' : '#161616';
  const a    = '#C9A227';
  const r1   = mode === 'light' ? '#EBE5D8' : '#242426';
  const r2   = mode === 'light' ? '#E0D8CA' : '#2C2C2E';
  return (
    <View style={[tm.preview, { backgroundColor: bg }]}>
      <View style={[tm.topBar, { backgroundColor: a }]} />
      <View style={[tm.fakeCard, { backgroundColor: card }]}>
        <View style={[tm.line, { backgroundColor: a + '50', width: '55%' }]} />
        <View style={[tm.lineNarrow, { backgroundColor: r1 }]} />
        <View style={[tm.lineNarrow, { backgroundColor: r2, width: '60%' }]} />
      </View>
      <View style={tm.tabRow}>
        {[0, 1, 2, 3].map(i => (
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
  const t = useT();
  const scales = useRef(THEME_OPTS.map(() => new Animated.Value(1))).current;

  const themeLabels: Record<ThemeMode, string> = {
    light: t.themeLight,
    dark: t.themeDark,
    system: t.themeAuto,
  };

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
                }]}>{themeLabels[item.key]}</Text>
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
  check: { position: 'absolute', top: 8, end: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

// ─── Currency picker modal ──────────────────────────────────────────────────

function CurrencyPickerModal({ visible, value, onSelect, onClose, shown, onToggleShown }: {
  visible: boolean; value: DisplayCurrency; onSelect: (c: DisplayCurrency) => void; onClose: () => void;
  shown: DisplayCurrency[]; onToggleShown: (list: DisplayCurrency[]) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  if (!visible) return null;

  // The switcher must always offer something, so the last remaining currency
  // can't be turned off — its chip just stops responding rather than
  // disappearing, which would be more confusing than an inert control.
  const toggle = (c: DisplayCurrency) => {
    const on = shown.includes(c);
    if (on && shown.length === 1) return;
    onToggleShown(on ? shown.filter(x => x !== c) : [...shown, c]);
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={mo.backdrop} onPress={onClose} />
      <View style={[mo.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
        <View style={[mo.handle, { backgroundColor: colors.border }]} />
        <View style={[mo.header, { borderBottomColor: colors.border }]}>
          <Text style={[mo.title, { color: colors.text }]}>{t.currencyRowLabel}</Text>
          <TouchableOpacity onPress={onClose} style={[mo.close, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 12, paddingBottom: 4 }}>
          {/* Active currency — only the ones the switcher currently offers, so
              this list and the portfolio card can never disagree. */}
          {shown.map(c => {
            const active = c === value;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => { onSelect(c); onClose(); }}
                style={[cp.row, active && { backgroundColor: colors.primary + '12' }]}
                activeOpacity={0.7}
              >
                <Text style={[cp.label, { color: active ? colors.primary : colors.text }]}>{c}</Text>
                {active && <Feather name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}

          <View style={[cp.divider, { backgroundColor: colors.border }]} />

          <Text style={[cp.sectionLabel, { color: colors.text }]}>{t.currencySwitcherLabel}</Text>
          <Text style={[cp.sectionHint, { color: colors.mutedForeground }]}>{t.currencySwitcherHint}</Text>

          <View style={cp.chipWrap}>
            {ALL_DISPLAY_CURRENCIES.map(c => {
              const on = shown.includes(c);
              const locked = on && shown.length === 1;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => toggle(c)}
                  disabled={locked}
                  activeOpacity={0.7}
                  style={[
                    cp.chip,
                    {
                      backgroundColor: on ? colors.primary : colors.muted + '50',
                      borderColor: on ? colors.primary : colors.border,
                      opacity: locked ? 0.55 : 1,
                    },
                  ]}
                >
                  {on && <Feather name="check" size={12} color={colors.primaryForeground} style={{ marginRight: 5 }} />}
                  <Text style={[cp.chipText, { color: on ? colors.primaryForeground : colors.mutedForeground }]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
const mo = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 10, marginBottom: 4 },
  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', flex: 1 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
const cp = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 15, borderRadius: 14 },
  label: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14, marginHorizontal: 2 },
  sectionLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', paddingHorizontal: 2 },
  sectionHint: { fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18, paddingHorizontal: 2, marginTop: 4, marginBottom: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, paddingVertical: 9 },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SettingsAppearanceScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact: haptic } = useHaptic();
  const {
    themeMode, setThemeMode, hapticsEnabled, setHapticsEnabled,
    language, setLanguage, displayCurrency, setDisplayCurrency,
    visibleCurrencies, setVisibleCurrencies,
  } = useAppSettings();

  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
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
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.settingsCatAppearance}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]} showsVerticalScrollIndicator={false}>
          <Sect label={t.settingsSectAppearance}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8B5CF620' }}>
                <Feather name="eye" size={14} color="#8B5CF6" />
              </View>
              <Text style={{ fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.text }}>{t.themeLabel}</Text>
            </View>
            <ThemePicker value={themeMode} onChange={async m => { haptic(); await setThemeMode(m); }} />
            <Div />
            <ToggleRow icon="zap" iconBg="#FBBF24" label={t.hapticFeedbackLabel} sublabel={t.hapticFeedbackDesc} value={hapticsEnabled} onChange={v => setHapticsEnabled(v)} last />
          </Sect>

          <Sect label={t.settingsSectLanguage}>
            <TouchableOpacity
              style={rw.row}
              onPress={() => { haptic(); setLangOpen(v => !v); }}
              activeOpacity={0.55}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0EA5E9' }}>
                <Feather name="globe" size={15} color="#fff" />
              </View>
              <View style={rw.body}>
                <Text style={[rw.label, { color: colors.text }]}>{t.languageLabel}</Text>
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
                        onPress={async () => { haptic(); await setLanguage(lang); setLangOpen(false); Alert.alert('', t.languageRestartNote); }}
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
            <NavRow icon="map-pin" iconBg="#EF4444" label={t.regionLabel} value="Egypt (EG)"
              onPress={() => showModal(t.regionLabel, 'INVESTRY is built specifically for the Egyptian market — gold and silver prices, EGX stocks, and real estate values are all sourced and priced for Egypt.\n\nSupport for other regions may be added in a future update.')} />
            <NavRow icon="hash" iconBg="#374151" label={t.dateFormatLabel} value="DD/MM/YYYY"
              onPress={() => showModal(t.dateFormatLabel, 'Dates are currently shown in DD/MM/YYYY format, matching Egyptian conventions.\n\nCustom date formats are not yet configurable — this is coming in a future update.')} />
            <NavRow icon="type" iconBg="#6B7280" label={t.numberFormatLabel} value="1,234.56"
              onPress={() => showModal(t.numberFormatLabel, 'Numbers are currently shown with a comma thousands separator and period decimal (e.g. 1,234.56).\n\nCustom number formats are not yet configurable — this is coming in a future update.')} />
            <NavRow icon="dollar-sign" iconBg="#059669" label={t.currencyRowLabel} value={displayCurrency}
              onPress={() => setCurrencyPickerOpen(true)} last />
          </Sect>
        </ScrollView>
      </View>
      {modal && (
        <DetailModal visible title={modal.title} content={modal.content} onClose={() => setModal(null)} />
      )}
      <CurrencyPickerModal
        visible={currencyPickerOpen}
        value={displayCurrency}
        onSelect={setDisplayCurrency}
        shown={visibleCurrencies}
        onToggleShown={setVisibleCurrencies}
        onClose={() => setCurrencyPickerOpen(false)}
      />
    </>
  );
}

const rw = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14, minHeight: 56 },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  trail: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  val: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
