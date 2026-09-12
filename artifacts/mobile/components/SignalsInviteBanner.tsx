import React, { useEffect, useState } from 'react';
import { Animated, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ConceptIcon } from '@/components/ConceptIcon';
import { ICON_SIGNALS } from '@/constants/conceptIcons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { SIGNALS_URL } from '@/constants/signals';

// Replaces the old Facebook community card in this same Home-screen slot —
// same dismissible-banner shell (per-user AsyncStorage dismiss key,
// animated fade/slide-in) as CommunityInviteBanner, but branded in the
// app's own gold rather than a borrowed brand color: this is our own
// product (a separate web app, its own domain/auth), not a link to
// somewhere else's platform, so it should read as ours. Tapping "Open
// Signals" opens the site AND dismisses the banner, same one-shot
// reasoning as the community banner — there's no server-side state to
// check, so once someone's been sent there, there's no reason to keep
// asking.
function dismissKey(userId: string) {
  return `@investry_signals_invite_dismissed_${userId}`;
}

export function SignalsInviteBanner() {
  const { userId } = useAuth();
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const [dismissed, setDismissed] = useState(true); // hidden until the AsyncStorage check resolves
  const anim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AsyncStorage.getItem(dismissKey(userId))
      .then(v => { if (!cancelled) setDismissed(!!v); })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [userId]);

  const visible = !dismissed;

  useEffect(() => {
    if (visible) Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [visible]);

  const dismiss = () => {
    if (userId) AsyncStorage.setItem(dismissKey(userId), '1').catch(() => null);
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setDismissed(true));
  };

  const close = () => { impact(); dismiss(); };

  const open = () => {
    impact();
    Linking.openURL(SIGNALS_URL).catch(() => null);
    dismiss();
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        s.wrap,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
        },
      ]}
    >
      <LinearGradient
        colors={[colors.primary + '26', colors.primary + '0A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.card, { borderColor: colors.primary + '40' }]}
      >
        <TouchableOpacity onPress={close} hitSlop={10} style={s.closeBtn} accessibilityLabel={t.dismiss}>
          <Feather name="x" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={s.headerRow}>
          <View style={[s.iconWrap, { backgroundColor: colors.primary + '22' }]}>
            <ConceptIcon icon={ICON_SIGNALS} size={20} color={colors.primary} />
          </View>
          <View style={[s.badge, { backgroundColor: colors.primary }]}>
            <Text style={s.badgeTxt}>{t.signalsInviteBadge}</Text>
          </View>
        </View>

        <Text style={[s.title, { color: colors.text }]}>{t.signalsInviteTitle}</Text>
        <Text style={[s.body, { color: colors.mutedForeground }]}>{t.signalsInviteBody}</Text>

        <TouchableOpacity
          onPress={open}
          style={[s.openBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <ConceptIcon icon={ICON_SIGNALS} size={15} color={colors.background} />
          <Text style={[s.openBtnTxt, { color: colors.background }]}>{t.signalsInviteCta}</Text>
          <Feather name="arrow-right" size={14} color={colors.background} />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: 18 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  closeBtn: { position: 'absolute', top: 10, right: 10, zIndex: 1, padding: 4 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', letterSpacing: 1.1, textTransform: 'uppercase', color: '#161616' },

  title: { fontSize: 16.5, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.2 },
  body:  { fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18, paddingEnd: 18 },

  openBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 12, paddingVertical: 12, marginTop: 4,
  },
  openBtnTxt: { fontSize: 14, fontFamily: 'Inter_800ExtraBold' },
});
