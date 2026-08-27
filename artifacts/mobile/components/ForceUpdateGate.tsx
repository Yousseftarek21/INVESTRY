import React from 'react';
import { BackHandler, Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useAppUpdateCheck } from '@/hooks/useAppUpdateCheck';

// A hard, non-dismissible block for anyone on a native binary older than
// the server's known-latest App Store version — no X button, no backdrop
// tap, no Android back-button escape. Deliberately stronger than
// UpdateAvailableBanner (which stays for the lighter "a fresh OTA JS
// bundle is ready" case, kind === 'ota', still dismissible): a stale
// NATIVE binary can carry real, already-shipped bugs an OTA update can't
// patch (e.g. a missing native module), so nudging politely isn't enough
// once a fix that actually needs a new binary is out.
export function ForceUpdateGate() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const { updateAvailable, kind, storeUrl } = useAppUpdateCheck();

  const visible = updateAvailable && kind === 'native' && !!storeUrl;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      // No onRequestClose dismissal — intercepted below on Android so the
      // hardware back button can't back out of this either.
      onRequestClose={() => { if (Platform.OS === 'android') BackHandler.exitApp(); }}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  content: { alignItems: 'center', gap: 14, maxWidth: 340 },
  iconWrap: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  body: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 21 },
  cta: { paddingHorizontal: 32, paddingVertical: 15, borderRadius: 16, marginTop: 10, width: '100%', alignItems: 'center' },
  ctaText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
