import React from 'react';
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useCash } from '@/context/CashContext';
import { useRecentCashUpdates } from '@/hooks/useRecentCashUpdates';
import { tradingDayKey, tradingDayLabel, cairoTimeLabel } from '@/utils/cairoDate';

// Well above what any personal cash-account history realistically reaches —
// "View all" just means "stop artificially capping it at the inline
// preview's 8", not true unbounded pagination.
const HISTORY_LIMIT = 200;

export default function CashHistoryScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { cashAccounts } = useCash();
  const { updates, isLoading } = useRecentCashUpdates(cashAccounts, HISTORY_LIMIT);

  // Grouped on the trading day, not the device's calendar — these headings
  // sit above the same updates the "today" badge sums, and that sum uses the
  // same boundary server-side. See utils/cairoDate.
  const dayLabel = (d: Date): string => {
    const key = tradingDayKey(d);
    if (key === tradingDayKey(new Date())) return t.todayLabel;
    if (key === tradingDayKey(new Date(Date.now() - 86_400_000))) return t.aiHistoryYesterday;
    return tradingDayLabel(d, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  let lastDayKey = '';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.cashHistoryTitle}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={[s.content, { paddingBottom: botPad + 24 }]}>
          {isLoading ? (
            <View style={s.empty}>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            </View>
          ) : updates.length === 0 ? (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="clock" size={26} color={colors.primary} />
              </View>
              <Text style={[s.emptyTitle, { color: colors.text }]}>{t.cashHistoryEmpty}</Text>
            </View>
          ) : (
            updates.map((u, i) => {
              const created = new Date(u.createdAt);
              const key = tradingDayKey(created);
              const showDivider = key !== lastDayKey;
              lastDayKey = key;
              const isUp = u.delta > 0;
              return (
                <React.Fragment key={u.id}>
                  {showDivider && (
                    <Text style={[s.dayDivider, { color: colors.mutedForeground }]}>{dayLabel(created)}</Text>
                  )}
                  <View
                    style={[
                      s.row,
                      i > 0 && !showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.accountName, { color: colors.text }]} numberOfLines={1}>{u.accountName}</Text>
                      <Text style={[s.time, { color: colors.mutedForeground }]}>
                        {cairoTimeLabel(created, { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={[s.delta, { color: isUp ? colors.green : colors.red }]} numberOfLines={1}>
                      {isUp ? '+' : ''}{u.delta.toLocaleString('en-EG', { maximumFractionDigits: 0 })} {u.currency}
                    </Text>
                  </View>
                </React.Fragment>
              );
            })
          )}
        </ScrollView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 8, flexGrow: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_500Medium' },

  dayDivider: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, marginTop: 10, marginBottom: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  accountName: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
  time: { fontSize: 11.5, fontFamily: 'Inter_400Regular', marginTop: 1 },
  delta: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
});
