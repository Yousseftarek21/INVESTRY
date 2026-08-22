import React from 'react';
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { forwardChevron } from '@/utils/rtl';
import { useColors } from '@/hooks/useColors';

// Extracted from settings.tsx so every settings sub-screen (Account,
// Appearance, Notifications, Portfolio, Privacy, Support) can share the same
// row/section building blocks instead of duplicating them six times.

// ─── Icon badge ────────────────────────────────────────────────────────────────

export function Bdg({ icon, bg }: { icon: keyof typeof Feather.glyphMap; bg: string }) {
  return (
    <View style={[bdg.wrap, { backgroundColor: bg }]}>
      <Feather name={icon} size={15} color="#fff" />
    </View>
  );
}
const bdg = StyleSheet.create({
  wrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

// ─── Row divider ──────────────────────────────────────────────────────────────

export function Div({ left = 62 }: { left?: number }) {
  const colors = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: left }} />;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

export function Sect({ label, children, noCard }: { label: string; children: React.ReactNode; noCard?: boolean }) {
  const colors = useColors();
  const content = noCard ? children : (
    <View style={[sct.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
  return (
    <View style={sct.wrap}>
      <Text style={[sct.label, { color: colors.mutedForeground }]}>{label}</Text>
      {content}
    </View>
  );
}
const sct = StyleSheet.create({
  wrap: { gap: 9 },
  label: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.6, marginLeft: 5 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});

// ─── Nav row ───────────────────────────────────────────────────────────────────

export function NavRow({
  icon, iconBg, label, sublabel, value, badge, onPress, last, destructive,
}: {
  icon: keyof typeof Feather.glyphMap; iconBg: string; label: string;
  sublabel?: string; value?: string; badge?: { text: string; color: string };
  onPress?: () => void; last?: boolean; destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <>
      <TouchableOpacity
        style={rw.row} onPress={onPress}
        activeOpacity={onPress ? 0.5 : 1} disabled={!onPress}
      >
        <Bdg icon={icon} bg={iconBg} />
        <View style={rw.body}>
          <Text style={[rw.label, { color: destructive ? colors.red : colors.text }]}>{label}</Text>
          {sublabel ? <Text style={[rw.sub, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
        </View>
        <View style={rw.trail}>
          {badge ? (
            <View style={[rw.badge, { backgroundColor: badge.color + '20', borderColor: badge.color + '40' }]}>
              <Text style={[rw.badgeTxt, { color: badge.color }]}>{badge.text}</Text>
            </View>
          ) : null}
          {value ? <Text style={[rw.val, { color: colors.mutedForeground }]}>{value}</Text> : null}
          {onPress ? <Feather name={forwardChevron()} size={16} color={colors.mutedForeground} /> : null}
        </View>
      </TouchableOpacity>
      {!last && <Div />}
    </>
  );
}
const rw = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14, minHeight: 56 },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  trail: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  val: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  badge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});

// ─── Toggle row ────────────────────────────────────────────────────────────────

export function ToggleRow({
  icon, iconBg, label, sublabel, value, onChange, last,
}: {
  icon: keyof typeof Feather.glyphMap; iconBg: string; label: string;
  sublabel?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
}) {
  const colors = useColors();
  return (
    <>
      <View style={rw.row}>
        <Bdg icon={icon} bg={iconBg} />
        <View style={rw.body}>
          <Text style={[rw.label, { color: colors.text }]}>{label}</Text>
          {sublabel ? <Text style={[rw.sub, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
        </View>
        <Switch
          value={value} onValueChange={onChange}
          trackColor={{ false: colors.muted, true: colors.primary }}
          thumbColor={Platform.OS === 'android' ? (value ? colors.primary : colors.mutedForeground) : undefined}
          ios_backgroundColor={colors.muted}
        />
      </View>
      {!last && <Div />}
    </>
  );
}

// Shared by every sub-screen's own header (back chevron + title).
export const settingsScreenStyles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 20 },
});
