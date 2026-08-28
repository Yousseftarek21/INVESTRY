import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type MarketSession = 'open' | 'pre' | 'post' | 'closed';

/**
 * Shared "is this market open right now" card — used by both EGXMarket.tsx
 * and GlobalStocksMarket.tsx (previously two separate, near-identical
 * banners: EGXMarket's own `MarketStatusBanner` and GlobalStocksMarket's
 * `USMarketStatusBanner`, one component each). Replaced here with a single
 * shared implementation so a design pass fixes both at once and the two
 * can't drift again.
 *
 * Previous layout crammed 5 lines of text into a 2-column split (status +
 * next-event on the left, exchange name + local hours + converted hours
 * stacked three deep on the right) — dense and, per feedback, looked bad.
 * This version reads top-to-bottom instead: a colored status row, the next
 * event as the one line meant to actually be read, then a single combined
 * hours line below a divider instead of two separate stacked schedule rows.
 */
export function MarketStatusCard({
  session,
  statusLabel,
  nextEvent,
  flag,
  exchangeTag,
  hoursLine,
}: {
  session: MarketSession;
  /** e.g. "EGX Open", "US Closed" */
  statusLabel: string;
  /** e.g. "Opens Monday 9:30 AM ET" */
  nextEvent: string;
  /** e.g. "🇪🇬" */
  flag: string;
  /** e.g. "EGX", "NYSE · NASDAQ" */
  exchangeTag: string;
  /** Combined local + converted hours in one line, e.g. "Sun–Thu 10:00–14:30 Cairo · 04:00–08:30 EDT" */
  hoursLine: string;
}) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (session !== 'open') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [session]);

  const accent =
    session === 'open'  ? colors.green :
    session === 'pre'   ? '#F59E0B'    :
    session === 'post'  ? '#F97316'    :
    colors.red;

  return (
    <View style={[st.card, { backgroundColor: accent + '0F', borderColor: accent + '2A' }]}>
      <View style={[st.accentBar, { backgroundColor: accent }]} />
      <View style={st.body}>
        <View style={st.topRow}>
          <View style={st.statusGroup}>
            <Animated.View style={[st.dot, { backgroundColor: accent, opacity: session === 'open' ? pulse : 1 }]} />
            <Text style={[st.statusLabel, { color: accent }]} numberOfLines={1}>{statusLabel}</Text>
          </View>
          <View style={st.tag}>
            <Text style={[st.tagTxt, { color: colors.mutedForeground }]} numberOfLines={1}>{flag} {exchangeTag}</Text>
          </View>
        </View>
        <Text style={[st.nextEvent, { color: colors.text }]} numberOfLines={1}>{nextEvent}</Text>
        <View style={[st.divider, { backgroundColor: colors.border }]} />
        <Text style={[st.hours, { color: colors.mutedForeground }]} numberOfLines={1}>{hoursLine}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accentBar: { width: 4 },
  body: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusGroup: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1, minWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  statusLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  tag: { flexShrink: 0 },
  tagTxt: { fontSize: 10.5, fontFamily: 'Inter_500Medium' },
  nextEvent: { fontSize: 12.5, fontFamily: 'Inter_500Medium' },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 2, marginBottom: 1 },
  hours: { fontSize: 10.5, fontFamily: 'Inter_400Regular' },
});
