import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { EGX_SECTORS, EGXSector, getSectorCounts, searchCompanies } from '@/data/egx-companies';
import { useEGXMarket, EGXStockLive, fmtMarketCap, fmtVolume } from '@/hooks/useEGXMarket';
import { getEGXMarketStatus } from '@/data/egx-companies';

// ─── Timezone helpers ─────────────────────────────────────────────────────────
// Egypt is always UTC+2 (no DST since 2011).
// US Eastern uses EDT (UTC-4) from 2nd Sunday of March to 1st Sunday of November,
// and EST (UTC-5) otherwise. Cairo is UTC+2, so offset from ET = +6 (EDT) or +7 (EST).

function isUSOnEDT(d: Date = new Date()): boolean {
  const y = d.getFullYear();
  const mar1 = new Date(y, 2, 1);
  const edtStart = new Date(y, 2, 8 + (7 - mar1.getDay()) % 7);
  const nov1 = new Date(y, 10, 1);
  const edtEnd = new Date(y, 10, (7 - nov1.getDay()) % 7 + 1);
  return d >= edtStart && d < edtEnd;
}

// Returns EGX session hours converted to US ET string (e.g. "04:00–08:30 EDT")
function egxHoursInET(): string {
  const edt = isUSOnEDT();
  return edt ? '04:00–08:30 EDT' : '03:00–07:30 EST';
}

// ─── Market Status Banner ─────────────────────────────────────────────────────

function MarketStatusBanner() {
  const colors = useColors();
  const t = useT();
  const { session, label, nextEvent } = getEGXMarketStatus();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (session !== 'open') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [session]);

  const accent =
    session === 'open'   ? colors.green :
    session === 'pre'    ? '#F59E0B'    :
    session === 'post'   ? '#F97316'    :
    '#EF4444';

  return (
    <View style={[mst.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={mst.left}>
        <Animated.View style={[mst.dot, { backgroundColor: accent, opacity: session === 'open' ? pulseAnim : 1 }]} />
        <View>
          <Text style={[mst.label, { color: accent }]}>EGX {label}</Text>
          <Text style={[mst.sub, { color: colors.mutedForeground }]}>{nextEvent}</Text>
        </View>
      </View>
      <View style={mst.right}>
        <Text style={[mst.flag, { color: colors.mutedForeground }]}>🇪🇬 {t.egyptianExchange}</Text>
        <Text style={[mst.schedule, { color: colors.mutedForeground }]}>{t.egxSchedule}</Text>
        <Text style={[mst.scheduleET, { color: colors.mutedForeground }]}>{egxHoursInET()}</Text>
      </View>
    </View>
  );
}
const mst = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  label: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 1 },
  right: { alignItems: 'flex-end', gap: 1 },
  flag: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  schedule: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  scheduleET: { fontSize: 9, fontFamily: 'Inter_400Regular', opacity: 0.6 },
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
        placeholder={t.egxSearchPlaceholder}
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

// ─── Sector Pill ──────────────────────────────────────────────────────────────

function SectorPills({
  active, onChange, counts,
}: {
  active: EGXSector; onChange: (s: EGXSector) => void; counts: Record<string, number>;
}) {
  const colors = useColors();
  const activeSectors = EGX_SECTORS.filter(s => s === 'All' || (counts[s] ?? 0) > 0);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={sp.row}
      style={sp.scroll}
    >
      {activeSectors.map(sector => {
        const isActive = sector === active;
        const count = counts[sector] ?? 0;
        return (
          <Pressable
            key={sector}
            onPress={() => onChange(sector)}
            style={[
              sp.pill,
              {
                backgroundColor: isActive ? colors.primary : colors.muted,
                borderColor: isActive ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text style={[sp.label, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
              {sector}
            </Text>
            <View style={[sp.badge, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : colors.border }]}>
              <Text style={[sp.badgeTxt, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
                {count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const sp = StyleSheet.create({
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

// ─── 52-Week Range Bar ────────────────────────────────────────────────────────

function RangeBar({ price, low, high }: { price: number; low: number; high: number }) {
  const colors = useColors();
  const range = high - low;
  const pct = range > 0 ? Math.max(0, Math.min(1, (price - low) / range)) : 0.5;
  return (
    <View style={rb.wrap}>
      <Text style={[rb.label, { color: colors.mutedForeground }]}>
        {low.toFixed(0)}
      </Text>
      <View style={[rb.track, { backgroundColor: colors.border }]}>
        <View style={[rb.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: colors.primary + '60' }]} />
        <View style={[rb.thumb, { left: `${Math.round(pct * 100)}%`, backgroundColor: colors.primary }]} />
      </View>
      <Text style={[rb.label, { color: colors.mutedForeground }]}>
        {high.toFixed(0)}
      </Text>
    </View>
  );
}
const rb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  label: { fontSize: 9, fontFamily: 'Inter_400Regular', width: 28 },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'visible', position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, height: 4, borderRadius: 2 },
  thumb: { position: 'absolute', top: -3, width: 10, height: 10, borderRadius: 5, marginLeft: -5 },
});

// ─── Stock Card ───────────────────────────────────────────────────────────────

function StockCard({ stock, isLast }: { stock: EGXStockLive; isLast: boolean }) {
  const colors = useColors();
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const isPos = stock.changePercent >= 0;
  const changeColor = stock.change === 0 && !stock.isLive ? colors.mutedForeground
    : isPos ? colors.green : colors.red;

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
      {/* Main row */}
      <View style={sc.main}>
        {/* Avatar */}
        <View style={[sc.avatar, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '28' }]}>
          <Text style={[sc.avatarTxt, { color: colors.primary }]}>{initials}</Text>
        </View>

        {/* Info */}
        <View style={sc.info}>
          <View style={sc.topRow}>
            <Text style={[sc.ticker, { color: colors.text }]}>{stock.ticker}</Text>
            {!stock.isLive && (
              <View style={[sc.staticBadge, { backgroundColor: colors.muted }]}>
                <Text style={[sc.staticTxt, { color: colors.mutedForeground }]}>{t.estimatedLabel.toLowerCase().slice(0, 4)}.</Text>
              </View>
            )}
          </View>
          <Text style={[sc.name, { color: colors.mutedForeground }]} numberOfLines={1}>
            {stock.nameEn}
          </Text>
          <Text style={[sc.nameAr, { color: colors.mutedForeground }]} numberOfLines={1}>
            {stock.nameAr}
          </Text>
        </View>

        {/* Price */}
        <View style={sc.priceCol}>
          <Text style={[sc.price, { color: colors.text }]}>
            {stock.price.toFixed(2)}
          </Text>
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

      {/* Meta row */}
      <View style={sc.meta}>
        <View style={[sc.sectorTag, { backgroundColor: colors.muted }]}>
          <Text style={[sc.sectorTxt, { color: colors.mutedForeground }]}>{stock.sector}</Text>
        </View>
        <View style={sc.metaRight}>
          {stock.volume != null && (
            <Text style={[sc.metaVal, { color: colors.mutedForeground }]}>
              {t.volLabel} {fmtVolume(stock.volume)}
            </Text>
          )}
          {stock.marketCap != null && (
            <Text style={[sc.metaVal, { color: colors.mutedForeground }]}>
              {t.capLabel} {fmtMarketCap(stock.marketCap)}
            </Text>
          )}
        </View>
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={[sc.detail, { borderTopColor: colors.border }]}>
          {/* 52-week range */}
          {stock.high52w != null && stock.low52w != null && (
            <View style={sc.detailRow}>
              <Text style={[sc.detailLabel, { color: colors.mutedForeground }]}>{t.weekRange52}</Text>
              <View style={{ flex: 1 }}>
                <RangeBar price={stock.price} low={stock.low52w} high={stock.high52w} />
              </View>
            </View>
          )}
          {/* P/E and Dividend */}
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
            <View style={sc.detailItem}>
              <Text style={[sc.detailLabel, { color: colors.mutedForeground }]}>{t.industryLabel}</Text>
              <Text style={[sc.detailValue, { color: colors.text }]} numberOfLines={1}>
                {stock.industry}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Expand indicator */}
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
  nameAr: { fontSize: 11, fontFamily: 'Inter_400Regular' },
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
  sectorTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  sectorTxt: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  metaRight: { flexDirection: 'row', gap: 10 },
  metaVal: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  detail: { padding: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailItem: { flex: 1, gap: 2 },
  detailLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.5 },
  detailValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  expandRow: { alignItems: 'center', paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth },
});

// ─── Sector Group ─────────────────────────────────────────────────────────────

function SectorGroup({ sector, stocks }: { sector: string; stocks: EGXStockLive[] }) {
  const colors = useColors();
  const t = useT();
  return (
    <View style={sg.wrap}>
      <View style={sg.header}>
        <Text style={[sg.title, { color: colors.mutedForeground }]}>
          {sector.toUpperCase()}
        </Text>
        <Text style={[sg.count, { color: colors.mutedForeground }]}>
          {stocks.length} {stocks.length === 1 ? t.companyLabel : t.companiesLabel}
        </Text>
      </View>
      {stocks.map((s, i) => (
        <StockCard key={s.ticker} stock={s} isLast={i === stocks.length - 1} />
      ))}
    </View>
  );
}
const sg = StyleSheet.create({
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
  card: { height: 90, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
});

// ─── Main EGXMarket Component ─────────────────────────────────────────────────

export function EGXMarket() {
  const colors = useColors();
  const t = useT();
  const { data: allStocks = [], isLoading, refetch } = useEGXMarket();
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState<EGXSector>('All');
  const counts = useMemo(() => getSectorCounts(), []);

  // When user types, reset sector filter to 'All'
  const handleQuery = useCallback((t: string) => {
    setQuery(t);
    if (t.length > 0) setSector('All');
  }, []);

  // When user picks sector, clear search
  const handleSector = useCallback((s: EGXSector) => {
    setSector(s);
    setQuery('');
  }, []);

  const displayed = useMemo(() => {
    if (query.trim()) {
      const matched = searchCompanies(query).map(c => c.ticker);
      return allStocks.filter(s => matched.includes(s.ticker));
    }
    if (sector !== 'All') return allStocks.filter(s => s.sector === sector);
    return allStocks;
  }, [allStocks, query, sector]);

  // Group by sector for "All" view, flat for filtered view
  const grouped = useMemo(() => {
    if (query.trim() || sector !== 'All') return null;
    const map = new Map<string, EGXStockLive[]>();
    for (const s of displayed) {
      if (!map.has(s.sector)) map.set(s.sector, []);
      map.get(s.sector)!.push(s);
    }
    return map;
  }, [displayed, query, sector]);

  const hasLive = allStocks.some(s => s.isLive);

  return (
    <View style={em.wrap}>
      {/* Market status */}
      <MarketStatusBanner />

      {/* Search */}
      <SearchBar value={query} onChange={handleQuery} />

      {/* Sector pills */}
      <SectorPills active={sector} onChange={handleSector} counts={counts} />

      {/* Result count / live badge */}
      <View style={em.resultRow}>
        <Text style={[em.resultTxt, { color: colors.mutedForeground }]}>
          {displayed.length} {displayed.length === 1 ? t.companyLabel : t.companiesLabel}
          {query ? ` ${t.matchingLabel} "${query}"` : sector !== 'All' ? ` ${t.inLabel} ${sector}` : ` ${t.listedLabel}`}
        </Text>
        {hasLive ? (
          <View style={[em.livePill, { backgroundColor: colors.green + '18' }]}>
            <View style={[em.liveDot, { backgroundColor: colors.green }]} />
            <Text style={[em.liveTxt, { color: colors.green }]}>{t.liveLabel}</Text>
          </View>
        ) : (
          <View style={[em.livePill, { backgroundColor: colors.muted }]}>
            <Text style={[em.liveTxt, { color: colors.mutedForeground }]}>{t.estimatedLabel}</Text>
          </View>
        )}
      </View>

      {/* List */}
      {isLoading && allStocks.every(s => !s.isLive) ? (
        <LoadingSkeleton />
      ) : grouped ? (
        // Grouped by sector
        <View style={{ gap: 20 }}>
          {Array.from(grouped.entries()).map(([sec, stocks]) => (
            <SectorGroup key={sec} sector={sec} stocks={stocks} />
          ))}
        </View>
      ) : (
        // Flat list (search or single sector)
        <View style={{ gap: 0 }}>
          {displayed.map((s, i) => (
            <StockCard key={s.ticker} stock={s} isLast={i === displayed.length - 1} />
          ))}
          {displayed.length === 0 && (
            <View style={[em.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={28} color={colors.mutedForeground} />
              <Text style={[em.emptyTxt, { color: colors.mutedForeground }]}>
                {t.noCompaniesFound} "{query}"
              </Text>
              <Text style={[em.emptySub, { color: colors.mutedForeground }]}>
                {t.egxSearchTip}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Web note */}
      {!hasLive && (
        <Text style={[em.webNote, { color: colors.mutedForeground }]}>
          {t.liveRequiresExpo}{'\n'}
          {t.webPreviewNote}
        </Text>
      )}
    </View>
  );
}

const em = StyleSheet.create({
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
