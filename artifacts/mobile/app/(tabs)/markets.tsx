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

// ─── Tab config ────────────────────────────────────────────────────────────────

type TabIconSpec =
  | { lib: 'feather'; name: keyof typeof Feather.glyphMap }
  | { lib: 'mci'; name: string };

const TABS_CONFIG = [
  { key: 'metals',      icon: { lib: 'mci',    name: 'gold' }          as TabIconSpec },
  { key: 'currencies',  icon: { lib: 'feather', name: 'dollar-sign' }  as TabIconSpec },
  { key: 'egx',        icon: { lib: 'feather', name: 'bar-chart-2' }  as TabIconSpec },
  { key: 'stocks',     icon: { lib: 'feather', name: 'trending-up' }  as TabIconSpec },
  { key: 'global',     icon: { lib: 'feather', name: 'globe' }        as TabIconSpec },
  { key: 'real_estate',icon: { lib: 'mci',    name: 'home-city' }     as TabIconSpec },
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
    stocks: t.tabStocks,
    global: t.tabGlobal,
    real_estate: t.tabRealEstate,
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
  const priceStr = price.toLocaleString('en-EG', { maximumFractionDigits: price < 10 ? 2 : 0 });

  return (
    <View style={[mh.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[mh.accent, { backgroundColor: accentColor }]} />
      <View style={mh.body}>
        <View style={mh.topRow}>
          <View style={mh.metalInfo}>
            <View style={[mh.iconWrap, { backgroundColor: accentColor + '1A' }]}>
              {metalType === 'gold'
                ? <MaterialCommunityIcons name="gold" size={22} color={accentColor} />
                : <Feather name="disc" size={22} color={accentColor} />
              }
            </View>
            <Text style={[mh.metalLabel, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
          {changePercent !== undefined && <ChangeBadge changePct={changePercent} />}
        </View>

        <View style={mh.priceRow}>
          <Text style={[mh.price, { color: colors.text }]}>{priceStr}</Text>
          <Text style={[mh.unit, { color: colors.mutedForeground }]}> {unit}</Text>
        </View>

        {(usdPrice !== undefined || troyEgp !== undefined) && (
          <View style={mh.metaRow}>
            {usdPrice !== undefined && usdPrice > 0 && (
              <View style={[mh.metaPill, { backgroundColor: colors.muted }]}>
                <Text style={[mh.metaTxt, { color: colors.mutedForeground }]}>
                  ${usdPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
                </Text>
              </View>
            )}
            {troyEgp !== undefined && troyEgp > 0 && (
              <View style={[mh.metaPill, { backgroundColor: colors.muted }]}>
                <Text style={[mh.metaTxt, { color: colors.mutedForeground }]}>
                  Troy: {troyEgp.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
const mh = StyleSheet.create({
  card: {
    borderRadius: 20, borderWidth: 1, flexDirection: 'row',
    overflow: 'hidden',
  },
  accent: { width: 4, alignSelf: 'stretch' },
  body: { flex: 1, padding: 18, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metalInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metalLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end' },
  price: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  unit: { fontSize: 13, fontFamily: 'Inter_400Regular', paddingBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  metaTxt: { fontSize: 12, fontFamily: 'Inter_500Medium' },
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
          {metalType === 'gold'
            ? <MaterialCommunityIcons name="gold" size={17} color={accentColor} />
            : <Feather name="disc" size={17} color={accentColor} />
          }
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
        <View style={ch.topRow}>
          <View style={ch.flagRow}>
            <Text style={ch.flag}>🇺🇸</Text>
            <View>
              <Text style={[ch.name, { color: colors.text }]}>{t.currencyUSD}</Text>
              <Text style={[ch.pair, { color: colors.mutedForeground }]}>USD / EGP</Text>
            </View>
          </View>
          <View style={[ch.livePill, { backgroundColor: colors.green + '18' }]}>
            <Animated.View style={[ch.liveDot, { backgroundColor: colors.green, opacity }]} />
            <Text style={[ch.liveTxt, { color: colors.green }]}>{t.liveLabel}</Text>
          </View>
        </View>
        <View style={ch.rateRow}>
          <Text style={[ch.rate, { color: colors.text }]}>
            {rate.toLocaleString('en-EG', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
          </Text>
          <Text style={[ch.rateUnit, { color: colors.mutedForeground }]}> EGP</Text>
        </View>
        <Text style={[ch.sub, { color: colors.mutedForeground }]}>
          {t.currencyUnitEGP} 1 US Dollar
        </Text>
      </View>
    </View>
  );
}
const ch = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  accent: { width: 4, alignSelf: 'stretch' },
  body: { flex: 1, padding: 18, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flag: { fontSize: 28 },
  name: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  pair: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveTxt: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  rateRow: { flexDirection: 'row', alignItems: 'flex-end' },
  rate: { fontSize: 38, fontFamily: 'Inter_700Bold', letterSpacing: -1.5 },
  rateUnit: { fontSize: 14, fontFamily: 'Inter_400Regular', paddingBottom: 5 },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
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
      {/* Gold hero */}
      <MetalHeroCard
        metalType="gold"
        accentColor={colors.primary}
        label={t.gold24K}
        price={gold24}
        usdPrice={prices?.goldUsd}
        troyEgp={goldOz}
        changePercent={prices?.goldChangePercent}
      />

      {/* Gold table */}
      <View style={tab.section}>
        <SLabel icon={{ lib: 'mci', name: 'gold' }} title={t.goldSectionLabel} />
        <TableCard>
          <MetalRow metalType="gold" accentColor={colors.primary} label={t.gold22K}   sublabel={t.gold22KSub}    price={gold22} />
          <MetalRow metalType="gold" accentColor={colors.primary} label={t.gold21K}   sublabel={t.gold21KSub}    price={gold21} />
          <MetalRow metalType="gold" accentColor={colors.goldDark ?? '#A68700'} label={t.gold18K} sublabel={t.gold18KSub} price={gold18} />
          <MetalRow metalType="gold" accentColor={colors.primary} label={t.goldTroyOz} sublabel={t.goldTroyOzSub} price={goldOz} unit="EGP" usdPrice={prices?.goldUsd} isLast bold />
        </TableCard>
      </View>

      {/* Silver hero */}
      <MetalHeroCard
        metalType="silver"
        accentColor={colors.silverColor}
        label={t.silver999Label}
        price={silver999}
        usdPrice={prices?.silverUsd}
        troyEgp={silverOz}
        changePercent={prices?.silverChangePercent}
      />

      {/* Silver table */}
      <View style={tab.section}>
        <SLabel icon="disc" title={t.silverSectionLabel} />
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

function EGXTab() {
  return (
    <View style={tab.group}>
      <EGXMarket />
    </View>
  );
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

  const prevGoldUsd  = useRef<number | undefined>(undefined);
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

  function renderContent() {
    switch (activeTab) {
      case 'metals':      return <MetalsTab prices={prices} />;
      case 'currencies':  return <CurrenciesTab prices={prices} />;
      case 'egx':         return <EGXTab />;
      case 'stocks':      return <GlobalStocksMarket />;
      case 'global':
        return <ComingSoon icon="globe"  title={t.globalIndicesTitle}     description={t.globalIndicesDesc} />;
      case 'real_estate':
        return <ComingSoon icon="home"   title={t.realEstateMarketTitle}  description={t.realEstateMarketDesc} />;
    }
  }

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: topPad + 20, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: colors.text }]}>{t.marketsTitle}</Text>
        </View>
        <LiveDot />
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {renderContent()}

      {prices?.lastUpdated && (activeTab === 'metals' || activeTab === 'currencies' || activeTab === 'egx') && (
        <View style={s.tsRow}>
          <Feather name="clock" size={11} color={colors.mutedForeground} />
          <Text style={[s.ts, { color: colors.mutedForeground }]}>
            {t.updatedAt}
            {new Date(prices.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  tsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 8 },
  ts: { fontSize: 10, fontFamily: 'Inter_400Regular' },
});
