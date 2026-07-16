import React, { useMemo } from 'react';
import {
  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useMarketPrices } from '@/hooks/usePrices';
import { useRecurringIncome } from '@/context/RecurringIncomeContext';
import { useCash } from '@/context/CashContext';

type NotifType = 'income' | 'gold' | 'silver';

interface NotifItem {
  id: string;
  type: NotifType;
  title: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
}

function effectiveCreditDay(day: number, year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(day, daysInMonth);
}

export default function NotificationsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { recurringIncomes } = useRecurringIncome();
  const { cashAccounts } = useCash();
  const { data: prices } = useMarketPrices();

  const items = useMemo<NotifItem[]>(() => {
    const result: NotifItem[] = [];
    const today = new Date();
    const todayDay = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();

    recurringIncomes
      .filter(inc => inc.active)
      .forEach(inc => {
        const effDay = effectiveCreditDay(inc.creditDay, year, month);
        const daysUntil = effDay - todayDay;
        if (daysUntil < 0 || daysUntil > 7) return;

        const account = cashAccounts.find(a => a.id === inc.cashAccountId);
        const accountLabel = account ? ` → ${account.accountName}` : '';

        let dueLine: string;
        if (daysUntil === 0) dueLine = t.dueTodayLabel;
        else if (daysUntil === 1) dueLine = t.dueTomorrowLabel;
        else dueLine = `${t.dueInDaysLabel} ${daysUntil} ${t.daysLeft}`;

        result.push({
          id: `income-${inc.id}`,
          type: 'income',
          title: inc.name,
          subtitle: `${dueLine} · ${inc.amount.toLocaleString('en-EG', { maximumFractionDigits: 0 })} ${inc.currency}${accountLabel}`,
          iconBg: '#8B5CF618',
          iconColor: '#8B5CF6',
        });
      });

    const goldPct = prices?.goldChangePercent;
    if (goldPct !== undefined && Math.abs(goldPct) >= 0.5) {
      const up = goldPct > 0;
      result.push({
        id: 'gold-change',
        type: 'gold',
        title: up ? t.goldUpAlert : t.goldDownAlert,
        subtitle: `${up ? '+' : ''}${goldPct.toFixed(2)}${t.pctToday}`,
        iconBg: colors.primary + '20',
        iconColor: colors.primary,
      });
    }

    const silverPct = prices?.silverChangePercent;
    if (silverPct !== undefined && Math.abs(silverPct) >= 0.5) {
      const up = silverPct > 0;
      result.push({
        id: 'silver-change',
        type: 'silver',
        title: up ? t.silverUpAlert : t.silverDownAlert,
        subtitle: `${up ? '+' : ''}${silverPct.toFixed(2)}${t.pctToday}`,
        iconBg: colors.silverColor + '20',
        iconColor: colors.silverColor,
      });
    }

    return result;
  }, [recurringIncomes, cashAccounts, prices, t, colors]);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.notificationsTitle}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="bell" size={28} color={colors.primary} />
              </View>
              <Text style={[s.emptyTitle, { color: colors.text }]}>{t.noNotifications}</Text>
              <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.noNotificationsHint}</Text>
            </View>
          ) : (
            <View style={s.list}>
              {items.map(item => (
                <View
                  key={item.id}
                  style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[s.iconWrap, { backgroundColor: item.iconBg }]}>
                    {item.type === 'income' ? (
                      <Feather name="repeat" size={18} color={item.iconColor} />
                    ) : (
                      <MaterialCommunityIcons name="gold" size={18} color={item.iconColor} />
                    )}
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
              ))}
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
