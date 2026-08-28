import React, { useRef, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import {
  Animated, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useCounterDisplay } from '@/hooks/useCounterDisplay';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { pricesAreFresh } from '@/utils/pricesCache';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { EGXMarket } from '@/components/EGXMarket';
import { GlobalStocksMarket } from '@/components/GlobalStocksMarket';
import { useGlobalStocks } from '@/hooks/useGlobalStocks';
import { BetaChip } from '@/components/BetaChip';
import { useRealEstatePrices, RealEstateAreaLive } from '@/hooks/useRealEstatePrices';
import { useRealEstateCompoundPrices, RealEstateCompoundLive } from '@/hooks/useRealEstateCompoundPrices';

// ─── Tab config ────────────────────────────────────────────────────────────────

type TabIconSpec =
  | { lib: 'feather'; name: keyof typeof Feather.glyphMap }
  | { lib: 'mci'; name: string };

const TABS_CONFIG = [
  { key: 'metals',      icon: { lib: 'mci',    name: 'gold' }          as TabIconSpec },
  { key: 'currencies',  icon: { lib: 'feather', name: 'dollar-sign' }  as TabIconSpec },
  { key: 'egx',        icon: { lib: 'feather', name: 'bar-chart-2' }  as TabIconSpec },
  { key: 'real_estate',icon: { lib: 'mci',    name: 'home-city' }     as TabIconSpec },
  { key: 'us_stocks',  icon: { lib: 'feather', name: 'activity' }     as TabIconSpec },
] as const;

type TabKey = typeof TABS_CONFIG[number]['key'];

// Persists the selected tab in memory so navigating away and back keeps the user's place
let _persistedTab: TabKey = 'metals';

function TabIcon({ spec, size, color }: { spec: TabIconSpec; size: number; color: string }) {
  if (spec.lib === 'mci') {
    return <MaterialCommunityIcons name={spec.name as any} size={size} color={color} />;
  }
  return <Feather name={spec.name} size={size} color={color} />;
}

// ─── Live dot ──────────────────────────────────────────────────────────────────

function LiveDot({ fresh }: { fresh: boolean }) {
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
  // Matches the Overview tab: prices rehydrated from the launch cache are real
  // but can be minutes old, and calling that "LIVE" with a pulsing green dot
  // would be a claim the data doesn't support. Goes grey and stops pulsing
  // until a fresh fetch lands — normally well under a second.
  const tint = fresh ? colors.green : colors.mutedForeground;
  return (
    <View style={ldSt.row}>
      <Animated.View style={[ldSt.dot, { backgroundColor: tint, opacity: fresh ? opacity : 0.5 }]} />
      <Text style={[ldSt.text, { color: tint }]}>{t.liveLabel}</Text>
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
  // Same fix as the Home Today badge/breakdown: an exact 0.00% (e.g. gold
  // outside trading hours, or genuinely flat) satisfies changePct >= 0 and
  // read as a green "gain" — flat isn't a gain.
  const isFlat = Math.abs(changePct) < 0.005;
  const isPos = changePct >= 0;
  const color = isFlat ? colors.mutedForeground : (isPos ? colors.green : colors.red);
  return (
    <View style={[cb.badge, { backgroundColor: color + '15' }]}>
      <Feather name={isFlat ? 'minus' : isPos ? 'arrow-up-right' : 'arrow-down-right'} size={11} color={color} />
      <Text style={[cb.txt, { color }]}>
        {!isFlat && isPos ? '+' : ''}{changePct.toFixed(2)}%
      </Text>
    </View>
  );
}
const cb = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  txt: { fontSize: 11, fontFamily: 'Inter_700Bold' },
});

// ─── Metal hero card ───────────────────────────────────────────────────────────

// Always 2 decimals, not just below 10 EGP/g — gold/silver move by cents on
// the underlying USD spot every ~30s poll, which is well under 1 EGP/g once
// converted. Rounded to a whole EGP, that real live tick was invisible (the
// counter animates every poll, but nothing visibly changed most of the
// time), making it look like only a manual refresh — spaced minutes apart,
// so the accumulated move crosses a whole-EGP line — ever moved the number.
const metalPriceFormatter = (n: number) => n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function MetalHeroCard({
  metalType, accentColor, label, price, unit = 'EGP/g',
  usdPrice, troyEgp, changePercent,
}: {
  metalType: 'gold' | 'silver';
  accentColor: string;
  label: string;
  price: number;
  unit?: string;
  usdPrice?: number;
  troyEgp?: number;
  changePercent?: number;
}) {
  const colors = useColors();
  // No flash-on-change here (unlike the Home hero value) — this is a live
  // market reference price, not the user's own gain/loss, so a green/red
  // flash would read as "you just made/lost money" when nothing of theirs
  // moved. Just the smooth count-up, deliberately calmer than the hero.
  const { text: priceStr } = useCounterDisplay(price, metalPriceFormatter, false);

  const refs: string[] = [];
  if (usdPrice && usdPrice > 0) refs.push(`$${usdPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`);
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
          <Animated.Text
            style={[mh.price, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {priceStr}
          </Animated.Text>
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
  // overflow: 'hidden' clips the accent bar's square corners into the card's
  // own radius — matches CurrencyHeroCard's approach. The previous manual
  // borderTopLeftRadius/borderBottomLeftRadius (15) didn't quite match the
  // card's own radius (16) plus its 1px border, leaving a visible seam at
  // the top/bottom-left corners that the currency hero card didn't have.
  card: { borderRadius: 16, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  accent: { width: 4, alignSelf: 'stretch' },
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
  // No flash-on-change — see MetalHeroCard's comment above.
  const { text: priceStr } = useCounterDisplay(price, metalPriceFormatter, false);
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
        <Animated.Text style={[mr.price, { color: colors.text }, bold && mr.priceBold]}>
          {priceStr}
          <Text style={[mr.unit, { color: colors.mutedForeground }]}> {unit}</Text>
        </Animated.Text>
        {usdPrice !== undefined && usdPrice > 0 && (
          <Text style={[mr.usdLine, { color: colors.mutedForeground }]}>
            ${usdPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
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

function CurrencyHeroCard({ rate, changePercent }: { rate: number; changePercent?: number }) {
  const colors = useColors();
  const t = useT();

  return (
    <View style={[ch.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[ch.accent, { backgroundColor: '#4A9EFF' }]} />
      <View style={ch.body}>
        {/* Top: flag + name/pair. The page header above already shows a
            single "LIVE" indicator — a second one here (as this card used
            to have) was a redundant duplicate, not a second signal.
            changePercent is today's rate vs. yesterday's Cairo-day close
            (marketCloseSnapshotsTable — see markets.ts), resetting itself
            every Cairo midnight the same way gold/silver's does; there IS
            a real same-day reference for USD/EGP after all (this card just
            never used it before). */}
        <View style={ch.topRow}>
          <View style={ch.flagRow}>
            <Text style={ch.flag}>🇺🇸</Text>
            <View style={ch.nameGroup}>
              <Text style={[ch.name, { color: colors.text }]}>{t.currencyUSD}</Text>
              <Text style={[ch.pair, { color: colors.mutedForeground }]}>USD / EGP</Text>
            </View>
          </View>
          {changePercent !== undefined && <ChangeBadge changePct={changePercent} />}
        </View>
        {/* Rate */}
        <View style={ch.rateRow}>
          <Text
            style={[ch.rate, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
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
        <Text
          style={[cr.rate, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
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

function fmtKEGP(n: number): string {
  return `${Math.round(n / 1_000)}K`;
}

function RERow({ area, isLast }: { area: RealEstateAreaLive; isLast: boolean }) {
  const colors = useColors();
  const t = useT();
  const pct = area.changePercent ?? 0;
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const tc = isUp ? colors.green : isDown ? colors.red : colors.mutedForeground;
  return (
    <View style={[
      rer.row,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <View style={[rer.icon, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '28' }]}>
        <MaterialCommunityIcons name="home-city" size={14} color={colors.primary} />
      </View>
      <View style={rer.info}>
        <View style={rer.nameRow}>
          <Text style={[rer.name, { color: colors.text }]} numberOfLines={1}>{area.area}</Text>
        </View>
        <Text style={[rer.range, { color: colors.mutedForeground }]} numberOfLines={1}>
          {area.minPricePerM2 != null && area.maxPricePerM2 != null
            ? `${fmtKEGP(area.minPricePerM2)}–${fmtKEGP(area.maxPricePerM2)} EGP/m²`
            : t.reNoDataYet}
        </Text>
      </View>
      <View style={rer.right}>
        <Text style={[rer.price, { color: area.avgPricePerM2 != null ? colors.text : colors.mutedForeground }]}>
          {area.avgPricePerM2 != null ? (
            <>
              {fmtKEGP(area.avgPricePerM2)}{' '}
              <Text style={[rer.unit, { color: colors.mutedForeground }]}>EGP/m²</Text>
            </>
          ) : '—'}
        </Text>
        {area.changePercent != null ? (
          <View style={[rer.badge, { backgroundColor: tc + '18' }]}>
            <Text style={[rer.badgeTxt, { color: tc }]}>
              {isUp ? '↑' : isDown ? '↓' : '–'} {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
            </Text>
          </View>
        ) : (
          <View style={[rer.badge, { backgroundColor: colors.muted }]}>
            <Text style={[rer.badgeTxt, { color: colors.mutedForeground }]}>{t.naBadge}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
const rer = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  estBadge: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  estTxt: { fontSize: 9, fontFamily: 'Inter_500Medium' },
  range: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  right: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  price: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  unit: { fontSize: 10, fontFamily: 'Inter_400Regular', letterSpacing: 0 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeTxt: { fontSize: 10, fontFamily: 'Inter_700Bold' },
});

// ─── Area / Developer toggle ─────────────────────────────────────────────────

function GroupByToggle({ active, onChange }: { active: 'area' | 'developer'; onChange: (v: 'area' | 'developer') => void }) {
  const colors = useColors();
  const t = useT();
  const options: { key: 'area' | 'developer'; label: string }[] = [
    { key: 'area', label: t.reGroupByAreaLabel },
    { key: 'developer', label: t.reGroupByDeveloperLabel },
  ];
  return (
    <View style={gbt.row}>
      {options.map(opt => {
        const isActive = opt.key === active;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              gbt.pill,
              { backgroundColor: isActive ? colors.primary : colors.muted },
            ]}
          >
            <Text style={[gbt.label, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const gbt = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});

// ─── Compound row ─────────────────────────────────────────────────────────────

function CompoundRow({ compound, isLast }: { compound: RealEstateCompoundLive; isLast: boolean }) {
  const colors = useColors();
  const t = useT();
  const pct = compound.changePercent ?? 0;
  const isUp = pct > 0;
  const isDown = pct < 0;
  const tc = isUp ? colors.green : isDown ? colors.red : colors.mutedForeground;
  return (
    <View style={[
      rer.row,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <View style={[rer.icon, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '28' }]}>
        <MaterialCommunityIcons name="home-city" size={14} color={colors.primary} />
      </View>
      <View style={rer.info}>
        <Text style={[rer.name, { color: colors.text }]} numberOfLines={1}>{compound.name}</Text>
        <Text style={[rer.range, { color: colors.mutedForeground }]} numberOfLines={1}>
          {compound.developer} · {compound.governorate}
        </Text>
      </View>
      <View style={rer.right}>
        {compound.avgPricePerM2 != null ? (
          <>
            <Text style={[rer.price, { color: colors.text }]}>
              {fmtKEGP(compound.avgPricePerM2)}{' '}
              <Text style={[rer.unit, { color: colors.mutedForeground }]}>EGP/m²</Text>
            </Text>
            {compound.priceSource === 'compound' ? (
              <View style={[rer.badge, { backgroundColor: tc + '18' }]}>
                <Text style={[rer.badgeTxt, { color: tc }]}>
                  {isUp ? '↑' : isDown ? '↓' : '–'} {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                </Text>
              </View>
            ) : (
              <View style={[rer.badge, { backgroundColor: colors.muted }]}>
                <Text style={[rer.badgeTxt, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {/* Names the actual area the number is borrowed from — a
                      generic "≈ Area avg" badge here read as if it were this
                      compound's own price, which is exactly what caused
                      Palm Hills October to be mistaken for its own market
                      rate when it was really just 6th of October's average. */}
                  {compound.areaLabel ? `≈ ${compound.areaLabel}` : t.reAreaEstimateBadge}
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={[rer.badge, { backgroundColor: colors.muted }]}>
            <Text style={[rer.badgeTxt, { color: colors.mutedForeground }]}>{t.naBadge}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function RealEstateTab() {
  const colors = useColors();
  const t = useT();
  const [groupBy, setGroupBy] = React.useState<'area' | 'developer'>('area');
  const { data: areas = [] } = useRealEstatePrices();
  const { data: compounds = [] } = useRealEstateCompoundPrices();

  const govSections = React.useMemo(() => {
    const map = new Map<string, RealEstateAreaLive[]>();
    areas.forEach(a => {
      if (!map.has(a.governorate)) map.set(a.governorate, []);
      map.get(a.governorate)!.push(a);
    });
    return Array.from(map.entries()).map(([gov, list]) => ({ gov, areas: list }));
  }, [areas]);

  const devSections = React.useMemo(() => {
    const map = new Map<string, RealEstateCompoundLive[]>();
    compounds.forEach(c => {
      if (!map.has(c.developer)) map.set(c.developer, []);
      map.get(c.developer)!.push(c);
    });
    return Array.from(map.entries())
      .map(([dev, list]) => ({ dev, compounds: list }))
      .sort((a, b) => b.compounds.length - a.compounds.length);
  }, [compounds]);

  // "Live as of [latest scrape]" if anything has actually been scraped yet,
  // otherwise honestly says "Estimate" instead of a fake/stale date pill —
  // this used to be a hardcoded "Q2 2026" string, unrelated to whether the
  // data behind it was actually current.
  const freshnessLabel = React.useMemo(() => {
    const source = groupBy === 'area' ? areas : compounds;
    const liveUpdatedAts = source.filter(a => a.isLive && a.updatedAt).map(a => new Date(a.updatedAt!).getTime());
    if (liveUpdatedAts.length === 0) return t.reEstimateLabel;
    const latest = new Date(Math.max(...liveUpdatedAts));
    return latest.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, [areas, compounds, groupBy, t]);

  return (
    <View style={tab.group}>
      {/* Hero info card */}
      <View style={[reh.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[reh.accent, { backgroundColor: colors.primary }]} />
        <View style={reh.body}>
          <View style={reh.topRow}>
            <View style={reh.nameRow}>
              <View style={[reh.iconWrap, { backgroundColor: colors.primary + '18' }]}>
                <MaterialCommunityIcons name="home-city" size={15} color={colors.primary} />
              </View>
              <Text style={[reh.label, { color: colors.mutedForeground }]} numberOfLines={1}>
                {t.rePropertyMarketTitle}
              </Text>
              <BetaChip label={t.reBetaChip} />
            </View>
            <View style={[reh.pill, { backgroundColor: colors.muted }]}>
              <Text style={[reh.pillTxt, { color: colors.mutedForeground }]}>{freshnessLabel}</Text>
            </View>
          </View>
          <Text style={[reh.title, { color: colors.text }]}>
            {groupBy === 'area' ? `${areas.length} ${t.reAreasAvgLabel}` : `${compounds.length} ${t.reCompoundsAvgLabel}`}
          </Text>
          <Text style={[reh.sub, { color: colors.mutedForeground }]}>{t.reMarketSubHeader}</Text>
        </View>
      </View>

      <GroupByToggle active={groupBy} onChange={setGroupBy} />

      {groupBy === 'area' ? (
        // One section per governorate
        govSections.map(({ gov, areas: list }) => (
          <View key={gov} style={tab.section}>
            <SLabel icon={{ lib: 'feather', name: 'map-pin' }} title={gov.toUpperCase()} />
            <TableCard>
              {list.map((area, idx) => (
                <RERow key={area.id} area={area} isLast={idx === list.length - 1} />
              ))}
            </TableCard>
          </View>
        ))
      ) : (
        // One section per developer
        devSections.map(({ dev, compounds: list }) => (
          <View key={dev} style={tab.section}>
            <SLabel icon={{ lib: 'feather', name: 'briefcase' }} title={dev.toUpperCase()} />
            <TableCard>
              {list.map((compound, idx) => (
                <CompoundRow key={compound.id} compound={compound} isLast={idx === list.length - 1} />
              ))}
            </TableCard>
          </View>
        ))
      )}

      <Text style={tab.note}>{groupBy === 'area' ? t.reMarketDisclaimer : t.reCompoundDisclaimer}</Text>
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
      <BetaChip label={t.betaPreview} />
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
});

// ─── Tab content ───────────────────────────────────────────────────────────────

function MetalsTab({ prices }: { prices: ReturnType<typeof useMarketPrices>['data'] }) {
  const colors = useColors();
  const t = useT();
  // Prices rehydrated from the launch cache carry real spot values but no
  // usable daily move — those deltas are relative to today's open and get
  // zeroed on load. Passing undefined hides the change badge entirely until a
  // real fetch lands, rather than briefly asserting a flat 0.00%.
  const goldChangePct   = prices?.changesUnknown ? undefined : prices?.goldChangePercent;
  const silverChangePct = prices?.changesUnknown ? undefined : prices?.silverChangePercent;

  // Not rounded — gold/silver move by cents on the underlying USD spot
  // every ~30s poll, well under 1 EGP/g converted. Math.round used to
  // throw that real live tick away before it ever reached the animated
  // counter, so nothing visibly moved except after a manual refresh spaced
  // far enough apart to cross a whole-EGP line.
  const gold24 = prices ? goldPricePerGram(prices, '24k') : 0;
  const gold22 = prices ? goldPricePerGram(prices, '22k') : 0;
  const gold21 = prices ? goldPricePerGram(prices, '21k') : 0;
  const gold18 = prices ? goldPricePerGram(prices, '18k') : 0;
  const goldOz = prices ? prices.goldUsd * prices.usdToEgp : 0;
  const silverPure = prices ? silverPricePerGram(prices) : 0;
  const silver999  = prices ? silverPure * 0.999 : 0;
  const silver925  = prices ? silverPure * 0.925 : 0;
  const silverOz   = prices ? prices.silverUsd * prices.usdToEgp : 0;

  return (
    // Tighter than tab.group's default 24 — that gap reads fine between bare
    // sections, but here it stacks on top of the note's own line-height right
    // above the next section's icon+title, so it visibly overshoots.
    <View style={[tab.group, { gap: 12 }]}>
      {/* Gold section */}
      <View style={tab.section}>
        <SLabel icon={{ lib: 'mci', name: 'gold' }} title={t.goldSectionLabel} />
        <MetalHeroCard
          metalType="gold"
          accentColor={colors.primary}
          label={t.gold24K}
          price={gold24}
          usdPrice={prices?.goldUsd}
          troyEgp={goldOz}
          changePercent={goldChangePct}
        />
        <TableCard>
          <MetalRow metalType="gold" accentColor={colors.primary} label={t.gold22K}   sublabel={t.gold22KSub}    price={gold22} />
          <MetalRow metalType="gold" accentColor={colors.primary} label={t.gold21K}   sublabel={t.gold21KSub}    price={gold21} />
          <MetalRow metalType="gold" accentColor={colors.goldDark ?? '#A68700'} label={t.gold18K} sublabel={t.gold18KSub} price={gold18} />
          <MetalRow metalType="gold" accentColor={colors.primary} label={t.goldTroyOz} sublabel={t.goldTroyOzSub} price={goldOz} unit="EGP" usdPrice={prices?.goldUsd} isLast bold />
        </TableCard>
        <Text style={tab.note}>{t.realGoldPriceNote}</Text>
      </View>

      {/* Silver section */}
      <View style={tab.section}>
        <SLabel icon={{ lib: 'mci', name: 'gold' }} title={t.silverSectionLabel} />
        <MetalHeroCard
          metalType="silver"
          accentColor={colors.silverColor}
          label={t.silver999Label}
          price={silver999}
          usdPrice={prices?.silverUsd}
          troyEgp={silverOz}
          changePercent={silverChangePct}
        />
        <TableCard>
          <MetalRow metalType="silver" accentColor={colors.silverColor} label={t.silver925Label} sublabel={t.silver925Sub}    price={silver925} />
          <MetalRow metalType="silver" accentColor={colors.silverColor} label={t.silverTroyOz}   sublabel={t.silverTroyOzSub} price={silverOz} unit="EGP" changePercent={silverChangePct} isLast bold />
        </TableCard>
        <Text style={tab.note}>{t.realGoldPriceNote}</Text>
      </View>
    </View>
  );
}

function CurrenciesTab({ prices }: { prices: ReturnType<typeof useMarketPrices>['data'] }) {
  const t = useT();
  const usd  = prices?.usdToEgp ?? 0;
  const fx   = prices?.fxRates  ?? {};
  // Same launch-cache guard as gold/silver above: a rehydrated cache has a
  // real spot rate but no usable daily delta (zeroed on load), so hide the
  // badge rather than briefly show a wrong flat 0.00%.
  const usdChangePct = prices?.changesUnknown ? undefined : prices?.usdToEgpChangePercent;

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
      {/* Title above the hero, then hero, then table — matching Gold/Silver's
          title → hero → table order (this used to have the hero above the
          title, the only tab where the order was flipped). */}
      <View style={tab.section}>
        <SLabel icon="dollar-sign" title={t.exchangeRatesVsEGP} />
        <CurrencyHeroCard rate={usd} changePercent={usdChangePct} />
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

function EGXTab({ style, refreshing, onRefresh, topHeader, topInset }: {
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  topHeader?: React.ReactNode;
  topInset?: number;
}) {
  return <EGXMarket style={style} refreshing={refreshing} onRefresh={onRefresh} topHeader={topHeader} topInset={topInset} />;
}

function USStocksTab({ style, refreshing, onRefresh, topHeader, topInset }: {
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  topHeader?: React.ReactNode;
  topInset?: number;
}) {
  return <GlobalStocksMarket style={style} refreshing={refreshing} onRefresh={onRefresh} topHeader={topHeader} topInset={topInset} />;
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
  // Shares the same query cache as EGXMarket.tsx's own useEGXMarket() call
  // (same queryKey) — this doesn't trigger a second fetch, just reads the
  // already-in-flight/cached result so the header dot can reflect EGX's own
  // live status instead of metals'.
  const { data: egxStocks = [] } = useEGXMarket();
  const egxHasLive = egxStocks.some(s => s.isLive);
  // Shares useGlobalStocks' own query cache (same queryKey) — same reasoning
  // as egxHasLive above, just for the US Stocks tab's header dot.
  const { data: globalStocksForDot = [] } = useGlobalStocks();
  const usStocksHasLive = globalStocksForDot.some(s => s.isLive);
  const [activeTab, setActiveTab] = useState<TabKey>(_persistedTab);
  const { impact } = useHaptic();

  const handleTabChange = (k: TabKey) => {
    _persistedTab = k;
    setActiveTab(k);
  };

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
    impact();
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
      <Stack.Screen options={{ headerShown: false }} />
      {/* EGX and US Stocks: own FlatList each — header scrolls as ListHeaderComponent */}
      {activeTab === 'egx' ? (
        <EGXTab
          style={{ flex: 1 }}
          refreshing={isLoading}
          onRefresh={refetch}
          topInset={topPad}
          topHeader={
            <View style={{ gap: 16, paddingTop: 16 }}>
              <View style={s.header}>
                <Text style={[s.title, { color: colors.text }]}>{t.marketsTitle}</Text>
                {/* EGX's own live status, not metals' — this used to always
                    show metals freshness even while EGX itself was showing
                    an "ESTIMATED" pill right below it, two contradicting
                    signals on the same screen. */}
                <LiveDot fresh={egxHasLive} />
              </View>
              <TabBar active={activeTab} onChange={handleTabChange} />
            </View>
          }
        />
      ) : activeTab === 'us_stocks' ? (
        <USStocksTab
          style={{ flex: 1 }}
          refreshing={isLoading}
          onRefresh={refetch}
          topInset={topPad}
          topHeader={
            <View style={{ gap: 16, paddingTop: 16 }}>
              <View style={s.header}>
                <Text style={[s.title, { color: colors.text }]}>{t.marketsTitle}</Text>
                <LiveDot fresh={usStocksHasLive} />
              </View>
              <TabBar active={activeTab} onChange={handleTabChange} />
            </View>
          }
        />
      ) : (
        /* All other tabs: header + content scroll together */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingTop: 16, paddingBottom: botPad + 100 }]}
          contentInset={{ top: topPad }}
          contentOffset={{ x: 0, y: -topPad }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <View style={{ gap: 16 }}>
            <View style={s.header}>
              <Text style={[s.title, { color: colors.text }]}>{t.marketsTitle}</Text>
              <LiveDot fresh={pricesAreFresh(prices?.lastUpdated)} />
            </View>
            <TabBar active={activeTab} onChange={handleTabChange} />
          </View>
          {activeTab === 'metals'      && <MetalsTab prices={prices} />}
          {activeTab === 'currencies'  && <CurrenciesTab prices={prices} />}
          {activeTab === 'real_estate' && <RealEstateTab />}
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
  title: { fontSize: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  tsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 8 },
  ts: { fontSize: 10, fontFamily: 'Inter_400Regular' },
});
