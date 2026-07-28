import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';

// Shown instead of a hero/summary card (never alongside a fabricated total)
// once prices have genuinely failed to load from both our server and the
// direct client-side fallback — i.e. no usable connection at all, not just
// "our server is down." React Query keeps retrying on its own
// refetchInterval, so this clears automatically the moment a real response
// comes back; the button is just for an immediate manual nudge.
export function NoNetworkState({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const colors = useColors();
  const t = useT();
  return (
    <View style={s.body}>
      <View style={[s.iconWrap, { backgroundColor: colors.red + '14' }]}>
        <Feather name="wifi-off" size={26} color={colors.red} />
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
  body:  { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 28, alignItems: 'center', gap: 10 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  desc:  { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19, maxWidth: 280 },
  btn:   { marginTop: 8, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, minWidth: 110, alignItems: 'center' },
  btnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
