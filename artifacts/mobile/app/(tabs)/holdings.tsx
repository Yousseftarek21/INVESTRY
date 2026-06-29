import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices } from '@/hooks/usePrices';
import { HoldingCard } from '@/components/HoldingCard';
import { Holding } from '@/types';

const TYPE_LABELS: Record<Holding['type'], string> = {
  gold: 'Gold — ذهب',
  silver: 'Silver — فضة',
  stock: 'EGX Stocks — أسهم',
  real_estate: 'Real Estate — عقارات',
};

export default function HoldingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { holdings, removeHolding } = useHoldings();
  const { data: prices } = useMarketPrices();

  const grouped = holdings.reduce<Record<string, Holding[]>>((acc, h) => {
    const key = h.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  const handleDelete = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeHolding(id);
  };

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topInsets + 16, paddingBottom: botInsets + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: colors.text }]}>Holdings</Text>

        {holdings.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="briefcase" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No investments yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Tap the + button to add your first investment
            </Text>
          </View>
        ) : (
          Object.entries(grouped).map(([type, items]) => (
            <View key={type} style={styles.group}>
              <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>
                {TYPE_LABELS[type as Holding['type']]}
              </Text>
              <View style={styles.groupItems}>
                {items.map(h => (
                  <HoldingCard
                    key={h.id}
                    holding={h}
                    prices={prices}
                    onDelete={() => handleDelete(h.id)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: botInsets + 80 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/add-investment');
        }}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color={colors.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  screenTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  group: { gap: 10 },
  groupLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  groupItems: { gap: 8 },
  empty: {
    borderRadius: 20,
    padding: 40,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AC0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
