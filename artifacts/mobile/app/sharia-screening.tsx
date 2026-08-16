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
import { buildShariaCompliance, debtScreen, ShariaCompliance } from '@/data/egx-shariah-compliance';
import { useShariahScreening } from '@/hooks/useShariahScreening';
import { useEGXMarket, EGXStockLive } from '@/hooks/useEGXMarket';
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

// One row of the AAOIFI criteria breakdown. 'unknown' is a first-class state,
// not an error: two of the four screens have no data source for EGX, and a
// grey dash says that far more honestly than omitting the row.
function CriterionRow({ label, state, value }: {
  label: string;
  state: 'pass' | 'fail' | 'unknown';
  value?: string;
}) {
  const colors = useColors();
  const cfg = {
    pass:    { icon: 'check-circle' as const, color: colors.green },
    fail:    { icon: 'x-circle' as const,     color: colors.red },
    unknown: { icon: 'minus-circle' as const, color: colors.mutedForeground },
  }[state];
  return (
    <View style={cr.row}>
      <Feather name={cfg.icon} size={14} color={cfg.color} />
      <Text style={[cr.label, { color: colors.text }]} numberOfLines={1}>{label}</Text>
      {!!value && (
        <Text style={[cr.value, { color: state === 'unknown' ? colors.mutedForeground : cfg.color }]} numberOfLines={1}>
          {value}
        </Text>
      )}
    </View>
  );
}

const cr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium', flexShrink: 1 },
  // marginStart auto pushes only the value to the right edge, leaving the
  // icon and label packed together on the left.
  value: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginStart: 'auto', fontVariant: ['tabular-nums'] },
});

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

  // Reference list comes from the server so a semi-annual EGX33 rebalance
  // doesn't need an app release; falls back to the bundled copy offline.
  const { reference } = useShariahScreening();
  const { data: egxStocks } = useEGXMarket();

  const complianceByTicker = useMemo(
    () => buildShariaCompliance(reference.egx33Shariah, reference.sectorTagUnreliable),
    [reference.egx33Shariah, reference.sectorTagUnreliable],
  );
  const compliance = selected ? complianceByTicker[selected.ticker] ?? null : null;

  // AAOIFI screen 2, computed live rather than asserted.
  const debt = useMemo(() => {
    if (!selected) return null;
    const s = egxStocks?.find((x: EGXStockLive) => x.ticker === selected.ticker);
    return debtScreen(s?.totalDebt, s?.marketCap, reference.debtToMarketCapMax);
  }, [selected, egxStocks, reference.debtToMarketCapMax]);

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

                {/* Per-criterion breakdown. AAOIFI defines four screens and
                    this app can only apply two — activity, and debt against
                    market cap. Listing all four with the unavailable ones
                    marked is the honest presentation: a stock passing what we
                    can measure is not thereby compliant, and hiding the two
                    we can't check would imply it was. */}
                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.criteriaTitle, { color: colors.mutedForeground }]}>{t.shariahCriteriaTitle}</Text>

                  <CriterionRow
                    label={t.shariahCriterionActivity}
                    state={compliance.verdict === 'non_compliant' ? 'fail' : compliance.verdict === 'compliant' ? 'pass' : 'unknown'}
                    value={compliance.verdict === 'unscreened' ? t.shariahCriterionNoData : undefined}
                  />
                  {/* Deliberately NOT a pass/fail. Checked against real
                      constituents: TMGH 38%, ORWE 48%, PHDC 77% of market cap
                      — all three certified by EGX's own Shariah board. Against
                      total assets instead, JUFO and EFID fail while those
                      three pass. Neither denominator reproduces the official
                      verdicts, because EGX screens on a trailing average
                      market cap and a narrower interest-bearing debt figure
                      than TradingView's total_debt. Stamping a red cross on a
                      certified stock would be worse than showing nothing, so
                      the ratio is reported as context and the verdict is left
                      to the official list. */}
                  <CriterionRow label={t.shariahCriterionLiquidity} state="unknown" value={t.shariahCriterionNoSource} />
                  <CriterionRow label={t.shariahCriterionIncome} state="unknown" value={t.shariahCriterionNoSource} />

                  <Text style={[s.criteriaNote, { color: colors.mutedForeground }]}>{t.shariahPartialNote}</Text>
                </View>

                {/* Real figures, shown as reference rather than as a verdict —
                    see the comment above on why they can't be scored. */}
                {!!debt && (
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.criteriaTitle, { color: colors.mutedForeground }]}>{t.shariahFinancialsTitle}</Text>
                    <View style={cr.row}>
                      <Feather name="bar-chart-2" size={14} color={colors.mutedForeground} />
                      <Text style={[cr.label, { color: colors.text }]}>{t.shariahCriterionDebt}</Text>
                      <Text style={[cr.value, { color: colors.text }]}>{(debt.ratio * 100).toFixed(1)}%</Text>
                    </View>
                    <Text style={[s.criteriaNote, { color: colors.mutedForeground }]}>{t.shariahDebtContextNote}</Text>
                  </View>
                )}

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

  criteriaTitle: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  criteriaNote:  { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16, marginTop: 8 },
  disclaimer: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16, opacity: 0.7, marginTop: 4 },
});
