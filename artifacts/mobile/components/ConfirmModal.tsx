import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';

// Extracted from settings.tsx — used both there (Sign Out) and by
// app/settings-privacy.tsx (Delete All Data / Delete Account), since
// Alert.alert doesn't reliably invoke custom button callbacks on web.
export function ConfirmModal({ visible, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: {
  visible: boolean; title: string; message: string;
  confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const colors = useColors();
  const t = useT();
  if (!visible) return null;
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={cm.overlay}>
        <View style={[cm.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[cm.title, { color: colors.text }]}>{title}</Text>
          <Text style={[cm.msg, { color: colors.mutedForeground }]}>{message}</Text>
          <View style={cm.row}>
            <TouchableOpacity onPress={onCancel} style={[cm.btn, { backgroundColor: colors.muted }]}>
              <Text style={[cm.btnTxt, { color: colors.mutedForeground }]}>{t.cancelBtn}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[cm.btn, { backgroundColor: danger ? colors.red + '18' : colors.primary + '18', borderWidth: 1, borderColor: danger ? colors.red + '40' : colors.primary + '40' }]}
            >
              <Text style={[cm.btnTxt, { color: danger ? colors.red : colors.primary, fontFamily: 'Inter_600SemiBold' }]}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { borderRadius: 20, borderWidth: 1, padding: 24, width: '100%', gap: 16 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  msg: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnTxt: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
