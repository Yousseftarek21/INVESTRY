import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useAppUpdateCheck } from '@/hooks/useAppUpdateCheck';

export function UpdateAvailableBanner() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const { updateAvailable, kind, storeUrl, reload, reloading, dismiss } = useAppUpdateCheck();

  if (!updateAvailable) return null;

  const isOta = kind === 'ota';

  return (
    <View style={[s.wrap, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '33' }]}>
      <View style={[s.iconWrap, { backgroundColor: colors.primary + '1F' }]}>
        <Feather name={isOta ? 'refresh-cw' : 'download'} size={15} color={colors.primary} />
      </View>
      <View style={s.textWrap}>
        <Text style={[s.title, { color: colors.text }]}>{isOta ? t.otaUpdateTitle : t.updateAvailableTitle}</Text>
        <Text style={[s.body, { color: colors.mutedForeground }]}>{isOta ? t.otaUpdateBody : t.updateAvailableBody}</Text>
      </View>
      <TouchableOpacity
        onPress={() => {
          impact();
          if (isOta) { reload(); return; }
          if (storeUrl) Linking.openURL(storeUrl).catch(() => null);
        }}
        disabled={reloading}
        style={[s.updateBtn, { backgroundColor: colors.primary, opacity: reloading ? 0.6 : 1 }]}
        activeOpacity={0.8}
      >
        <Text style={s.updateBtnTxt}>{isOta ? t.reloadNow : t.updateNow}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { impact(); dismiss(); }} hitSlop={10} accessibilityLabel={t.dismiss}>
        <Feather name="x" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 12,
  },
  iconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1, gap: 2, minWidth: 0 },
  title: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
  body:  { fontSize: 11.5, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  updateBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  updateBtnTxt: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#000' },
});
