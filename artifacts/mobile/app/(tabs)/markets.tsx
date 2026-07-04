import React, { useRef, useEffect, useState } from 'react';
import {
  Animated, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { EGXMarket } from '@/components/EGXMarket';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'metals',      label: 'Metals',      icon: 'award'       },
  { key: 'currencies',  label: 'Currencies',  icon: 'dollar-sign' },
  { key: 'egx',        label: 'EGX',         icon: 'bar-chart-2' },
  { key: 'stocks',     label: 'Stocks',      icon: 'trending-up' },
  { key: 'global',     label: 'Global',      icon: 'globe'       },
  { key: 'real_estate',label: 'Real Estate', icon: 'home'        },
  { key: 'crypto',     label: 'Crypto',      icon: 'cpu'         },
] as const;

type TabKey = typeof TABS[number]['key'];

// ─── Live dot ─────────────────────────────────────────────────────────────────

function LiveDot() {
  const colors = useColors();
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
      <Text style={[ldSt.text, { color: colors.green }]}>LIVE</Text>
    </View>
  );
}
const ldSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
});

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tb.row}
      style={tb.wrap}
    >
      {TABS.map(tab => {
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
            <Feather
              name={tab.icon as any}
              size={12}
              color={isActive ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text style={[tb.label, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
              {tab.label}
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

// ─── Change badge (dot + %) ───────────────────────────────────────────────────
// Used by both MetalRow and StockRow

function ChangeBadge({ changePct }: { changePct: number }) {
  const colors = useColors();
  const isPos = changePct >= 0;
  const color = isPos ? colors.green : colors.red;
  return (
    <View style={[cb.badge, { backgroundColor: color + '15' }]}>
      <View style={[cb.dot, { backgroundColor: color }]} />
      <Text style={[cb.txt, { color }]}>
        {isPos ? '+' : ''}{changePct.toFixed(2)}%
      </Text>
    </View>
  );
}
const cb = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  txt: { fontSize: 11, fontFamily: 'Inter_700Bold' },
});

// ─── Metal row ────────────────────────────────────────────────────────────────

function MetalRow({
  accentColor, label, sublabel, price, unit = 'EGP/g',
  usdPrice, changePercent, isLast, bold,
}: {
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
        <View style={[mr.dotWrap, { backgroundColor: accentColor + '20', borderColor: accentColor + '40' }]}>
          <View style={[mr.metalDot, { backgroundColor: accentColor }]} />
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
  dotWrap: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  metalDot: { width: 10, height: 10, borderRadius: 5 },
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

// ─── Table card ───────────────────────────────────────────────────────────────

function TableCard({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[tc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}
const tc = StyleSheet.create({ card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' } });

// ─── Section label ────────────────────────────────────────────────────────────

function SLabel({ icon, title }: { icon: keyof typeof Feather.glyphMap; title: string }) {
  const colors = useColors();
  return (
    <View style={sl.row}>
      <View style={[sl.iconWrap, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={12} color={colors.mutedForeground} />
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

// ─── Currency row ─────────────────────────────────────────────────────────────

function CurrencyRow({
  flag, name, pair, rate, unit, isLast, isLive,
}: {
  flag: string; name: string; pair: string;
  rate: number; unit: string; isLast?: boolean; isLive?: boolean;
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
        <View style={cr.nameRow}>
          <Text style={[cr.name, { color: colors.text }]}>{name}</Text>
          {isLive && (
            <View style={[cr.livePill, { backgroundColor: colors.green + '18' }]}>
              <Text style={[cr.liveTxt, { color: colors.green }]}>LIVE</Text>
            </View>
          )}
        </View>
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
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  flag: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  flagTxt: { fontSize: 22 },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  livePill: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  liveTxt: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  pair: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  right: { alignItems: 'flex-end', gap: 2 },
  rate: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  unit: { fontSize: 10, fontFamily: 'Inter_400Regular' },
});

// ─── EGX stock row ────────────────────────────────────────────────────────────

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

// ─── Coming soon ──────────────────────────────────────────────────────────────

function ComingSoon({ icon, title, description }: {
  icon: keyof typeof Feather.glyphMap; title: string; description: string;
}) {
  const colors = useColors();
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
        <Text style={[cs.badgeTxt, { color: colors.primary }]}>Coming Soon</Text>
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

// ─── Tab content ──────────────────────────────────────────────────────────────

function MetalsTab({ prices }: { prices: ReturnType<typeof useMarketPrices>['data'] }) {
  const colors = useColors();
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
      <View style={tab.section}>
        <SLabel icon="award" title="GOLD" />
        <TableCard>
          <MetalRow accentColor={colors.primary} label="24K · Pure Gold"   sublabel="99.9% · Per gram"    price={gold24} changePercent={prices?.goldChangePercent} />
          <MetalRow accentColor={colors.primary} label="22K Gold"           sublabel="91.67% · Per gram"   price={gold22} />
          <MetalRow accentColor={colors.primary} label="21K Gold"           sublabel="87.5% · Per gram"    price={gold21} />
          <MetalRow accentColor={colors.goldDark ?? '#A68700'} label="18K Gold" sublabel="75.0% · Per gram" price={gold18} />
          <MetalRow accentColor={colors.primary} label="Gold · Troy Ounce"  sublabel="31.10 g · XAU/EGP"   price={goldOz}   unit="EGP" usdPrice={prices?.goldUsd} changePercent={prices?.goldChangePercent} isLast bold />
        </TableCard>
      </View>
      <View style={tab.section}>
        <SLabel icon="circle" title="SILVER" />
        <TableCard>
          <MetalRow accentColor={colors.silverColor} label="Silver 999 · Fine"    sublabel="99.9% · Per gram"  price={silver999} changePercent={prices?.silverChangePercent} />
          <MetalRow accentColor={colors.silverColor} label="Silver 925 · Sterling" sublabel="92.5% · Per gram"  price={silver925} />
          <MetalRow accentColor={colors.silverColor} label="Silver · Troy Ounce"  sublabel="31.10 g · XAG/EGP"  price={silverOz}  unit="EGP" changePercent={prices?.silverChangePercent} isLast bold />
        </TableCard>
      </View>
    </View>
  );
}

function CurrenciesTab({ prices }: { prices: ReturnType<typeof useMarketPrices>['data'] }) {
  const usd = prices ? prices.usdToEgp : 0;
  const sar = prices ? usd / 3.75    : 0;
  const aed = prices ? usd / 3.6725  : 0;
  const kwd = prices ? usd * 3.25    : 0;

  return (
    <View style={tab.group}>
      <View style={tab.section}>
        <SLabel icon="dollar-sign" title="EXCHANGE RATES vs. EGP" />
        <TableCard>
          <CurrencyRow flag="🇺🇸" name="US Dollar"     pair="USD / EGP" rate={usd} unit="EGP per 1 USD" isLive />
          <CurrencyRow flag="🇸🇦" name="Saudi Riyal"   pair="SAR / EGP" rate={sar} unit="EGP per 1 SAR" isLive />
          <CurrencyRow flag="🇦🇪" name="UAE Dirham"    pair="AED / EGP" rate={aed} unit="EGP per 1 AED" isLive />
          <CurrencyRow flag="🇰🇼" name="Kuwaiti Dinar" pair="KWD / EGP" rate={kwd} unit="EGP per 1 KWD" isLast isLive />
        </TableCard>
        <Text style={tab.note}>SAR, AED, KWD rates are derived from the live USD/EGP rate.</Text>
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MarketsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: prices, isLoading: lP, refetch: rP } = useMarketPrices();
  const [activeTab, setActiveTab] = useState<TabKey>('metals');

  const isLoading = lP;

  // Track previous gold price to detect changes after a manual refresh
  const prevGoldUsd  = useRef<number | undefined>(undefined);
  const followUpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didManualRefresh = useRef(false);

  // When prices update, if this came from a manual refresh and gold changed → re-fetch once after 1 s
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
      case 'stocks':
        return <ComingSoon icon="trending-up" title="Global Stocks"    description="Live prices for international equities — S&P 500, NASDAQ, and more." />;
      case 'global':
        return <ComingSoon icon="globe"       title="Global Indices"   description="Track major market indices from around the world in one place." />;
      case 'real_estate':
        return <ComingSoon icon="home"        title="Real Estate"      description="Egyptian real estate price indices and market trends by city." />;
      case 'crypto':
        return <ComingSoon icon="cpu"         title="Crypto Markets"   description="Bitcoin, Ethereum, and top cryptocurrencies priced in EGP." />;
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
          <Text style={[s.title, { color: colors.text }]}>Markets</Text>
        </View>
        <LiveDot />
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {renderContent()}

      {prices?.lastUpdated && (activeTab === 'metals' || activeTab === 'currencies' || activeTab === 'egx') && (
        <View style={s.tsRow}>
          <Feather name="clock" size={11} color={colors.mutedForeground} />
          <Text style={[s.ts, { color: colors.mutedForeground }]}>
            Updated{' '}
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
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.5, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  tsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  ts: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
