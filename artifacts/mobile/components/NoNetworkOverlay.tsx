import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useMarketPrices } from '@/hooks/usePrices';

// Full-screen "no connection" state covering every tab.
//
// Deliberately mounted from app/(tabs)/_layout.tsx rather than the root
// layout: the tabs layout only renders after its own isSignedIn check, so
// this can never appear over — or run any query on — the sign-in/sign-up
// screens. Those screens have to stay reachable with no network at all,
// since signing in is exactly what a user does after reinstalling.
//
// Gated on useMarketPrices().isError, which is only reached once BOTH our
// API server and the direct TradingView fallback have failed — i.e. no
// usable connection, not merely "our server is down". React Query keeps
// retrying on its own interval, so this clears itself the moment a real
// response arrives; the button is just an immediate manual nudge.
export function NoNetworkOverlay() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { isError, isFetching, refetch } = useMarketPrices();

  if (!isError) return null;

  return (
    <View
      style={[
        s.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
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
        onPress={() => refetch()}
        disabled={isFetching}
        style={[s.btn, { backgroundColor: colors.primary, opacity: isFetching ? 0.6 : 1 }]}
        activeOpacity={0.8}
      >
        {isFetching
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
    elevation: 900,
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
