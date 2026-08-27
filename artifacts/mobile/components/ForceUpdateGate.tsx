import React from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useAppUpdateCheck } from '@/hooks/useAppUpdateCheck';

// A prominent, app-wide nudge (not tied to any one tab, unlike the older
// Home-tab-only UpdateAvailableBanner) for anyone on a native binary older
// than the server's known-latest App Store version — every old version,
// every user, shown regardless of which screen they're on or whether
// they're signed in yet. Dismissible (X button, backdrop tap, Android back
// button) — it reappears next launch as long as the account is still
// behind, via useAppUpdateCheck's own per-version dismiss tracking.
export function ForceUpdateGate() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const { updateAvailable, kind, storeUrl, dismiss } = useAppUpdateCheck();

  const visible = updateAvailable && kind === 'native' && !!storeUrl;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={dismiss}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.background + 'E6' }]} onPress={dismiss}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <TouchableOpacity onPress={() => { impact(); dismiss(); }} style={[styles.close, { backgroundColor: colors.muted }]} hitSlop={8}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '1F' }]}>
            <Feather name="download" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{t.forceUpdateTitle}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{t.forceUpdateBody}</Text>
          <TouchableOpacity
            onPress={() => { impact(); if (storeUrl) Linking.openURL(storeUrl).catch(() => null); }}
            style={[styles.cta, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>{t.forceUpdateCta}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  content: { alignItems: 'center', gap: 14, maxWidth: 340, position: 'relative', width: '100%' },
  close: {
    position: 'absolute', top: -8, right: -8, zIndex: 1,
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
  },
  iconWrap: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  body: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 21 },
  cta: { paddingHorizontal: 32, paddingVertical: 15, borderRadius: 16, marginTop: 10, width: '100%', alignItems: 'center' },
  ctaText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
