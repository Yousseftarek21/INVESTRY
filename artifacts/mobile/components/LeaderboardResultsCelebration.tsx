import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { LeaderboardResultEntry, LeaderboardPeriod } from '@/hooks/useLeaderboard';
import { Avatar, MEDAL_EMOJI, pctColor } from '@/components/LeaderboardDisplay';

const GLOW_SIZE = 260;
const CONFETTI_COUNT = 14;

// Same radial "spotlight" construction as GoalCelebration/TierCelebration's
// own Glow — kept local rather than shared, same reasoning as those two:
// the moments look related on purpose but aren't the same event.
function Glow({ color, reveal }: { color: string; reveal: Animated.Value }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: GLOW_SIZE,
        height: GLOW_SIZE,
        opacity: reveal,
        transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
      }}
    >
      <Svg width={GLOW_SIZE} height={GLOW_SIZE} viewBox={`0 0 ${GLOW_SIZE} ${GLOW_SIZE}`}>
        <Defs>
          <RadialGradient id="resultsGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#resultsGlow)" />
      </Svg>
    </Animated.View>
  );
}

const CONFETTI = Array.from({ length: CONFETTI_COUNT }, (_, i) => {
  const angle = (i / CONFETTI_COUNT) * Math.PI * 2 + (i % 2 ? 0.18 : -0.18);
  const distance = 70 + (i % 3) * 22;
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance - 20,
    rotate: (i * 47) % 360,
    size: 6 + (i % 3) * 2,
  };
});

function Confetti({ color, burst }: { color: string; burst: Animated.Value }) {
  return (
    <>
      {CONFETTI.map((c, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: c.size,
            height: c.size,
            borderRadius: i % 2 ? c.size / 2 : 2,
            backgroundColor: i % 3 === 0 ? color : (i % 3 === 1 ? '#FFFFFF' : color + '99'),
            opacity: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, c.dx] }) },
              { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, c.dy] }) },
              { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.rotate}deg`] }) },
            ],
          }}
        />
      ))}
    </>
  );
}

function PodiumRow({ entry, isMe }: { entry: LeaderboardResultEntry; isMe: boolean }) {
  const colors = useColors();
  const t = useT();
  return (
    <View style={[pr.row, { borderBottomColor: colors.border }, isMe && { backgroundColor: colors.primary + '14' }]}>
      <Text style={pr.medal}>{MEDAL_EMOJI[entry.rank]}</Text>
      <Avatar name={entry.name} imageUrl={entry.imageUrl} size={30} />
      <Text style={[pr.name, { color: colors.text }]} numberOfLines={1}>
        {entry.name}{isMe ? ` (${t.leaderboardYou})` : ''}
      </Text>
      <View style={[pr.pctPill, { backgroundColor: pctColor(colors, entry.pctReturn) + '18' }]}>
        <Text style={[pr.pct, { color: pctColor(colors, entry.pctReturn) }]} numberOfLines={1}>
          {entry.pctReturn > 0 ? '+' : ''}{entry.pctReturn.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

/**
 * Fires once, the first time an opted-in user opens the Leaderboard screen
 * after a week/month has closed with real results on record (see
 * useLastLeaderboardResult / leaderboardPeriodResultsCron.ts). Shown to
 * every opted-in user, not just the top 3 — a shared "here's how it ended"
 * moment, not a personal achievement screen the way GoalCelebration is.
 * Whoever's viewing gets their own row highlighted if they placed.
 */
export function LeaderboardResultsCelebration({
  period, top, myUserId, onDismiss,
}: {
  period: LeaderboardPeriod;
  top: LeaderboardResultEntry[];
  myUserId: string | null | undefined;
  onDismiss: () => void;
}) {
  const colors = useColors();
  const t = useT();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const badgePop = useRef(new Animated.Value(0.4)).current;
  const glowReveal = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (top.length === 0) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    scale.setValue(0.85);
    opacity.setValue(0);
    badgePop.setValue(0.4);
    glowReveal.setValue(0);
    burst.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(80),
        Animated.spring(badgePop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      ]),
      Animated.timing(glowReveal, { toValue: 1, duration: 360, delay: 80, useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: 900, delay: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [top.length, scale, opacity, badgePop, glowReveal, burst]);

  if (top.length === 0) return null;

  const eyebrow = period === 'month' ? t.leaderboardResultsEyebrowMonth : t.leaderboardResultsEyebrowWeek;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <Animated.View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border, opacity, transform: [{ scale }] }]}>
          <Text style={[s.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text>

          <View style={s.stage}>
            <Glow color={colors.primary} reveal={glowReveal} />
            <View style={s.confettiAnchor}>
              <Confetti color={colors.primary} burst={burst} />
            </View>
            <Animated.View style={[s.badge, { backgroundColor: colors.primary, transform: [{ scale: badgePop }] }]}>
              <Text style={s.badgeEmoji}>🏆</Text>
            </Animated.View>
          </View>

          <Text style={[s.body, { color: colors.textSecondary }]}>{t.leaderboardResultsBody}</Text>

          <View style={[s.podium, { borderColor: colors.border }]}>
            {top.map(entry => (
              <PodiumRow key={entry.userId} entry={entry} isMe={entry.userId === myUserId} />
            ))}
          </View>

          <TouchableOpacity
            onPress={onDismiss}
            activeOpacity={0.85}
            style={[s.btn, { backgroundColor: colors.primary }]}
          >
            <Text style={[s.btnTxt, { color: colors.primaryForeground }]}>{t.leaderboardResultsDismiss}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  sheet: { width: '100%', maxWidth: 360, alignItems: 'center', gap: 12, borderRadius: 24, borderWidth: 1, padding: 26 },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.6, textTransform: 'uppercase' },

  stage: { width: GLOW_SIZE, height: 120, alignItems: 'center', justifyContent: 'center' },
  confettiAnchor: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
  badge: { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badgeEmoji: { fontSize: 32 },

  body: { fontSize: 13.5, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, paddingHorizontal: 4 },

  podium: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginTop: 4 },

  btn: { alignSelf: 'stretch', paddingVertical: 14, borderRadius: 15, alignItems: 'center', marginTop: 4 },
  btnTxt: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});

const pr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  medal: { fontSize: 18, width: 24, textAlign: 'center' },
  name: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  pctPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pct: { fontSize: 12.5, fontFamily: 'Inter_700Bold' },
});
