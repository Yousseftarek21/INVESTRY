import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useMarketPrices } from '@/hooks/usePrices';

// Values on screens other than the home hero are computed from the
// placeholder fallback prices until the first real fetch lands (only on a
// first launch with nothing cached). Says so instead of letting those
// numbers pass as live.
export function PricesLoadingNotice() {
  const colors = useColors();
  const t = useT();
  const { isPlaceholderData } = useMarketPrices();
  if (!isPlaceholderData) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8, marginBottom: 8 }}>
      <ActivityIndicator size="small" color={colors.mutedForeground} />
      <Text style={{ fontSize: 12.5, fontFamily: 'Inter_500Medium', color: colors.mutedForeground }}>{t.loadingLivePrices}</Text>
    </View>
  );
}
