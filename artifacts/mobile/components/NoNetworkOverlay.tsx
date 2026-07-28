import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';

// App-wide, full-screen counterpart to NoNetworkScreen (which only covers the
// pre-auth boot sequence). This one is gated on useMarketPrices().isError, so
// it appears over whichever tab is active any time the device has no usable
// connection at all — not just at cold launch — and clears itself the moment
// React Query's own refetchInterval gets a real response back.
export function NoNetworkOverlay({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Image
        source={require('@/assets/images/logo-mark.png')}
        style={s.logo}
        resizeMode="contain"
      />

      <View style={[s.iconWrap, { backgroundColor: colors.red + '14' }]}>
        <Feather name="wifi-off" size={30} color={colors.red} />
      </View>

      <Text style={[s.title, { color: colors.text }]}>{t.noNetworkTitle}</Text>
      <Text style={[s.desc, { color: colors.mutedForeground }]}>{t.noNetworkDesc}</Text>

      <TouchableOpacity
        onPress={onRetry}
        disabled={retrying}
        style={[s.btn, { backgroundColor: colors.primary, opacity: retrying ? 0.6 : 1 }]}
        activeOpacity={0.8}
      >
        {retrying
          ? <ActivityIndicator size="small" color={colors.primaryForeground} />
          : <Text style={[s.btnText, { color: colors.primaryForeground }]}>{t.tryAgain}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 900,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: { width: 130, height: 20, opacity: 0.5, marginBottom: 40 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 19, fontFamily: 'Inter_600SemiBold', marginBottom: 10 },
  desc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20.5, maxWidth: 300, marginBottom: 28 },
  btn: { paddingHorizontal: 26, paddingVertical: 13, borderRadius: 12, minWidth: 130, alignItems: 'center' },
  btnText: { fontSize: 14.5, fontFamily: 'Inter_600SemiBold' },
});
