import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Animated, FlatList, ListRenderItem, Platform, Pressable,
  RefreshControl, ScrollView, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useCounterDisplay } from '@/hooks/useCounterDisplay';
import { useT } from '@/hooks/useTranslation';
import {
  GLOBAL_CATEGORIES, GlobalCategory, getCategoryCounts, searchGlobalCompanies, GLOBAL_COMPANIES,
  getUSMarketStatus,
} from '@/data/global-stocks';
import { useGlobalStocks, GlobalStockLive } from '@/hooks/useGlobalStocks';
import { useUSIndices, USIndexLive } from '@/hooks/useUSIndices';
import { fmtMarketCap, fmtVolume } from '@/hooks/useEGXMarket';
import { RangeBar } from '@/components/RangeBar';
import { MarketStatusCard } from '@/components/MarketStatusCard';

// Rebuilt to match EGXMarket.tsx's structure and polish exactly: one
// virtualized FlatList (not a ScrollView + .map, which never recycles rows),
// a real index card at the top instead of a separate tab, the same
// search/category-pill/result-row header, and the same expandable stock
// card. All data still comes from TradingView (see markets.ts server-side —
// fetchGlobalStocks / fetchUSIndices), matching EGX's own single-source
// policy: no other provider silently standing in.

// ─── Timezone helpers ─────────────────────────────────────────────────────────
// Egypt is always UTC+2. US Eastern is EDT (UTC-4) Mar 2nd-Sun → Nov 1st-Sun, else EST (UTC-5).
// Cairo is +6h ahead of EDT, +7h ahead of EST.

function isUSOnEDT(d: Date = new Date()): boolean {
  const y = d.getFullYear();
  const mar1 = new Date(y, 2, 1);
  const edtStart = new Date(y, 2, 8 + (7 - mar1.getDay()) % 7);
  const nov1 = new Date(y, 10, 1);
  const edtEnd = new Date(y, 10, (7 - nov1.getDay()) % 7 + 1);
  return d >= edtStart && d < edtEnd;
}

// Returns NYSE/NASDAQ session hours in Cairo time (e.g. "15:30–22:00 Cairo")
function nyseHoursInCairo(): string {
  const edt = isUSOnEDT();
  return edt ? '15:30–22:00 Cairo' : '16:30–23:00 Cairo';
}

function etLabel(): string {
  return isUSOnEDT() ? 'EDT' : 'EST';
}

// ─── US Market Status Banner ──────────────────────────────────────────────────

// Exported so nothing else needs its own copy of the session-hours logic.
export function USMarketStatusBanner() {
  const { session, label, nextEvent } = getUSMarketStatus();
  return (
    <MarketStatusCard
      session={session}
      statusLabel={`US ${label}`}
      nextEvent={nextEvent}
      flag="🇺🇸"
      exchangeTag="NYSE · NASDAQ"
      hoursLine={`Mon–Fri · 9:30–16:00 ${etLabel()} · ${nyseHoursInCairo()}`}
    />
  );
}

// ─── Index card (S&P 500 / Dow Jones / Nasdaq) ─────────────────────────────────
// Same construction as EGXMarket's EGXIndexChips — one combined card, real
// index values side by side split by dividers — just 3 columns instead of 2,
// since the US has 3 headline indices where EGX has 2.

const indexPriceFormatter = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function indexDesc(t: ReturnType<typeof useT>, symbol: string): string {
  switch (symbol) {
    case 'SPX':  return t.usIndexSpxDesc;
    case 'DJI':  return t.usIndexDjiDesc;
    case 'NDX':  return t.usIndexNdxDesc;
    default:     return '';
  }
}

function IndexThird({ index, isLast }: { index: USIndexLive; isLast: boolean }) {
  const colors = useColors();
  const t = useT();
  const isFlat = Math.abs(index.changePercent) < 0.005;
  const isPos = index.changePercent >= 0;
  const color = index.change === 0 && !index.isLive ? colors.mutedForeground
    : isFlat ? colors.mutedForeground : (isPos ? colors.green : colors.red);
  const { text: priceStr } = useCounterDisplay(index.price, indexPriceFormatter, false);
  return (
    <>
      <View style={ixc.third}>
        <Text style={[ixc.name, { color: colors.mutedForeground }]} numberOfLines={1}>{index.short}</Text>
        <Animated.Text style={[ixc.price, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {priceStr}
        </Animated.Text>
        <View style={[ixc.badge, { backgroundColor: color + '18' }]}>
          <Feather name={isFlat ? 'minus' : isPos ? 'arrow-up-right' : 'arrow-down-right'} size={9} color={color} />
          <Text style={[ixc.badgeTxt, { color }]}>
            {!isFlat && isPos ? '+' : ''}{index.changePercent.toFixed(2)}%
          </Text>
        </View>
        <Text style={[ixc.desc, { color: colors.mutedForeground }]} numberOfLines={1}>{indexDesc(t, index.symbol)}</Text>
      </View>
      {!isLast && <View style={[ixc.divider, { backgroundColor: colors.border }]} />}
    </>
  );
}

function USIndexChips() {
  const colors = useColors();
  const t = useT();
  const { data: indices = [] } = useUSIndices();
  const hasLive = indices.some(i => i.isLive);
  if (indices.length < 3) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={ixc.headerRow}>
        <Text style={[ixc.headerTitle, { color: colors.text }]}>{t.globalIndicesTitle}</Text>
        {hasLive ? (
          <View style={[ixc.livePill, { backgroundColor: colors.green + '18' }]}>
            <View style={[ixc.liveDot, { backgroundColor: colors.green }]} />
            <Text style={[ixc.liveTxt, { color: colors.green }]}>{t.liveLabel}</Text>
          </View>
        ) : (
          <View style={[ixc.livePill, { backgroundColor: colors.muted }]}>
            <Text style={[ixc.liveTxt, { color: colors.mutedForeground }]}>{t.estimatedLabel}</Text>
          </View>
        )}
      </View>
      <View style={[ixc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {indices.map((idx, i) => (
          <IndexThird key={idx.symbol} index={idx} isLast={i === indices.length - 1} />
        ))}
      </View>
    </View>
  );
}
const ixc = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 13.5, fontFamily: 'Inter_700Bold' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  card: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, paddingVertical: 12 },
  third: { flex: 1, paddingHorizontal: 8, gap: 4, alignItems: 'center' },
  divider: { width: StyleSheet.hairlineWidth },
  name: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  price: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: -0.3, textAlign: 'center' },
  badge: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7 },
  badgeTxt: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  desc: { fontSize: 8.5, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 1 },
});

// ─── Search Bar ───────────────────────────────────────────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const colors = useColors();
  const t = useT();
  return (
    <View style={[sb.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="search" size={16} color={colors.mutedForeground} />
      <TextInput
        style={[sb.input, { color: colors.text }]}
        placeholder={t.globalSearchPlaceholder}
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

const stockPriceFormatter = (n: number) => n.toFixed(2);

function StockCard({ stock, isLast }: { stock: GlobalStockLive; isLast: boolean }) {
  const colors = useColors();
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const isPos = stock.changePercent >= 0;
  const changeColor = stock.change === 0 && !stock.isLive ? colors.mutedForeground
    : isPos ? colors.green : colors.red;
  const { text: priceStr } = useCounterDisplay(stock.price, stockPriceFormatter, false);

  const initials = stock.ticker.length <= 4 ? stock.ticker : stock.ticker.slice(0, 4);

  return (
    <Pressable
      onPress={() => setExpanded(e => !e)}
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
                <Text style={[sc.staticTxt, { color: colors.mutedForeground }]}>{t.estAbbrevLabel}</Text>
              </View>
            )}
          </View>
          <Text style={[sc.name, { color: colors.mutedForeground }]} numberOfLines={1}>
            {stock.name}
          </Text>
        </View>

        <View style={sc.priceCol}>
          <Animated.Text style={[sc.price, { color: colors.text }]}>
            ${priceStr}
          </Animated.Text>
          <View style={[sc.changeBadge, { backgroundColor: changeColor + '15' }]}>
            <Text style={[sc.changeArrow, { color: changeColor }]}>{isPos ? '▲' : '▼'}</Text>
            <Text style={[sc.changeTxt, { color: changeColor }]}>
              {isPos ? '+' : ''}{stock.changePercent.toFixed(2)}%
            </Text>
          </View>
          {stock.change !== 0 && (
            <Text style={[sc.changeAbs, { color: changeColor }]}>
              {isPos ? '+' : ''}{stock.change.toFixed(2)}
            </Text>
          )}
        </View>
      </View>

      <View style={sc.meta}>
        <View style={[sc.catTag, { backgroundColor: colors.muted }]}>
          <Text style={[sc.catTxt, { color: colors.mutedForeground }]}>{stock.category}</Text>
        </View>
        <View style={sc.metaRight}>
          {stock.volume != null && (
            <Text style={[sc.metaVal, { color: colors.mutedForeground }]}>
              {t.volLabel} {fmtVolume(stock.volume)}
            </Text>
          )}
          {stock.marketCap != null && (
            <Text style={[sc.metaVal, { color: colors.mutedForeground }]}>
              {t.capLabel} {fmtMarketCap(stock.marketCap, 'USD')}
            </Text>
          )}
        </View>
      </View>

      {expanded && (
        <View style={[sc.detail, { borderTopColor: colors.border }]}>
          {stock.high52w != null && stock.low52w != null && (
            <View style={sc.detailRow}>
              <Text style={[sc.detailLabel, { color: colors.mutedForeground }]}>{t.weekRange52}</Text>
              <View style={{ flex: 1 }}>
                <RangeBar price={stock.price} low={stock.low52w} high={stock.high52w} />
              </View>
            </View>
          )}
          <View style={sc.detailRow}>
            <View style={sc.detailItem}>
              <Text style={[sc.detailLabel, { color: colors.mutedForeground }]}>{t.peRatio}</Text>
              <Text style={[sc.detailValue, { color: colors.text }]}>
                {stock.pe != null ? stock.pe.toFixed(1) : '—'}
              </Text>
            </View>
            <View style={sc.detailItem}>
              <Text style={[sc.detailLabel, { color: colors.mutedForeground }]}>{t.dividendYield}</Text>
              <Text style={[sc.detailValue, { color: colors.text }]}>
                {stock.dividendYield != null ? `${stock.dividendYield.toFixed(2)}%` : '—'}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={[sc.expandRow, { borderTopColor: colors.border }]}>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={colors.mutedForeground}
        />
      </View>
    </Pressable>
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
  changeArrow: { fontSize: 9, lineHeight: 13 },
  changeTxt: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  changeAbs: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  meta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10, gap: 8,
  },
  catTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catTxt: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  metaRight: { flexDirection: 'row', gap: 10 },
  metaVal: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  detail: { padding: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailItem: { flex: 1, gap: 2 },
  detailLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.5 },
  detailValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  expandRow: { alignItems: 'center', paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth },
});

// ─── Category Group Header ──────────────────────────────────────────────────

function CategoryGroupHeader({ category, count }: { category: string; count: number }) {
  const colors = useColors();
  const t = useT();
  return (
    <View style={cg.header}>
      <Text style={[cg.title, { color: colors.mutedForeground }]}>
        {category.toUpperCase()}
      </Text>
      <Text style={[cg.count, { color: colors.mutedForeground }]}>
        {count} {count === 1 ? t.tickerLabel : t.tickersLabel}
      </Text>
    </View>
  );
}
const cg = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, paddingTop: 12, paddingBottom: 6 },
  title: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.3 },
  count: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.9, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: anim }]}
    />
  );
}
const sk = StyleSheet.create({
  card: { height: 78, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
});

// ─── FlatList item types ────────────────────────────────────────────────────────

type ListItem =
  | { kind: 'skeleton'; id: number }
  | { kind: 'categoryHeader'; category: string; count: number }
  | { kind: 'stock'; stock: GlobalStockLive; isLast: boolean; isCategoryEnd: boolean };

// ─── Main GlobalStocksMarket Component ────────────────────────────────────────

export function GlobalStocksMarket({
  style,
  refreshing,
  onRefresh,
  topHeader,
  topInset,
}: {
  style?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  topHeader?: React.ReactNode;
  topInset?: number;
} = {}) {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  const { data: allStocks = [], isLoading } = useGlobalStocks();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<GlobalCategory>('All');
  const counts = useMemo(() => getCategoryCounts(), []);

  const handleQuery = useCallback((q: string) => {
    setQuery(q);
    if (q.length > 0) setCategory('All');
  }, []);

  const handleCategory = useCallback((c: GlobalCategory) => {
    setCategory(c);
    setQuery('');
  }, []);

  const displayed = useMemo(() => {
    if (query.trim()) {
      const matchedSet = new Set(searchGlobalCompanies(GLOBAL_COMPANIES, query).map(c => c.ticker));
      return allStocks.filter(s => matchedSet.has(s.ticker));
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

  const resultSuffix = query
    ? ` ${t.matchingLabel} "${query}"`
    : category !== 'All'
    ? ` ${t.inLabel} ${category}`
    : ` ${t.trackedLabel}`;

  const listData = useMemo((): ListItem[] => {
    if (isLoading && allStocks.every(s => !s.isLive)) {
      return [1, 2, 3, 4, 5, 6].map(id => ({ kind: 'skeleton' as const, id }));
    }
    if (grouped) {
      const items: ListItem[] = [];
      for (const [cat, stocks] of grouped.entries()) {
        items.push({ kind: 'categoryHeader', category: cat, count: stocks.length });
        stocks.forEach((s, i) =>
          items.push({
            kind: 'stock',
            stock: s,
            isLast: i === stocks.length - 1,
            isCategoryEnd: i === stocks.length - 1,
          })
        );
      }
      return items;
    }
    return displayed.map((s, i) => ({
      kind: 'stock' as const,
      stock: s,
      isLast: i === displayed.length - 1,
      isCategoryEnd: false,
    }));
  }, [isLoading, allStocks, grouped, displayed]);

  const keyExtractor = useCallback((item: ListItem): string => {
    if (item.kind === 'skeleton') return `skel-${item.id}`;
    if (item.kind === 'categoryHeader') return `ch-${item.category}`;
    return item.stock.ticker;
  }, []);

  const renderItem: ListRenderItem<ListItem> = useCallback(({ item }) => {
    if (item.kind === 'skeleton') return <SkeletonCard />;
    if (item.kind === 'categoryHeader') return <CategoryGroupHeader category={item.category} count={item.count} />;
    return <StockCard stock={item.stock} isLast={item.isLast} />;
  }, []);

  const ItemSeparator = useCallback(({ leadingItem }: { leadingItem: ListItem }) => {
    if (leadingItem.kind === 'stock' && leadingItem.isCategoryEnd) {
      return <View style={{ height: 12 }} />;
    }
    return null;
  }, []);

  const ListHeader = useMemo(() => (
    <View style={{ gap: 20 }}>
      {topHeader}
      <View style={gm.listHeaderWrap}>
        <USMarketStatusBanner />
        <USIndexChips />
        <SearchBar value={query} onChange={handleQuery} />
        <CategoryPills active={category} onChange={handleCategory} counts={counts} />
        <View style={gm.resultRow}>
          <Text style={[gm.resultTxt, { color: colors.mutedForeground }]}>
            {displayed.length} {displayed.length === 1 ? t.tickerLabel : t.tickersLabel}
            {resultSuffix}
          </Text>
          {hasLive ? (
            <View style={[gm.livePill, { backgroundColor: colors.green + '18' }]}>
              <View style={[gm.liveDot, { backgroundColor: colors.green }]} />
              <Text style={[gm.liveTxt, { color: colors.green }]}>{t.liveLabel}</Text>
            </View>
          ) : (
            <View style={[gm.livePill, { backgroundColor: colors.muted }]}>
              <Text style={[gm.liveTxt, { color: colors.mutedForeground }]}>{t.estimatedLabel}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [topHeader, query, category, counts, displayed.length, hasLive, resultSuffix, colors.mutedForeground, colors.green, colors.muted]);

  const ListEmpty = useMemo(() => (
    !isLoading && displayed.length === 0 ? (
      <View style={[gm.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={28} color={colors.mutedForeground} />
        <Text style={[gm.emptyTxt, { color: colors.mutedForeground }]}>
          {t.noTickersFound} "{query}"
        </Text>
        <Text style={[gm.emptySub, { color: colors.mutedForeground }]}>
          {t.globalSearchTip}
        </Text>
      </View>
    ) : null
  ), [isLoading, displayed.length, query, colors.card, colors.border, colors.mutedForeground, t]);

  const ListFooter = useMemo(() => (
    !hasLive ? (
      <Text style={[gm.webNote, { color: colors.mutedForeground }]}>
        {t.liveRequiresExpo}{'\n'}{t.webPreviewNote}
      </Text>
    ) : null
  ), [hasLive, colors.mutedForeground]);

  return (
    <FlatList
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[gm.listContent, { paddingTop: topHeader ? 0 : 16, paddingBottom: botPad + 120 }]}
      contentInset={topInset ? { top: topInset } : undefined}
      contentOffset={topInset ? { x: 0, y: -topInset } : undefined}
      data={listData}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparator}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
      ListFooterComponent={ListFooter}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={5}
      removeClippedSubviews={true}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    />
  );
}

const gm = StyleSheet.create({
  listHeaderWrap: { gap: 14, paddingBottom: 8 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
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
