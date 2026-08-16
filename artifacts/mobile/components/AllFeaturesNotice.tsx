import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';

// Deliberately says nothing about a plan, tier, subscription or price.
//
// App Review rejected build 54 under Guideline 3.1.1 for presenting a Pro
// plan that could only be bought on investry.app, and rejected it a second
// time when only the gating was removed and the badges were left in place —
// Apple objects to *presenting* paid content bought elsewhere, not just to
// gating it (see context/SubscriptionContext.tsx). Wording this as "all Pro
// subscription features are free" would name exactly such a tier. Telling the
// user everything is available costs nothing and carries none of that risk.

function dismissKey(userId: string) {
  return `@investry_all_features_notice_${userId}`;
}

export function AllFeaturesNotice() {
  const { userId } = useAuth();
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const [visible, setVisible] = useState(false);
  const anim = useState(() => new Animated.Value(0))[0];

  // Per-user, like every other local store here: dismissing it on one account
  // shouldn't silence it for whoever signs in next on the same device.
  useEffect(() => {
    if (!userId) { setVisible(false); return; }
    let cancelled = false;
    AsyncStorage.getItem(dismissKey(userId))
      .then(v => {
        if (cancelled || v) return;
        setVisible(true);
        Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [userId]);

  const dismiss = () => {
    impact();
    // Written before the exit animation, not after: if the app is killed
    // mid-animation the notice must stay dismissed, not reappear next launch.
    if (userId) AsyncStorage.setItem(dismissKey(userId), '1').catch(() => null);
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true })
      .start(() => setVisible(false));
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        s.wrap,
        {
          backgroundColor: colors.primary + '14',
          borderColor: colors.primary + '33',
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
        },
      ]}
    >
      <View style={[s.iconWrap, { backgroundColor: colors.primary + '1F' }]}>
        <Feather name="gift" size={15} color={colors.primary} />
      </View>
      <View style={s.textWrap}>
        <Text style={[s.title, { color: colors.text }]}>{t.allFeaturesNoticeTitle}</Text>
        <Text style={[s.body, { color: colors.mutedForeground }]}>{t.allFeaturesNoticeBody}</Text>
      </View>
      <TouchableOpacity onPress={dismiss} hitSlop={10} accessibilityLabel={t.dismiss}>
        <Feather name="x" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </Animated.View>
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
});
