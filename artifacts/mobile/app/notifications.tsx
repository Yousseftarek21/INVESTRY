import React, { useEffect } from 'react';
import {
  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BanknoteIcon } from '@/components/BanknoteIcon';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useNotificationHistory } from '@/hooks/useNotificationHistory';

// Icon + color per Recent Alerts event type — cash events reuse the app's
// established cash iconography (BanknoteIcon, green), holding events reuse
// the investment identity (gold), matching how Cash/Investments already
// look everywhere else rather than inventing a new palette just here.
function eventVisual(type: string, colors: ReturnType<typeof useColors>) {
  switch (type) {
    case 'price_alert':
      return { icon: <Feather name="bell" size={18} color={colors.primary} />, color: colors.primary };
    case 'cash_added':
    case 'cash_edited':
      return { icon: <BanknoteIcon size={18} color={colors.green} />, color: colors.green };
    case 'holding_added':
    case 'holding_edited':
      return { icon: <Feather name="trending-up" size={18} color={colors.primary} />, color: colors.primary };
    case 'portfolio_alert':
    default:
      return { icon: <Feather name="trending-up" size={18} color={colors.green} />, color: colors.green };
  }
}

export default function NotificationsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { events: recentEvents, markAllRead } = useNotificationHistory();

  // Opening this screen is what "reads" recent alerts — clears the bell badge.
  useEffect(() => { markAllRead(); }, [markAllRead]);

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
                const visual = eventVisual(item.type, colors);
                return (
                  <View
                    key={item.id}
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
                  </View>
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
