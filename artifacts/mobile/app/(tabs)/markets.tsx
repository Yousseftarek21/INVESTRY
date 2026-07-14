import React, { useRef, useEffect, useState } from 'react';
import {
  Animated, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { EGXMarket } from '@/components/EGXMarket';
import { GlobalStocksMarket } from '@/components/GlobalStocksMarket';
import { RE_PRICES, LAST_UPDATED, REAreaPrice } from '@/data/egypt-real-estate-prices';

// ─── Tab config ────────────────────────────────────────────────────────────────

type TabIconSpec =
  | { lib: 'feather'; name: keyof typeof Feather.glyphMap }
  | { lib: 'mci'; name: string };

const TABS_CONFIG = [
  { key: 'metals',      icon: { lib: 'mci',    name: 'gold' }          as TabIconSpec },
  { key: 'currencies',  icon: { lib: 'feather', name: 'dollar-sign' }  as TabIconSpec },
  { key: 'egx',        icon: { lib: 'feather', name: 'bar-chart-2' }  as TabIconSpec },
  { key: 'real_estate',icon: { lib: 'mci',    name: 'home-city' }     as TabIconSpec },
  { key: 'us_stocks',  icon: { lib: 'feather', name: 'trending-up' }  as TabIconSpec },
  { key: 'indices',    icon: { lib: 'feather', name: 'globe' }        as TabIconSpec },
] as const;

type TabKey = typeof TABS_CONFIG[number]['key'];

function TabIcon({ spec, size, color }: { spec: TabIconSpec; size: number; color: string }) {
  if (spec.lib === 'mci') {
    return <MaterialCommunityIcons name={spec.name as any} size={size} color={color} />;
  }
  return <Feather name={spec.name} size={size} color={color} />;
}

// ─── Live dot ──────────────────────────────────────────────────────────────────

function LiveDot() {
  const colors = useColors();
  const t = useT();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 1,    duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);
  return (
    <View style={ldSt.row}>
      <Animated.View style={[ldSt.dot, { backgroundColor: colors.green, opacity }]} />
      <Text style={[ldSt.text, { color: colors.green }]}>{t.liveLabel}</Text>
    </View>
  );
}
const ldSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
});

// ─── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  const colors = useColors();
  const t = useT();

  const tabLabels: Record<TabKey, string> = {
    metals: t.tabMetals,
    currencies: t.tabCurrencies,
    egx: t.tabEGX,
    real_estate: t.tabRealEstate,
    us_stocks: t.tabUsStocks,
    indices: t.tabIndices,
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tb.row}
      style={tb.wrap}
    >
      {TABS_CONFIG.map(tab => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[
              tb.pill,
              {
                backgroundColor: isActive ? colors.primary : colors.muted,
                borderColor: isActive ? colors.primary : 'transparent',
              },
            ]}
          >
            <TabIcon
              spec={tab.icon}
              size={12}
              color={isActive ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text style={[tb.label, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
              {tabLabels[tab.key]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const tb = StyleSheet.create({
  wrap: { marginHorizontal: -20 },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});

// ─── Change badge ──────────────────────────────────────────────────────────────

function ChangeBadge({ changePct }: { changePct: number }) {
  const colors = useColors();
  const isPos = changePct >= 0;
  const color = isPos ? colors.green : colors.red;
  return (
    <View style={[cb.badge, { backgroundColor: color + '15' }]}>
      <Feather name={isPos ? 'arrow-up-right' : 'arrow-down-right'} size={11} color={color} />
      <Text style={[cb.txt, { color }]}>
        {isPos ? '+' : ''}{changePct.toFixed(2)}%
      </Text>
    </View>
  );
}
const cb = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  txt: { fontSize: 11, fontFamily: 'Inter_700Bold' },
});

// ─── Metal hero card ───────────────────────────────────────────────────────────

function MetalHeroCard({
  accentColor, label, price, unit = 'EGP/g',
  usdPrice, troyEgp, changePercent,
}: {
  accentColor: string;
  label: string;
  price: number;
  unit?: string;
  usdPrice?: number;
  troyEgp?: number;
  changePercent?: number;
}) {
  const colors = useColors();
  const priceStr = price.toLocaleString('en-EG', { maximumFractionDigits: price < 10 ? 2 : 0 });

  const refs: string[] = [];
  if (usdPrice && usdPrice > 0) refs.push(`$${usdPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`);
  if (troyEgp && troyEgp > 0) refs.push(`Troy ${troyEgp.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP`);

  return (
    <View style={[mh.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[mh.accent, { backgroundColor: accentColor }]} />
      <View style={mh.body}>
        {/* Top: icon + name | change */}
        <View style={mh.topRow}>
          <View style={mh.nameRow}>
            <View style={[mh.iconWrap, { backgroundColor: accentColor + '18' }]}>
              <MaterialCommunityIcons name="gold" size={16} color={accentColor} />
            </View>
            <Text style={[mh.label, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
          {changePercent !== undefined && <ChangeBadge changePct={changePercent} />}
        </View>
        {/* Price */}
        <View style={mh.priceRow}>
          <Text style={[mh.price, { color: colors.text }]}>{priceStr}</Text>
          <Text style={[mh.unit, { color: colors.mutedForeground }]}> {unit}</Text>
        </View>
        {/* Reference prices inline */}
        {refs.length > 0 && (
          <Text style={[mh.refs, { color: colors.mutedForeground }]}>{refs.join('  ·  ')}</Text>
        )}
      </View>
    </View>
  );
}
const mh = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  accent: { width: 3, alignSelf: 'stretch' },
  body: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  price: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.8 },
  unit: { fontSize: 11, fontFamily: 'Inter_400Regular', paddingBottom: 3 },
  refs: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});

// ─── Metal row ─────────────────────────────────────────────────────────────────

function MetalRow({
  metalType, accentColor, label, sublabel, price, unit = 'EGP/g',
  usdPrice, changePercent, isLast, bold,
}: {
  metalType: 'gold' | 'silver';
  accentColor: string; label: string; sublabel?: string;
  price: number; unit?: string; usdPrice?: number;
  changePercent?: number; isLast?: boolean; bold?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[
      mr.row,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <View style={mr.left}>
        <View style={[mr.iconWrap, { backgroundColor: accentColor + '18' }]}>
          <MaterialCommunityIcons name="gold" size={17} color={accentColor} />
        </View>
        <View style={mr.labels}>
          <Text style={[mr.label, { color: colors.text }, bold && mr.labelBold]}>{label}</Text>
          {sublabel ? <Text style={[mr.sub, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
        </View>
      </View>
      <View style={mr.right}>
        <Text style={[mr.price, { color: colors.text }, bold && mr.priceBold]}>
          {price.toLocaleString('en-EG', { maximumFractionDigits: price < 10 ? 2 : 0 })}
          <Text style={[mr.unit, { color: colors.mutedForeground }]}> {unit}</Text>
        </Text>
        {usdPrice !== undefined && usdPrice > 0 && (
          <Text style={[mr.usdLine, { color: colors.mutedForeground }]}>
            ${usdPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
          </Text>
        )}
        {changePercent !== undefined && <ChangeBadge changePct={changePercent} />}
      </View>
    </View>
  );
}
const mr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13, gap: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  labels: { gap: 2, flex: 1, minWidth: 0 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  labelBold: { fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  right: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  price: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  priceBold: { fontSize: 17 },
  unit: { fontSize: 10, fontFamily: 'Inter_400Regular', letterSpacing: 0 },
  usdLine: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});

// ─── Table card ────────────────────────────────────────────────────────────────

function TableCard({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[tc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}
const tc = StyleSheet.create({ card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' } });

// ─── Section label ─────────────────────────────────────────────────────────────

function SLabel({ icon, title }: { icon: TabIconSpec | keyof typeof Feather.glyphMap; title: string }) {
  const colors = useColors();
  const spec: TabIconSpec = typeof icon === 'string'
    ? { lib: 'feather', name: icon as keyof typeof Feather.glyphMap }
    : icon;
  return (
    <View style={sl.row}>
      <View style={[sl.iconWrap, { backgroundColor: colors.muted }]}>
        <TabIcon spec={spec} size={12} color={colors.mutedForeground} />
      </View>
      <Text style={[sl.title, { color: colors.mutedForeground }]}>{title}</Text>
    </View>
  );
}
const sl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.3 },
});

// ─── Currency hero card ────────────────────────────────────────────────────────

function CurrencyHeroCard({ rate }: { rate: number }) {
  const colors = useColors();
  const t = useT();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 1,   duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);

  return (
    <View style={[ch.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[ch.accent, { backgroundColor: '#4A9EFF' }]} />
      <View style={ch.body}>
        {/* Top: flag + name/pair | live badge */}
        <View style={ch.topRow}>
          <View style={ch.flagRow}>
            <Text style={ch.flag}>🇺🇸</Text>
            <View style={ch.nameGroup}>
              <Text style={[ch.name, { color: colors.text }]}>{t.currencyUSD}</Text>
              <Text style={[ch.pair, { color: colors.mutedForeground }]}>USD / EGP</Text>
            </View>
          </View>
          <View style={[ch.livePill, { backgroundColor: colors.green + '18' }]}>
            <Animated.View style={[ch.liveDot, { backgroundColor: colors.green, opacity }]} />
            <Text style={[ch.liveTxt, { color: colors.green }]}>{t.liveLabel}</Text>
          </View>
        </View>
        {/* Rate */}
        <View style={ch.rateRow}>
          <Text style={[ch.rate, { color: colors.text }]}>
            {rate.toLocaleString('en-EG', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
          </Text>
          <Text style={[ch.rateUnit, { color: colors.mutedForeground }]}> EGP</Text>
        </View>
        <Text style={[ch.sub, { color: colors.mutedForeground }]}>
          {t.currencyUnitEGP} US Dollar
        </Text>
      </View>
    </View>
  );
}
const ch = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  accent: { width: 3, alignSelf: 'stretch' },
  body: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flag: { fontSize: 22 },
  nameGroup: { gap: 1 },
  name: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  pair: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  liveTxt: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
  rateRow: { flexDirection: 'row', alignItems: 'flex-end' },
  rate: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  rateUnit: { fontSize: 12, fontFamily: 'Inter_400Regular', paddingBottom: 3 },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});

// ─── Currency row ──────────────────────────────────────────────────────────────

function CurrencyRow({
  flag, name, pair, rate, unit, isLast,
}: {
  flag: string; name: string; pair: string;
  rate: number; unit: string; isLast?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[
      cr.row,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <View style={[cr.flag, { backgroundColor: colors.muted }]}>
        <Text style={cr.flagTxt}>{flag}</Text>
      </View>
      <View style={cr.info}>
        <Text style={[cr.name, { color: colors.text }]}>{name}</Text>
        <Text style={[cr.pair, { color: colors.mutedForeground }]}>{pair}</Text>
      </View>
      <View style={cr.right}>
        <Text style={[cr.rate, { color: colors.text }]}>
          {rate.toLocaleString('en-EG', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
        </Text>
        <Text style={[cr.unit, { color: colors.mutedForeground }]}>{unit}</Text>
      </View>
    </View>
  );
}
const cr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  flag: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  flagTxt: { fontSize: 20 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  pair: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  right: { alignItems: 'flex-end', gap: 1 },
  rate: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  unit: { fontSize: 10, fontFamily: 'Inter_400Regular' },
});

// ─── EGX stock row ─────────────────────────────────────────────────────────────

function StockRow({ symbol, name, price, changePercent, index, total }: {
  symbol: string; name: string; price: number;
  change: number; changePercent: number; index: number; total: number;
}) {
  const colors = useColors();
  const isLast = index === total - 1;
  return (
    <View style={[
      sr.row,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <View style={[sr.avatar, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '28' }]}>
        <Text style={[sr.avatarTxt, { color: colors.primary }]}>
          {symbol.length <= 4 ? symbol : symbol.substring(0, 4)}
        </Text>
      </View>
      <View style={sr.info}>
        <Text style={[sr.symbol, { color: colors.text }]}>{symbol}</Text>
        <Text style={[sr.name, { color: colors.mutedForeground }]} numberOfLines={1}>{name}</Text>
      </View>
      <View style={sr.right}>
        <Text style={[sr.price, { color: colors.text }]}>{price > 0 ? price.toFixed(2) : '—'}</Text>
        {price > 0 && <ChangeBadge changePct={changePercent} />}
      </View>
    </View>
  );
}
const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
  info: { flex: 1, gap: 2, minWidth: 0 },
  symbol: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  right: { alignItems: 'flex-end', gap: 5, flexShrink: 0 },
  price: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});

// ─── Real estate ───────────────────────────────────────────────────────────────

// Precompute grouped sections once at module level — pure static data, zero cost.
const GOV_SECTIONS: { gov: string; areas: REAreaPrice[] }[] = (() => {
  const map = new Map<string, REAreaPrice[]>();
  RE_PRICES.forEach(a => {
    if (!map.has(a.governorate)) map.set(a.governorate, []);
    map.get(a.governorate)!.push(a);
  });
  return Array.from(map.entries()).map(([gov, areas]) => ({ gov, areas }));
})();

function fmtKEGP(n: number): string {
  return `${Math.round(n / 1_000)}K`;
}

function RERow({ area, isLast }: { area: REAreaPrice; isLast: boolean }) {
  const colors = useColors();
  const isUp   = area.trend === 'up';
  const isDown = area.trend === 'down';
  const tc = isUp ? colors.green : isDown ? colors.red : colors.mutedForeground;
  return (
    <View style={[
      rer.row,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <View style={[rer.icon, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '28' }]}>
        <Feather name="home" size={14} color={colors.primary} />
      </View>
      <View style={rer.info}>
        <Text style={[rer.name, { color: colors.text }]} numberOfLines={1}>{area.area}</Text>
        <Text style={[rer.range, { color: colors.mutedForeground }]} numberOfLines={1}>
          {fmtKEGP(area.minPricePerM2)}–{fmtKEGP(area.maxPricePerM2)} EGP/m²
        </Text>
      </View>
      <View style={rer.right}>
        <Text style={[rer.price, { color: colors.text }]}>
          {fmtKEGP(area.avgPricePerM2)}{' '}
          <Text style={[rer.unit, { color: colors.mutedForeground }]}>EGP/m²</Text>
        </Text>
        <View style={[rer.badge, { backgroundColor: tc + '18' }]}>
          <Text style={[rer.badgeTxt, { color: tc }]}>
            {isUp ? '↑' : isDown ? '↓' : '–'} {area.changePercent > 0 ? '+' : ''}{area.changePercent}%
          </Text>
        </View>
      </View>
    </View>
  );
}
const rer = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  range: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  right: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  price: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  unit: { fontSize: 10, fontFamily: 'Inter_400Regular', letterSpacing: 0 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeTxt: { fontSize: 10, fontFamily: 'Inter_700Bold' },
});

function RealEstateTab() {
  const colors = useColors();
  const t = useT();
  return (
    <View style={tab.group}>
      {/* Hero info card */}
      <View style={[reh.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[reh.accent, { backgroundColor: colors.primary }]} />
        <View style={reh.body}>
          <View style={reh.topRow}>
            <View style={reh.nameRow}>
              <View style={[reh.iconWrap, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="home" size={15} color={colors.primary} />
              </View>
              <Text style={[reh.label, { color: colors.mutedForeground }]} numberOfLines={1}>
                EGYPT PROPERTY MARKET
              </Text>
            </View>
            <View style={[reh.pill, { backgroundColor: colors.muted }]}>
              <Text style={[reh.pillTxt, { color: colors.mutedForeground }]}>Q2 2026</Text>
            </View>
          </View>
          <Text style={[reh.title, { color: colors.text }]}>{RE_PRICES.length} areas · avg price/m²</Text>
          <Text style={[reh.sub, { color: colors.mutedForeground }]}>EGP/m² · {t.reMarketDisclaimer.split('(')[0].trim()}</Text>
        </View>
      </View>

      {/* One section per governorate */}
      {GOV_SECTIONS.map(({ gov, areas }) => (
        <View key={gov} style={tab.section}>
          <SLabel icon={{ lib: 'feather', name: 'map-pin' }} title={gov.toUpperCase()} />
          <TableCard>
            {areas.map((area, idx) => (
              <RERow key={area.id} area={area} isLast={idx === areas.length - 1} />
            ))}
          </TableCard>
        </View>
      ))}

      <Text style={tab.note}>{t.reMarketDisclaimer}</Text>
    </View>
  );
}
const reh = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  accent: { width: 3, alignSelf: 'stretch' },
  body: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 5, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, flexShrink: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexShrink: 0 },
  pillTxt: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15 },
});

// ─── Coming soon ───────────────────────────────────────────────────────────────

function ComingSoon({ icon, title, description }: {
  icon: keyof typeof Feather.glyphMap; title: string; description: string;
}) {
  const colors = useColors();
  const t = useT();
  return (
    <View style={[cs.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[cs.iconWrap, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={30} color={colors.mutedForeground} />
      </View>
      <View style={cs.text}>
        <Text style={[cs.title, { color: colors.text }]}>{title}</Text>
        <Text style={[cs.desc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <View style={[cs.badge, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '30' }]}>
        <Text style={[cs.badgeTxt, { color: colors.primary }]}>{t.betaPreview}</Text>
      </View>
    </View>
  );
}
const cs = StyleSheet.create({
  card: {
    borderRadius: 24, borderWidth: 1, borderStyle: 'dashed',
    padding: 32, alignItems: 'center', gap: 16,
  },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { alignItems: 'center', gap: 6 },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  desc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  badge: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 5 },
  badgeTxt: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
});

// ─── Tab content ───────────────────────────────────────────────────────────────

function MetalsTab({ prices }: { prices: ReturnType<typeof useMarketPrices>['data'] }) {
  const colors = useColors();
  const t = useT();
  const gold24 = prices ? Math.round(goldPricePerGram(prices, '24k')) : 0;
  const gold22 = prices ? Math.round(goldPricePerGram(prices, '22k')) : 0;
  const gold21 = prices ? Math.round(goldPricePerGram(prices, '21k')) : 0;
  const gold18 = prices ? Math.round(goldPricePerGram(prices, '18k')) : 0;
  const goldOz = prices ? Math.round(prices.goldUsd * prices.usdToEgp) : 0;
  const silverPure = prices ? silverPricePerGram(prices) : 0;
  const silver999  = prices ? parseFloat((silverPure * 0.999).toFixed(2)) : 0;
  const silver925  = prices ? parseFloat((silverPure * 0.925).toFixed(2)) : 0;
  const silverOz   = prices ? Math.round(prices.silverUsd * prices.usdToEgp) : 0;

  return (
    <View style={tab.group}>
      {/* Gold section */}
      <View style={tab.section}>
        <SLabel icon={{ lib: 'mci', name: 'gold' }} title={t.goldSectionLabel} />
        <MetalHeroCard
          accentColor={colors.primary}
          label={t.gold24K}
          price={gold24}
          usdPrice={prices?.goldUsd}
          troyEgp={goldOz}
          changePercent={prices?.goldChangePercent}
        />
        <TableCard>
          <MetalRow metalType="gold" accentColor={colors.primary} label={t.gold22K}   sublabel={t.gold22KSub}    price={gold22} />
          <MetalRow metalType="gold" accentColor={colors.primary} label={t.gold21K}   sublabel={t.gold21KSub}    price={gold21} />
          <MetalRow metalType="gold" accentColor={colors.goldDark ?? '#A68700'} label={t.gold18K} sublabel={t.gold18KSub} price={gold18} />
          <MetalRow metalType="gold" accentColor={colors.primary} label={t.goldTroyOz} sublabel={t.goldTroyOzSub} price={goldOz} unit="EGP" usdPrice={prices?.goldUsd} isLast bold />
        </TableCard>
      </View>

      {/* Silver section */}
      <View style={tab.section}>
        <SLabel icon={{ lib: 'mci', name: 'gold' }} title={t.silverSectionLabel} />
        <MetalHeroCard
          accentColor={colors.silverColor}
          label={t.silver999Label}
          price={silver999}
          usdPrice={prices?.silverUsd}
          troyEgp={silverOz}
          changePercent={prices?.silverChangePercent}
        />
        <TableCard>
          <MetalRow metalType="silver" accentColor={colors.silverColor} label={t.silver925Label} sublabel={t.silver925Sub}    price={silver925} />
          <MetalRow metalType="silver" accentColor={colors.silverColor} label={t.silverTroyOz}   sublabel={t.silverTroyOzSub} price={silverOz} unit="EGP" changePercent={prices?.silverChangePercent} isLast bold />
        </TableCard>
      </View>
    </View>
  );
}

function CurrenciesTab({ prices }: { prices: ReturnType<typeof useMarketPrices>['data'] }) {
  const t = useT();
  const usd  = prices?.usdToEgp ?? 0;
  const fx   = prices?.fxRates  ?? {};

  const eur  = fx.EUR ?? 0;
  const gbp  = fx.GBP ?? 0;
  const sar  = fx.SAR ?? 0;
  const aed  = fx.AED ?? 0;
  const kwd  = fx.KWD ?? 0;
  const qar  = fx.QAR ?? 0;
  const try_ = fx.TRY ?? 0;
  const cny  = fx.CNY ?? 0;

  return (
    <View style={tab.group}>
      {/* USD hero */}
      <CurrencyHeroCard rate={usd} />

      {/* All currencies table */}
      <View style={tab.section}>
        <SLabel icon="dollar-sign" title={t.exchangeRatesVsEGP} />
        <TableCard>
          <CurrencyRow flag="🇪🇺" name={t.currencyEUR} pair="EUR / EGP" rate={eur}  unit={`${t.currencyUnitEGP} EUR`} />
          <CurrencyRow flag="🇬🇧" name={t.currencyGBP} pair="GBP / EGP" rate={gbp}  unit={`${t.currencyUnitEGP} GBP`} />
          <CurrencyRow flag="🇸🇦" name={t.currencySAR} pair="SAR / EGP" rate={sar}  unit={`${t.currencyUnitEGP} SAR`} />
          <CurrencyRow flag="🇦🇪" name={t.currencyAED} pair="AED / EGP" rate={aed}  unit={`${t.currencyUnitEGP} AED`} />
          <CurrencyRow flag="🇰🇼" name={t.currencyKWD} pair="KWD / EGP" rate={kwd}  unit={`${t.currencyUnitEGP} KWD`} />
          <CurrencyRow flag="🇶🇦" name={t.currencyQAR} pair="QAR / EGP" rate={qar}  unit={`${t.currencyUnitEGP} QAR`} />
          <CurrencyRow flag="🇹🇷" name={t.currencyTRY} pair="TRY / EGP" rate={try_} unit={`${t.currencyUnitEGP} TRY`} />
          <CurrencyRow flag="🇨🇳" name={t.currencyCNY} pair="CNY / EGP" rate={cny}  unit={`${t.currencyUnitEGP} CNY`} isLast />
        </TableCard>
        <Text style={tab.note}>{t.liveRatesNote}</Text>
      </View>
    </View>
  );
}

function EGXTab({ style, refreshing, onRefresh }: {
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return <EGXMarket style={style} refreshing={refreshing} onRefresh={onRefresh} />;
}

const tab = StyleSheet.create({
  group: { gap: 24 },
  section: { gap: 10 },
  note: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#6B7E96', textAlign: 'center', lineHeight: 16 },
});

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function MarketsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { data: prices, isLoading: lP, refetch: rP } = useMarketPrices();
  const [activeTab, setActiveTab] = useState<TabKey>('metals');

  const isLoading = lP;

  const prevGoldUsd   = useRef<number | undefined>(undefined);
  const followUpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didManualRefresh = useRef(false);

  useEffect(() => {
    const newGold = prices?.goldUsd;
    if (
      didManualRefresh.current &&
      newGold !== undefined &&
      prevGoldUsd.current !== undefined &&
      newGold !== prevGoldUsd.current
    ) {
      followUpTimer.current = setTimeout(() => { rP(); }, 1000);
    }
    if (newGold !== undefined) prevGoldUsd.current = newGold;
    didManualRefresh.current = false;
    return () => { if (followUpTimer.current) clearTimeout(followUpTimer.current); };
  }, [prices?.goldUsd]);

  const refetch = () => {
    didManualRefresh.current = true;
    prevGoldUsd.current = prices?.goldUsd;
    rP();
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const timestamp = prices?.lastUpdated && (activeTab === 'metals' || activeTab === 'currencies') ? (
    <View style={s.tsRow}>
      <Feather name="clock" size={11} color={colors.mutedForeground} />
      <Text style={[s.ts, { color: colors.mutedForeground }]}>
        {t.updatedAt}
        {new Date(prices.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </Text>
    </View>
  ) : null;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Fixed header — title + TabBar always at top, never scroll away */}
      <View style={[s.fixedHeader, { paddingTop: topPad + 16 }]}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>{t.marketsTitle}</Text>
          <LiveDot />
        </View>
        <TabBar active={activeTab} onChange={setActiveTab} />
      </View>

      {/* EGX: own FlatList that fills remaining space — true virtualization, 0 delay */}
      {activeTab === 'egx' ? (
        <EGXTab style={{ flex: 1 }} refreshing={isLoading} onRefresh={refetch} />
      ) : (
        /* All other tabs: ScrollView content area */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingBottom: botPad + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {activeTab === 'metals'      && <MetalsTab prices={prices} />}
          {activeTab === 'currencies'  && <CurrenciesTab prices={prices} />}
          {activeTab === 'real_estate' && <RealEstateTab />}
          {activeTab === 'us_stocks'   && <GlobalStocksMarket />}
          {activeTab === 'indices'     && <ComingSoon icon="globe" title={t.globalIndicesTitle} description={t.globalIndicesDesc} />}
          {timestamp}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  fixedHeader: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  tsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 8 },
  ts: { fontSize: 10, fontFamily: 'Inter_400Regular' },
});
