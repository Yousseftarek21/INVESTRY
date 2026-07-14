import React, { useMemo, useState, useCallback } from 'react';
import {
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import {
  RE_PRICES, RE_GOVERNORATES, LAST_UPDATED, REAreaPrice, RETrend,
} from '@/data/egypt-real-estate-prices';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEGP(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function trendColor(trend: RETrend): string {
  if (trend === 'up')   return '#22C55E';
  if (trend === 'down') return '#EF4444';
  return '#94A3B8';
}

function trendArrow(trend: RETrend): string {
  if (trend === 'up')   return '▲';
  if (trend === 'down') return '▼';
  return '–';
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function AreaRow({ area, isLast }: { area: REAreaPrice; isLast: boolean }) {
  const colors = useColors();
  const tc = trendColor(area.trend);

  return (
    <View style={[styles.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      {/* Left: name + governorate + range */}
      <View style={styles.rowLeft}>
        <Text style={[styles.areaName, { color: colors.text }]} numberOfLines={1}>
          {area.area}
        </Text>
        <Text style={[styles.govName, { color: colors.textSecondary }]} numberOfLines={1}>
          {area.governorate}
          {area.note ? '  ·  ' + area.note : ''}
        </Text>
        <Text style={[styles.range, { color: colors.textSecondary }]}>
          {fmtEGP(area.minPricePerM2)} – {fmtEGP(area.maxPricePerM2)} EGP/m²
        </Text>
      </View>

      {/* Right: avg price + trend */}
      <View style={styles.rowRight}>
        <Text style={[styles.avgPrice, { color: colors.text }]}>
          {fmtEGP(area.avgPricePerM2)}
        </Text>
        <Text style={[styles.avgUnit, { color: colors.textSecondary }]}>EGP/m²</Text>
        <View style={styles.trendRow}>
          <Text style={[styles.trendArrow, { color: tc }]}>{trendArrow(area.trend)} </Text>
          <Text style={[styles.trendPct, { color: tc }]}>
            {area.changePercent > 0 ? '+' : ''}{area.changePercent}%
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Governorate pills ────────────────────────────────────────────────────────

function GovPills({ active, onChange }: { active: string; onChange: (g: string) => void }) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pillsContent}
    >
      {RE_GOVERNORATES.map(gov => {
        const sel = gov === active;
        return (
          <TouchableOpacity
            key={gov}
            onPress={() => onChange(gov)}
            activeOpacity={0.7}
            style={[
              styles.pill,
              sel
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.pillTxt, { color: sel ? colors.primaryForeground : colors.textSecondary }]}>
              {gov}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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
      const govOk = activeGov === 'All' || a.governorate === activeGov;
      const qOk = !q || a.area.toLowerCase().includes(q) || a.governorate.toLowerCase().includes(q);
      return govOk && qOk;
    });
  }, [query, activeGov]);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={14} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
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
            <Feather name="x" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Governorate filter */}
      <GovPills active={activeGov} onChange={handleGov} />

      {/* Count */}
      <Text style={[styles.countTxt, { color: colors.textSecondary }]}>
        {results.length} {results.length === 1 ? 'area' : 'areas'} · avg price/m²
      </Text>

      {/* Area list */}
      {results.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="map-pin" size={28} color={colors.textSecondary} />
          <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>{t.reMarketNoResults}</Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {results.map((area, idx) => (
            <AreaRow key={area.id} area={area} isLast={idx === results.length - 1} />
          ))}
        </View>
      )}

      {/* Disclaimer */}
      <View style={[styles.disclaimerBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="info" size={11} color={colors.textSecondary} />
        <Text style={[styles.disclaimerTxt, { color: colors.textSecondary }]}>
          {t.reMarketDisclaimer}{'\n'}{t.reMarketLastUpdated}: {LAST_UPDATED}
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 6,
    paddingVertical: 0,
  },

  pillsContent: {
    flexDirection: 'row',
    paddingBottom: 10,
    paddingHorizontal: 1,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 7,
  },
  pillTxt: {
    fontSize: 12,
    fontWeight: '600',
  },

  countTxt: {
    fontSize: 11,
    marginBottom: 8,
  },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLeft: {
    flex: 1,
    paddingRight: 10,
  },
  areaName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  govName: {
    fontSize: 11,
    marginBottom: 2,
  },
  range: {
    fontSize: 11,
  },
  rowRight: {
    alignItems: 'flex-end',
    minWidth: 76,
  },
  avgPrice: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  avgUnit: {
    fontSize: 10,
    marginBottom: 3,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendArrow: {
    fontSize: 10,
    fontWeight: '700',
  },
  trendPct: {
    fontSize: 12,
    fontWeight: '700',
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTxt: {
    fontSize: 14,
    marginTop: 8,
  },

  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  disclaimerTxt: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    marginLeft: 6,
  },
});
