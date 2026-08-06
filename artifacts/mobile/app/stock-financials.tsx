import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { StockFinancialsContent } from '@/components/StockFinancialsContent';

// Same screen chrome as app/financial-tool.tsx (header row, safe-area
// padding, ScrollView body) and the same "modal" presentation in
// _layout.tsx — a real native modal gets genuine swipe-to-dismiss for free,
// unlike the hand-rolled Animated + transparent Modal sheet this replaced.
export default function StockFinancialsScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { data: stocks = [] } = useEGXMarket();

  const stock = stocks.find(s => s.ticker === ticker);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.seeAllFinancials}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {stock && <StockFinancialsContent stock={stock} />}
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
  content: { padding: 16, paddingTop: 4 },
});
