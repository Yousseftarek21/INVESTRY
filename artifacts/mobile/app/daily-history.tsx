import React from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useDailyChanges, DailyChange } from '@/hooks/useDailyChanges';
import { BetaChip } from '@/components/BetaChip';

// Egypt's weekend (Africa/Cairo Sun-Thu banking week — see api-server's
// cairoDate.ts) — gold/EGX prices don't move on these days, so a flat
// reading here is a market being closed, not zero real performance.
// Read directly off the date key (noon UTC, matching how dateLabel below
// is formatted) since the key already IS the trading day, no further
// timezone conversion needed.
function isCairoWeekend(dateKey: string): boolean {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  return day === 5 || day === 6; // Friday, Saturday
}

function Row({ item, locale, t }: { item: DailyChange; locale: string; t: ReturnType<typeof useT> }) {
  const colors = useColors();
  const isFlat = Math.abs(item.pctReturn) < 0.005;
  const isGain = item.pctReturn > 0;
  // Flat is neutral, never green — a 0% reading isn't a gain. Weekend +
  // flat together means the market was simply closed that day.
  const pctColor = isFlat ? colors.mutedForeground : (isGain ? colors.green : colors.red);
  const showHoliday = isFlat && isCairoWeekend(item.date);
  const dateLabel = new Date(`${item.date}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.rowDate, { color: colors.text }]} numberOfLines={1}>{dateLabel}</Text>
      <Text style={[styles.rowPct, { color: pctColor }]} numberOfLines={1}>
        {showHoliday ? t.holidayLabel : `${isGain ? '+' : ''}${item.pctReturn.toFixed(2)}%`}
      </Text>
    </View>
  );
}

export default function DailyHistoryScreen() {
  const colors = useColors();
  const t = useT();
  const { language } = useAppSettings();
  const locale = language === 'ar' ? 'ar-EG' : 'en-EG';
  const insets = useSafeAreaInsets();
  const { dailyChanges, isLoading, refresh } = useDailyChanges();

  // Most recent first — the hook returns oldest-first (sorted by date asc).
  const sorted = [...dailyChanges].reverse();

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Feather name={backChevron()} size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t.dailyHistoryLabel}</Text>
          <BetaChip label={t.dailyHistoryBetaChip} />
        </View>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={sorted}
        keyExtractor={item => item.date}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 40 }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refresh()} tintColor={colors.primary} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={[styles.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
                <Feather name="calendar" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noDailyHistoryTitle}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{t.noDailyHistoryHint}</Text>
            </View>
          )
        }
        renderItem={({ item }) => <Row item={item} locale={locale} t={t} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 20, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14,
  },
  rowDate: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  rowPct: { fontSize: 15, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  emptyWrap: {
    borderRadius: 24, padding: 40, borderWidth: 1,
    alignItems: 'center', gap: 10, marginTop: 20,
  },
  emptyIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
});
