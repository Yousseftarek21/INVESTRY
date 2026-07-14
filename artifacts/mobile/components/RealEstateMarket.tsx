import React, { useMemo, useState, useCallback } from 'react';
import {
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import {
  RE_PRICES, RE_GOVERNORATES, LAST_UPDATED,
  REAreaPrice, RETrend, REPropertyType,
} from '@/data/egypt-real-estate-prices';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEGP(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function trendColor(trend: RETrend, colors: ReturnType<typeof useColors>): string {
  if (trend === 'up')     return '#22C55E';
  if (trend === 'down')   return '#EF4444';
  return colors.textSecondary;
}

function trendIcon(trend: RETrend): React.ComponentProps<typeof Feather>['name'] {
  if (trend === 'up')   return 'trending-up';
  if (trend === 'down') return 'trending-down';
  return 'minus';
}

// ─── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: REPropertyType }) {
  const colors = useColors();
  const t = useT();
  const labelMap: Record<REPropertyType, string> = {
    residential: t.reMarketResidential,
    villa:       t.reMarketVilla,
    coastal:     t.reMarketCoastal,
    commercial:  t.reMarketCommercial,
    land:        t.reMarketLand,
  };
  const colorMap: Record<REPropertyType, string> = {
    residential: colors.primary,
    villa:       '#A47FCA',
    coastal:     '#38BDF8',
    commercial:  '#FB923C',
    land:        '#84CC16',
  };
  const c = colorMap[type];
  return (
    <View style={[s.typeBadge, { backgroundColor: c + '22', borderColor: c + '55' }]}>
      <Text style={[s.typeBadgeText, { color: c }]}>{labelMap[type]}</Text>
    </View>
  );
}

// ─── Area card ─────────────────────────────────────────────────────────────────

function AreaCard({ area, isLast }: { area: REAreaPrice; isLast: boolean }) {
  const colors = useColors();
  const t = useT();
  const tc = trendColor(area.trend, colors);
  const ti = trendIcon(area.trend);

  const trendLabel =
    area.trend === 'up'     ? t.reMarketTrendUp :
    area.trend === 'down'   ? t.reMarketTrendDown :
                              t.reMarketTrendStable;

  return (
    <View
      style={[
        s.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        !isLast && s.cardDivider,
      ]}
    >
      {/* Header row */}
      <View style={s.cardHeader}>
        <View style={s.cardLeft}>
          <Text style={[s.areaName, { color: colors.text }]} numberOfLines={1}>
            {area.area}
          </Text>
          <Text style={[s.govLabel, { color: colors.textSecondary }]}>
            {area.governorate}
          </Text>
        </View>
        <View style={s.cardRight}>
          <Text style={[s.avgPrice, { color: colors.text }]}>
            {fmtEGP(area.avgPricePerM2)}
          </Text>
          <Text style={[s.avgLabel, { color: colors.textSecondary }]}>
            {t.reMarketAvgPrice}
          </Text>
        </View>
      </View>

      {/* Meta row */}
      <View style={s.metaRow}>
        <TypeBadge type={area.type} />

        {/* Range */}
        <View style={s.rangeWrap}>
          <Feather name="bar-chart-2" size={11} color={colors.textSecondary} />
          <Text style={[s.rangeTxt, { color: colors.textSecondary }]}>
            {' '}{fmtEGP(area.minPricePerM2)} – {fmtEGP(area.maxPricePerM2)}
          </Text>
        </View>

        {/* Trend */}
        <View style={s.trendWrap}>
          <Feather name={ti} size={13} color={tc} />
          <Text style={[s.trendPct, { color: tc }]}>
            {' '}{area.changePercent > 0 ? '+' : ''}{area.changePercent}%{' '}
          </Text>
          <Text style={[s.trendLabel, { color: colors.textSecondary }]}>
            {t.reMarketYoY}
          </Text>
        </View>
      </View>

      {/* Note */}
      {area.note ? (
        <Text style={[s.note, { color: colors.textSecondary }]}>
          {area.note}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Governorate filter pills ──────────────────────────────────────────────────

function GovPills({
  active,
  onChange,
}: {
  active: string;
  onChange: (g: string) => void;
}) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.pillsRow}
    >
      {RE_GOVERNORATES.map(gov => {
        const isActive = gov === active;
        return (
          <TouchableOpacity
            key={gov}
            onPress={() => onChange(gov)}
            style={[
              s.pill,
              {
                backgroundColor: isActive ? colors.primary : colors.card,
                borderColor: isActive ? colors.primary : colors.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                s.pillTxt,
                { color: isActive ? '#fff' : colors.textSecondary },
              ]}
            >
              {gov}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function RealEstateMarket() {
  const colors = useColors();
  const t = useT();

  const [query, setQuery] = useState('');
  const [activeGov, setActiveGov] = useState('All');

  const handleGov = useCallback((gov: string) => {
    setActiveGov(gov);
    setQuery('');
  }, []);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return RE_PRICES.filter(a => {
      const govMatch = activeGov === 'All' || a.governorate === activeGov;
      const qMatch =
        !q ||
        a.area.toLowerCase().includes(q) ||
        a.governorate.toLowerCase().includes(q);
      return govMatch && qMatch;
    });
  }, [query, activeGov]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={[s.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.headerTop}>
          <Feather name="home" size={18} color={colors.primary} />
          <Text style={[s.headerTitle, { color: colors.text }]}>
            {t.realEstateMarketTitle}
          </Text>
        </View>
        <Text style={[s.headerSub, { color: colors.textSecondary }]}>
          سعر المتر المربع · Egypt price/m² guide
        </Text>
      </View>

      {/* Search */}
      <View style={[s.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={15} color={colors.textSecondary} style={s.searchIcon} />
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          placeholder={t.reMarketSearchPlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Governorate pills */}
      <GovPills active={activeGov} onChange={handleGov} />

      {/* Results */}
      {results.length === 0 ? (
        <View style={s.empty}>
          <Feather name="map-pin" size={32} color={colors.textSecondary} />
          <Text style={[s.emptyTxt, { color: colors.textSecondary }]}>
            {t.reMarketNoResults}
          </Text>
        </View>
      ) : (
        <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {results.map((area, idx) => (
            <AreaCard key={area.id} area={area} isLast={idx === results.length - 1} />
          ))}
        </View>
      )}

      {/* Disclaimer */}
      <View style={[s.disclaimer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="info" size={12} color={colors.textSecondary} style={{ marginTop: 1 }} />
        <Text style={[s.disclaimerTxt, { color: colors.textSecondary }]}>
          {t.reMarketDisclaimer}
          {'\n'}{t.reMarketLastUpdated}: {LAST_UPDATED}
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  headerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  pillsRow: {
    paddingHorizontal: 2,
    gap: 8,
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillTxt: {
    fontSize: 12,
    fontWeight: '600',
  },
  listCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  card: {
    padding: 14,
    gap: 8,
  },
  cardDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  areaName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  govLabel: {
    fontSize: 12,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  avgPrice: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  avgLabel: {
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rangeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeTxt: {
    fontSize: 12,
  },
  trendWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  trendPct: {
    fontSize: 12,
    fontWeight: '700',
  },
  trendLabel: {
    fontSize: 11,
  },
  note: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyTxt: {
    fontSize: 14,
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 7,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  disclaimerTxt: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
});
