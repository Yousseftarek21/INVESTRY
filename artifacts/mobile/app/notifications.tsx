import React, { useCallback, useEffect } from 'react';
import {
  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BanknoteIcon } from '@/components/BanknoteIcon';
import { backChevron, forwardArrow } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useNotificationHistory } from '@/hooks/useNotificationHistory';

// Where tapping each event type should actually go — was previously a
// dead-end list (no onPress at all), same gap as push notifications had
// before useNotificationTapRouting.ts. Kept as its own map here rather than
// reused from that hook since these are in-app event *types* (from
// useNotificationHistory), not push payload *types* — they overlap in
// spirit but aren't the same set (e.g. cash_added/holding_edited only ever
// happen locally, never as a push).
const EVENT_DESTINATION: Record<string, string> = {
  price_alert: '/price-alerts',
  portfolio_alert: '/(tabs)',
  cash_added: '/cash-accounts',
  cash_edited: '/cash-accounts',
  holding_added: '/(tabs)/holdings',
  holding_edited: '/(tabs)/holdings',
  holding_sold: '/sold-holdings',
  income_added: '/recurring-income',
  income_edited: '/recurring-income',
  income_collected: '/recurring-income',
};

// Icon + color per Recent Alerts event type — cash events reuse the app's
// established cash iconography (BanknoteIcon, green), holding events reuse
// the investment identity (gold), matching how Cash/Investments already
// look everywhere else rather than inventing a new palette just here.
//
// `subtitle` is passed in for portfolio_alert specifically: its direction
// (up/down) is decided server-side (portfolioAlertCron.ts) and only shows
// up in the row's own text ("Your portfolio is down 3.2% today") — there's
// no separate direction field. Was previously hardcoded to trending-up +
// green regardless of direction, so a "portfolio is down" alert rendered
// with an up-trending, green (gain-colored) icon — a real, user-reported
// mismatch, not cosmetic.
function eventVisual(type: string, subtitle: string, colors: ReturnType<typeof useColors>) {
  switch (type) {
    case 'price_alert':
      return { icon: <Feather name="bell" size={18} color={colors.primary} />, color: colors.primary };
    case 'cash_added':
    case 'cash_edited':
      return { icon: <BanknoteIcon size={18} color={colors.green} />, color: colors.green };
    case 'holding_added':
    case 'holding_edited':
      return { icon: <Feather name="trending-up" size={18} color={colors.primary} />, color: colors.primary };
    case 'holding_sold':
      return { icon: <Feather name="check-circle" size={18} color={colors.green} />, color: colors.green };
    case 'income_added':
    case 'income_edited':
      return { icon: <Feather name="repeat" size={18} color="#8B5CF6" />, color: '#8B5CF6' };
    case 'income_collected':
      return { icon: <Feather name="check-circle" size={18} color={colors.green} />, color: colors.green };
    case 'portfolio_alert':
    default: {
      const isDown = /\bdown\b/i.test(subtitle);
      const color = isDown ? colors.red : colors.green;
      return { icon: <Feather name={isDown ? 'trending-down' : 'trending-up'} size={18} color={color} />, color };
    }
  }
}

export default function NotificationsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { events: recentEvents, markAllRead, refetch } = useNotificationHistory();

  // Opening this screen is what "reads" recent alerts — clears the bell badge.
  useEffect(() => { markAllRead(); }, [markAllRead]);

  // The underlying data only loads once per app session by default (see
  // useNotificationHistory) — refetching on every focus means an alert that
  // arrived while this screen wasn't open still shows up without needing a
  // full app relaunch.
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name={backChevron()} size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.notificationsTitle}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {recentEvents.length === 0 ? (
            <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="bell" size={28} color={colors.primary} />
              </View>
              <Text style={[s.emptyTitle, { color: colors.text }]}>{t.noNotifications}</Text>
              <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.noNotificationsHint}</Text>
            </View>
          ) : (
            <View style={s.list}>
              {recentEvents.map(item => {
                const visual = eventVisual(item.type, item.subtitle, colors);
                const destination = EVENT_DESTINATION[item.type];
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={destination ? 0.7 : 1}
                    disabled={!destination}
                    onPress={() => { if (destination) router.push(destination as any); }}
                    style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[s.iconWrap, { backgroundColor: visual.color + '18' }]}>
                      {visual.icon}
                    </View>
                    <View style={s.cardBody}>
                      <Text style={[s.cardTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {item.subtitle}
                      </Text>
                    </View>
                    {destination && <Feather name={forwardArrow()} size={15} color={colors.mutedForeground} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 12 },
  empty: {
    borderRadius: 18, borderWidth: 1, padding: 32,
    alignItems: 'center', gap: 10, marginTop: 8,
  },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyHint: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  list: { gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});
