import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useWhatsNew } from '@/hooks/useWhatsNew';

interface WhatsNewItem {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
}

export function WhatsNewModal() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const { visible, dismiss } = useWhatsNew();

  const items: WhatsNewItem[] = [
    { icon: 'check-circle', title: t.whatsNewSoldTitle, body: t.whatsNewSoldBody },
    { icon: 'pie-chart', title: t.whatsNewAnalyticsTitle, body: t.whatsNewAnalyticsBody },
    // cpu, not message-circle — matches the AI Assistant's own icon
    // everywhere else it's named (its screen header, the Analytics promo
    // card, onboarding) instead of a separate icon just for this notice.
    { icon: 'cpu', title: t.whatsNewAiTitle, body: t.whatsNewAiBody },
    { icon: 'edit-3', title: t.whatsNewInputTitle, body: t.whatsNewInputBody },
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={dismiss}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.iconWrap, { backgroundColor: colors.primary + '1A' }]}>
            <Feather name="gift" size={22} color={colors.primary} />
          </View>
          <Text style={[s.title, { color: colors.text }]}>{t.whatsNewTitle}</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{t.whatsNewSubtitle}</Text>

          <View style={s.list}>
            {items.map((item, i) => (
              <View key={i} style={s.row}>
                <View style={[s.rowIconWrap, { backgroundColor: colors.primary + '14' }]}>
                  <Feather name={item.icon} size={15} color={colors.primary} />
                </View>
                <View style={s.rowText}>
                  <Text style={[s.rowTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[s.rowBody, { color: colors.mutedForeground }]}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => { impact(); dismiss(); }}
            style={[s.dismissBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={[s.dismissBtnText, { color: colors.primaryForeground }]}>{t.whatsNewCta}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { borderRadius: 24, borderWidth: 1, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center', gap: 4 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 19, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 2, marginBottom: 8 },
  list: { width: '100%', gap: 14, marginVertical: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rowIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowBody: { fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  dismissBtn: { width: '100%', paddingVertical: 15, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  dismissBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
