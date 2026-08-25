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

function Row({ item, locale }: { item: DailyChange; locale: string }) {
  const colors = useColors();
  const isGain = item.pctReturn >= 0;
  const gainColor = isGain ? colors.green : colors.red;
  const dateLabel = new Date(`${item.date}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.rowDate, { color: colors.text }]} numberOfLines={1}>{dateLabel}</Text>
      <Text style={[styles.rowPct, { color: gainColor }]} numberOfLines={1}>
        {isGain ? '+' : ''}{item.pctReturn.toFixed(2)}%
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.dailyHistoryLabel}</Text>
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
        renderItem={({ item }) => <Row item={item} locale={locale} />}
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
