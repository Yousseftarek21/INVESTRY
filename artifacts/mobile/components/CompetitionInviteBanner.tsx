import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useLeaderboard } from '@/hooks/useLeaderboard';

// A one-tap "want to join?" ask, separate from the deliberate nickname-entry
// flow on the Leaderboard screen itself: that screen is still how someone
// arrives on purpose (via Settings) and can change what they're shown as.
// This is the low-friction path — accept auto-joins immediately, decline is
// a firm no that doesn't ask again.
//
// Shown under the account's real name (same source as the Home greeting:
// unsafeMetadata.displayName, falling back to Clerk's firstName) rather
// than an anonymous nickname — an earlier version used a randomly generated
// one specifically for privacy, deliberately reversed on direct request.
// Kept as a last-resort fallback only for the edge case of no name being
// set on the account at all.
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

// The app's own established gold — already used for the gold-holding icon
// throughout (HoldingCard, FinancialTools, onboarding slide 1). Reused here
// deliberately rather than introducing a new accent: gold already reads as
// "prize/achievement" in this app's own visual language, which is exactly
// what a competition banner should borrow instead of the generic teal a
// plain notice card would use.
const GOLD = '#C9A227';

export function CompetitionInviteBanner() {
  const { userId } = useAuth();
  const { user } = useUser();
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
    const realName = (user?.unsafeMetadata?.displayName as string | undefined) || user?.firstName || '';
    await join(realName || randomNickname());
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
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
        },
      ]}
    >
      <LinearGradient
        colors={[GOLD + '26', GOLD + '0A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.card, { borderColor: GOLD + '40' }]}
      >
        <TouchableOpacity onPress={decline} hitSlop={10} style={s.closeBtn} accessibilityLabel={t.competitionInviteNo}>
          <Feather name="x" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={s.headerRow}>
          <View style={[s.trophyWrap, { backgroundColor: GOLD + '22' }]}>
            <Feather name="award" size={20} color={GOLD} />
          </View>
          <Text style={[s.eyebrow, { color: GOLD }]}>{t.competitionEyebrow}</Text>
        </View>

        <Text style={[s.title, { color: colors.text }]}>{t.competitionInviteTitle}</Text>
        <Text style={[s.body, { color: colors.mutedForeground }]}>{t.competitionInviteBody}</Text>

        <View style={s.actionsRow}>
          <TouchableOpacity onPress={decline} hitSlop={8} style={s.declineBtn}>
            <Text style={[s.declineTxt, { color: colors.mutedForeground }]}>{t.competitionInviteNo}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={accept}
            disabled={joining}
            style={[s.joinBtn, { backgroundColor: GOLD, opacity: joining ? 0.6 : 1 }]}
            activeOpacity={0.85}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text style={s.joinBtnTxt}>{t.competitionInviteYes}</Text>
                <Feather name="arrow-right" size={14} color="#000" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: 18 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  closeBtn: { position: 'absolute', top: 10, right: 10, zIndex: 1, padding: 4 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  trophyWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', letterSpacing: 1.1, textTransform: 'uppercase' },

  title: { fontSize: 16.5, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.2 },
  body:  { fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18, paddingEnd: 18 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  declineBtn: { paddingVertical: 6 },
  declineTxt: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  joinBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 12, paddingVertical: 12,
  },
  joinBtnTxt: { fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: '#000' },
});
