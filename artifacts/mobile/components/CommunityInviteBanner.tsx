import React, { useEffect, useState } from 'react';
import { Animated, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ConceptIcon } from '@/components/ConceptIcon';
import { ICON_COMMUNITY } from '@/constants/conceptIcons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { COMMUNITY_URL } from '@/constants/community';

// A one-time announcement for the new Facebook Community group, same
// dismissible-banner shell as CompetitionInviteBanner (per-user AsyncStorage
// dismiss key, animated fade/slide-in) but its own identity — Facebook's own
// blue rather than the app's gold, since gold already reads as "prize" here
// (CompetitionInviteBanner) and this isn't a competition or an in-app
// feature, it's a link out to a real Facebook group. Tapping "Join on
// Facebook" opens the group AND dismisses the banner (there's no server-side
// membership to check, so both the CTA and the close button are equally
// terminal — no reason to keep asking once someone's already been sent
// there).
function dismissKey(userId: string) {
  return `@investry_community_invite_dismissed_${userId}`;
}

const FB_BLUE = '#1877F2';

export function CommunityInviteBanner() {
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

  const join = () => {
    impact();
    Linking.openURL(COMMUNITY_URL).catch(() => null);
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
        colors={[FB_BLUE + '26', FB_BLUE + '0A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.card, { borderColor: FB_BLUE + '40' }]}
      >
        <TouchableOpacity onPress={close} hitSlop={10} style={s.closeBtn} accessibilityLabel={t.dismiss}>
          <Feather name="x" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={s.headerRow}>
          <View style={[s.iconWrap, { backgroundColor: FB_BLUE + '22' }]}>
            <ConceptIcon icon={ICON_COMMUNITY} size={20} color={FB_BLUE} />
          </View>
          <Text style={[s.eyebrow, { color: FB_BLUE }]}>{t.communityEyebrow}</Text>
        </View>

        <Text style={[s.title, { color: colors.text }]}>{t.communityInviteTitle}</Text>
        <Text style={[s.body, { color: colors.mutedForeground }]}>{t.communityInviteBody}</Text>

        <TouchableOpacity
          onPress={join}
          style={[s.joinBtn, { backgroundColor: FB_BLUE }]}
          activeOpacity={0.85}
        >
          <ConceptIcon icon={ICON_COMMUNITY} size={15} color="#fff" />
          <Text style={s.joinBtnTxt}>{t.communityInviteCta}</Text>
          <Feather name="arrow-right" size={14} color="#fff" />
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
  eyebrow: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', letterSpacing: 1.1, textTransform: 'uppercase' },

  title: { fontSize: 16.5, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.2 },
  body:  { fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18, paddingEnd: 18 },

  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 12, paddingVertical: 12, marginTop: 4,
  },
  joinBtnTxt: { fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: '#fff' },
});
