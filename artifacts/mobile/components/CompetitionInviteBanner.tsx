import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useLeaderboard } from '@/hooks/useLeaderboard';

// A one-tap "want to join?" ask, separate from the deliberate nickname-entry
// flow on the Leaderboard screen itself: that screen is still how someone
// arrives on purpose (via Settings) and picks their own name. This is the
// low-friction path — accept auto-joins under a generated nickname (never
// anything tied to the real account), decline is a firm no that doesn't ask
// again. Either way, nothing about a real name or portfolio value is ever
// shown to anyone unless the user explicitly changes their nickname later.
const ADJECTIVES = ['Swift', 'Bold', 'Sharp', 'Steady', 'Bright', 'Prime', 'Sound', 'Keen'];
const NOUNS = ['Trader', 'Investor', 'Builder', 'Holder', 'Grower', 'Saver'];

function randomNickname(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900); // 3 digits, never leading zero
  return `${a}${n}${num}`;
}

function dismissKey(userId: string) {
  return `@investry_competition_invite_declined_${userId}`;
}

export function CompetitionInviteBanner() {
  const { userId } = useAuth();
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const { isOptedIn, isLoading, join } = useLeaderboard();
  const [declined, setDeclined] = useState(true); // default hidden until the AsyncStorage check resolves
  const [joining, setJoining] = useState(false);
  const anim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AsyncStorage.getItem(dismissKey(userId))
      .then(v => {
        if (cancelled) return;
        setDeclined(!!v);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [userId]);

  const visible = !isLoading && !isOptedIn && !declined;

  useEffect(() => {
    if (visible) Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [visible]);

  const decline = () => {
    impact();
    if (userId) AsyncStorage.setItem(dismissKey(userId), '1').catch(() => null);
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setDeclined(true));
  };

  const accept = async () => {
    impact();
    setJoining(true);
    await join(randomNickname());
    setJoining(false);
    // No local dismiss write here: isOptedIn flips true from the server
    // response itself, which already satisfies the `visible` condition
    // above without needing a second, redundant "don't show this again" flag.
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        s.wrap,
        {
          backgroundColor: colors.card, borderColor: colors.border,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
        },
      ]}
    >
      <View style={[s.iconWrap, { backgroundColor: '#00D4AA18' }]}>
        <Feather name="trending-up" size={15} color="#00D4AA" />
      </View>
      <View style={s.textWrap}>
        <Text style={[s.title, { color: colors.text }]}>{t.competitionInviteTitle}</Text>
        <Text style={[s.body, { color: colors.mutedForeground }]}>{t.competitionInviteBody}</Text>
      </View>
      <View style={s.actions}>
        <TouchableOpacity onPress={decline} hitSlop={8} style={s.declineBtn}>
          <Text style={[s.declineTxt, { color: colors.mutedForeground }]}>{t.competitionInviteNo}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={accept}
          disabled={joining}
          style={[s.joinBtn, { backgroundColor: '#00D4AA', opacity: joining ? 0.6 : 1 }]}
          activeOpacity={0.85}
        >
          <Text style={s.joinBtnTxt}>{t.competitionInviteYes}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 12,
  },
  iconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  textWrap: { flex: 1, gap: 2, minWidth: 0 },
  title: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
  body:  { fontSize: 11.5, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  actions: { gap: 6, alignItems: 'flex-end' },
  declineBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  declineTxt: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  joinBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  joinBtnTxt: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#000' },
});
