import React, { useMemo, useState } from 'react';
import {
  FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { backChevron, forwardChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { EGX_COMPANIES, EGXCompany } from '@/data/egx-companies';
import { getShariaCompliance, ShariaCompliance } from '@/data/egx-shariah-compliance';
import type { Translations } from '@/i18n';

const REASON_KEY_MAP: Record<ShariaCompliance['reasonKey'], keyof Translations> = {
  islamicBank:       'shariahReasonIslamicBank',
  egx33:             'shariahReasonEgx33',
  unreliableTag:     'shariahReasonUnreliableTag',
  bank:              'shariahReasonBank',
  insurance:         'shariahReasonInsurance',
  tobacco:           'shariahReasonTobacco',
  financial:         'shariahReasonFinancial',
  genericUnscreened: 'shariahReasonGenericUnscreened',
};

const GUIDANCE_KEY_MAP: Record<ShariaCompliance['guidanceKey'], keyof Translations> = {
  purification: 'shariahGuidancePurification',
  avoid:        'shariahGuidanceAvoid',
  unscreened:   'shariahGuidanceUnscreened',
};

function VerdictBadge({ verdict }: { verdict: ShariaCompliance['verdict'] }) {
  const colors = useColors();
  const t = useT();
  const cfg = {
    compliant:     { color: colors.green,           icon: 'check-circle' as const, label: t.shariahCompliant },
    non_compliant: { color: colors.red,              icon: 'x-circle'     as const, label: t.shariahNonCompliant },
    unscreened:    { color: colors.mutedForeground,  icon: 'help-circle'  as const, label: t.shariahUnscreened },
  }[verdict];
  return (
    <View style={[vb.wrap, { backgroundColor: cfg.color + '14', borderColor: cfg.color + '30' }]}>
      <Feather name={cfg.icon} size={28} color={cfg.color} />
      <Text style={[vb.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}
const vb = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingVertical: 24, borderRadius: 18, borderWidth: 1 },
  label: { fontSize: 18, fontFamily: 'Inter_700Bold' },
});

function InfoBlock({ icon, title, body }: { icon: keyof typeof Feather.glyphMap; title: string; body: string }) {
  const colors = useColors();
  return (
    <View style={ib.block}>
      <View style={ib.titleRow}>
        <Feather name={icon} size={13} color={colors.mutedForeground} />
        <Text style={[ib.title, { color: colors.mutedForeground }]}>{title}</Text>
      </View>
      <Text style={[ib.body, { color: colors.text }]}>{body}</Text>
    </View>
  );
}
const ib = StyleSheet.create({
  block: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4, textTransform: 'uppercase' },
  body: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21 },
});

export default function ShariaScreeningScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact } = useHaptic();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<EGXCompany | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return EGX_COMPANIES;
    return EGX_COMPANIES.filter(
      c => c.ticker.includes(q) || c.nameEn.toUpperCase().includes(q)
    );
  }, [query]);

  const compliance = selected ? getShariaCompliance(selected.ticker) : null;

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const goBack = () => {
    if (selected) { impact(); setSelected(null); return; }
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={goBack} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.shariahScreening}</Text>
          <View style={{ width: 22 }} />
        </View>

        {selected && compliance ? (
          <FlatList
            data={[1]}
            keyExtractor={() => 'verdict'}
            contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]}
            renderItem={() => (
              <View style={{ gap: 18 }}>
                {/* Stock identity */}
                <View style={s.stockRow}>
                  <View style={[s.avatar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[s.avatarText, { color: colors.mutedForeground }]}>{selected.ticker.substring(0, 4)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.stockName, { color: colors.text }]} numberOfLines={2}>{selected.nameEn}</Text>
                    <Text style={[s.stockNameAr, { color: colors.mutedForeground }]} numberOfLines={1}>{selected.nameAr}</Text>
                    <Text style={[s.stockMeta, { color: colors.mutedForeground }]}>{selected.ticker} · {selected.sector}</Text>
                  </View>
                </View>

                <VerdictBadge verdict={compliance.verdict} />

                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <InfoBlock icon="info" title={t.shariahReasonLabel} body={t[REASON_KEY_MAP[compliance.reasonKey]] as string} />
                  <View style={[s.divider, { backgroundColor: colors.border }]} />
                  <InfoBlock icon="compass" title={t.shariahGuidanceLabel} body={t[GUIDANCE_KEY_MAP[compliance.guidanceKey]] as string} />
                  {compliance.hasSource && (
                    <>
                      <View style={[s.divider, { backgroundColor: colors.border }]} />
                      <InfoBlock icon="link" title={t.shariahSourceLabel} body={t.shariahSourceEgx33} />
                    </>
                  )}
                </View>

                <TouchableOpacity
                  style={[s.changeBtn, { backgroundColor: colors.muted }]}
                  onPress={() => { impact(); setSelected(null); }}
                  activeOpacity={0.7}
                >
                  <Feather name="search" size={14} color={colors.text} />
                  <Text style={[s.changeBtnText, { color: colors.text }]}>{t.shariahChangeStock}</Text>
                </TouchableOpacity>

                <Text style={[s.disclaimer, { color: colors.mutedForeground }]}>{t.shariahDisclaimer}</Text>
              </View>
            )}
          />
        ) : (
          <>
            {/* Search */}
            <View style={[s.searchWrap, { borderBottomColor: colors.border }]}>
              <View style={[s.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="search" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[s.searchInput, { color: colors.text }]}
                  placeholder={t.searchSymbolPlaceholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="characters"
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')}>
                    <Feather name="x-circle" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[s.countLabel, { color: colors.mutedForeground }]}>
                {filtered.length} {t.stocksListedCount}
              </Text>
            </View>

            <FlatList
              data={filtered}
              keyExtractor={c => c.ticker}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: botPad + 20 }}
              renderItem={({ item, index }) => {
                const isLast = index === filtered.length - 1;
                return (
                  <TouchableOpacity
                    style={[s.row, { borderBottomColor: colors.border }, !isLast && s.rowBorder]}
                    onPress={() => { impact(); setSelected(item); }}
                    activeOpacity={0.65}
                  >
                    <View style={[s.avatar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Text style={[s.avatarText, { color: colors.mutedForeground }]}>{item.ticker.substring(0, 4)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowTicker, { color: colors.text }]}>{item.ticker}</Text>
                      <Text style={[s.rowName, { color: colors.mutedForeground }]} numberOfLines={1}>{item.nameEn}</Text>
                      <Text style={[s.rowNameAr, { color: colors.mutedForeground }]} numberOfLines={1}>{item.nameAr}</Text>
                    </View>
                    <Feather name={forwardChevron()} size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                );
              }}
            />
          </>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content:     { padding: 16 },

  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  countLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  rowTicker: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowName:   { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  rowNameAr: { fontSize: 11, fontFamily: 'Inter_400Regular' },

  avatar:     { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 11, fontFamily: 'Inter_700Bold' },

  stockRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stockName:   { fontSize: 16, fontFamily: 'Inter_600SemiBold', lineHeight: 21 },
  stockNameAr: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 1 },
  stockMeta:   { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },

  card:    { borderRadius: 18, borderWidth: 1, padding: 18, gap: 14 },
  divider: { height: StyleSheet.hairlineWidth },

  changeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 13 },
  changeBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  disclaimer: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16, opacity: 0.7, marginTop: 4 },
});
