import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  GLOBAL_CATEGORIES, GlobalCategory, getCategoryCounts, searchGlobalCompanies, GLOBAL_COMPANIES,
  getUSMarketStatus,
} from '@/data/global-stocks';
import { useGlobalStocks, GlobalStockLive } from '@/hooks/useGlobalStocks';

// ─── Search Bar ───────────────────────────────────────────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const colors = useColors();
  return (
    <View style={[sb.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="search" size={16} color={colors.mutedForeground} />
      <TextInput
        style={[sb.input, { color: colors.text }]}
        placeholder="Search ticker or company…"
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChange}
        autoCapitalize="characters"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={8}>
          <Feather name="x-circle" size={16} color={colors.mutedForeground} />
        </Pressable>
      )}
    </View>
  );
}
const sb = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 14, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', padding: 0 },
});

// ─── Category Pills ───────────────────────────────────────────────────────────

function CategoryPills({
  active, onChange, counts,
}: {
  active: GlobalCategory; onChange: (c: GlobalCategory) => void; counts: Record<string, number>;
}) {
  const colors = useColors();
  const activeCats = GLOBAL_CATEGORIES.filter(c => c === 'All' || (counts[c] ?? 0) > 0);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={cp.row}
      style={cp.scroll}
    >
      {activeCats.map(cat => {
        const isActive = cat === active;
        const count = cat === 'All' ? GLOBAL_COMPANIES.length : (counts[cat] ?? 0);
        return (
          <Pressable
            key={cat}
            onPress={() => onChange(cat)}
            style={[
              cp.pill,
              {
                backgroundColor: isActive ? colors.primary : colors.muted,
                borderColor: isActive ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text style={[cp.label, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
              {cat}
            </Text>
            <View style={[cp.badge, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : colors.border }]}>
              <Text style={[cp.badgeTxt, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
                {count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const cp = StyleSheet.create({
  scroll: { marginHorizontal: -20 },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingLeft: 13, paddingRight: 8, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  badge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { fontSize: 10, fontFamily: 'Inter_700Bold' },
});

// ─── Stock Card ───────────────────────────────────────────────────────────────

function StockCard({ stock, isLast }: { stock: GlobalStockLive; isLast: boolean }) {
  const colors = useColors();
  const isPos = stock.changePercent >= 0;
  const changeColor = stock.change === 0 && !stock.isLive ? colors.mutedForeground
    : isPos ? colors.green : colors.red;

  const initials = stock.ticker.length <= 4 ? stock.ticker : stock.ticker.slice(0, 4);

  return (
    <View
      style={[
        sc.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        isLast && sc.cardLast,
      ]}
    >
      <View style={sc.main}>
        <View style={[sc.avatar, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '28' }]}>
          <Text style={[sc.avatarTxt, { color: colors.primary }]}>{initials}</Text>
        </View>

        <View style={sc.info}>
          <View style={sc.topRow}>
            <Text style={[sc.ticker, { color: colors.text }]}>{stock.ticker}</Text>
            {!stock.isLive && (
              <View style={[sc.staticBadge, { backgroundColor: colors.muted }]}>
                <Text style={[sc.staticTxt, { color: colors.mutedForeground }]}>est.</Text>
              </View>
            )}
          </View>
          <Text style={[sc.name, { color: colors.mutedForeground }]} numberOfLines={1}>
            {stock.name}
          </Text>
        </View>

        <View style={sc.priceCol}>
          <Text style={[sc.price, { color: colors.text }]}>
            ${stock.price.toFixed(2)}
          </Text>
          <View style={[sc.changeBadge, { backgroundColor: changeColor + '15' }]}>
            <View style={[sc.changeDot, { backgroundColor: changeColor }]} />
            <Text style={[sc.changeTxt, { color: changeColor }]}>
              {isPos ? '+' : ''}{stock.changePercent.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      <View style={sc.meta}>
        <View style={[sc.catTag, { backgroundColor: colors.muted }]}>
          <Text style={[sc.catTxt, { color: colors.mutedForeground }]}>{stock.category}</Text>
        </View>
        {stock.change !== 0 && (
          <Text style={[sc.changeAbs, { color: changeColor }]}>
            {isPos ? '+' : ''}{stock.change.toFixed(2)}
          </Text>
        )}
      </View>
    </View>
  );
}
const sc = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 8, overflow: 'hidden' },
  cardLast: { marginBottom: 0 },
  main: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 13, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  info: { flex: 1, gap: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ticker: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  staticBadge: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  staticTxt: { fontSize: 9, fontFamily: 'Inter_500Medium' },
  name: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  priceCol: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  price: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  changeDot: { width: 6, height: 6, borderRadius: 3 },
  changeTxt: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  changeAbs: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  meta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12, gap: 8,
  },
  catTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catTxt: { fontSize: 10, fontFamily: 'Inter_500Medium' },
});

// ─── Category Group ───────────────────────────────────────────────────────────

function CategoryGroup({ category, stocks }: { category: string; stocks: GlobalStockLive[] }) {
  const colors = useColors();
  return (
    <View style={cg.wrap}>
      <View style={cg.header}>
        <Text style={[cg.title, { color: colors.mutedForeground }]}>
          {category.toUpperCase()}
        </Text>
        <Text style={[cg.count, { color: colors.mutedForeground }]}>
          {stocks.length} {stocks.length === 1 ? 'ticker' : 'tickers'}
        </Text>
      </View>
      {stocks.map((s, i) => (
        <StockCard key={s.ticker} stock={s} isLast={i === stocks.length - 1} />
      ))}
    </View>
  );
}
const cg = StyleSheet.create({
  wrap: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  title: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.3 },
  count: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.9, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <>
      {[1, 2, 3, 4, 5].map(i => (
        <Animated.View
          key={i}
          style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: anim }]}
        />
      ))}
    </>
  );
}
const sk = StyleSheet.create({
  card: { height: 78, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
});

// ─── US Market Status Banner ──────────────────────────────────────────────────

function USMarketStatusBanner() {
  const colors = useColors();
  const { session, label, nextEvent } = getUSMarketStatus();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (session !== 'open') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [session]);

  const accent =
    session === 'open'  ? colors.green :
    session === 'pre'   ? '#F59E0B'    :
    session === 'post'  ? '#F97316'    :
    '#EF4444';

  return (
    <View style={[umb.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={umb.left}>
        <Animated.View style={[umb.dot, { backgroundColor: accent, opacity: session === 'open' ? pulseAnim : 1 }]} />
        <View style={umb.textWrap}>
          <Text style={[umb.label, { color: accent }]}>US {label}</Text>
          <Text style={[umb.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{nextEvent}</Text>
        </View>
      </View>
      <View style={umb.right}>
        <Text style={[umb.flag, { color: colors.mutedForeground }]}>🇺🇸 NYSE · NASDAQ</Text>
        <Text style={[umb.schedule, { color: colors.mutedForeground }]}>Mon–Fri · 9:30–16:00</Text>
      </View>
    </View>
  );
}
const umb = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1,
    gap: 8,
  },
  left:     { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  textWrap: { flex: 1, minWidth: 0 },
  dot:      { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  label:    { fontSize: 12, fontFamily: 'Inter_700Bold' },
  sub:      { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 1 },
  right:    { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  flag:     { fontSize: 10, fontFamily: 'Inter_500Medium' },
  schedule: { fontSize: 9, fontFamily: 'Inter_400Regular' },
});

// ─── Main GlobalStocksMarket Component ────────────────────────────────────────

export function GlobalStocksMarket() {
  const colors = useColors();
  const { data: allStocks = [], isLoading } = useGlobalStocks();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<GlobalCategory>('All');
  const counts = useMemo(() => getCategoryCounts(), []);

  const handleQuery = useCallback((t: string) => {
    setQuery(t);
    if (t.length > 0) setCategory('All');
  }, []);

  const handleCategory = useCallback((c: GlobalCategory) => {
    setCategory(c);
    setQuery('');
  }, []);

  const displayed = useMemo(() => {
    if (query.trim()) {
      const matched = searchGlobalCompanies(GLOBAL_COMPANIES, query).map(c => c.ticker);
      return allStocks.filter(s => matched.includes(s.ticker));
    }
    if (category !== 'All') return allStocks.filter(s => s.category === category);
    return allStocks;
  }, [allStocks, query, category]);

  const grouped = useMemo(() => {
    if (query.trim() || category !== 'All') return null;
    const map = new Map<string, GlobalStockLive[]>();
    for (const s of displayed) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return map;
  }, [displayed, query, category]);

  const hasLive = allStocks.some(s => s.isLive);

  return (
    <View style={gm.wrap}>
      <USMarketStatusBanner />

      <SearchBar value={query} onChange={handleQuery} />

      <CategoryPills active={category} onChange={handleCategory} counts={counts} />

      <View style={gm.resultRow}>
        <Text style={[gm.resultTxt, { color: colors.mutedForeground }]}>
          {displayed.length} {displayed.length === 1 ? 'ticker' : 'tickers'}
          {query ? ` matching "${query}"` : category !== 'All' ? ` in ${category}` : ' tracked'}
        </Text>
        {hasLive ? (
          <View style={[gm.livePill, { backgroundColor: colors.green + '18' }]}>
            <View style={[gm.liveDot, { backgroundColor: colors.green }]} />
            <Text style={[gm.liveTxt, { color: colors.green }]}>LIVE</Text>
          </View>
        ) : (
          <View style={[gm.livePill, { backgroundColor: colors.muted }]}>
            <Text style={[gm.liveTxt, { color: colors.mutedForeground }]}>ESTIMATED</Text>
          </View>
        )}
      </View>

      {isLoading && allStocks.every(s => !s.isLive) ? (
        <LoadingSkeleton />
      ) : grouped ? (
        <View style={{ gap: 20 }}>
          {Array.from(grouped.entries()).map(([cat, stocks]) => (
            <CategoryGroup key={cat} category={cat} stocks={stocks} />
          ))}
        </View>
      ) : (
        <View style={{ gap: 0 }}>
          {displayed.map((s, i) => (
            <StockCard key={s.ticker} stock={s} isLast={i === displayed.length - 1} />
          ))}
          {displayed.length === 0 && (
            <View style={[gm.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={28} color={colors.mutedForeground} />
              <Text style={[gm.emptyTxt, { color: colors.mutedForeground }]}>
                No tickers found for "{query}"
              </Text>
              <Text style={[gm.emptySub, { color: colors.mutedForeground }]}>
                Try the ticker (e.g. AAPL) or company name
              </Text>
            </View>
          )}
        </View>
      )}

      {!hasLive && (
        <Text style={[gm.webNote, { color: colors.mutedForeground }]}>
          Live prices require the Expo Go app on iOS or Android.{'\n'}
          Web preview shows estimated prices only.
        </Text>
      )}
    </View>
  );
}

const gm = StyleSheet.create({
  wrap: { gap: 14 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultTxt: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  empty: { borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 32, alignItems: 'center', gap: 10 },
  emptyTxt: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptySub: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },
  webNote: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 17, paddingTop: 4 },
});
