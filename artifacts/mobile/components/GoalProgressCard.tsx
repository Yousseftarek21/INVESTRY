import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useColors } from '@/hooks/useColors';
import { useGoals } from '@/context/GoalsContext';

const MILESTONES = [25, 50, 75, 100];

function milestoneKey(userId: string, goalId: string) {
  return `@investry_goal_milestone_${userId}_${goalId}`;
}

/**
 * Quiet by default (renders nothing if the user has no goals), but
 * celebrates real progress: a one-time animated banner + haptic tap the
 * first time a goal crosses 25/50/75/100%, tracked per-goal so it never
 * repeats for the same milestone.
 */
export function GoalProgressCard() {
  const colors = useColors();
  const router = useRouter();
  const { userId } = useAuth();
  const { goals } = useGoals();
  const [celebrateMsg, setCelebrateMsg] = useState<string | null>(null);
  const celebrateAnim = useRef(new Animated.Value(0)).current;
  const checkedRef = useRef<string | null>(null);

  // Feature the goal with the highest progress that isn't finished yet —
  // the most motivating one to show ("almost there!") — falling back to
  // the most recently completed goal if all are done.
  const featured = useMemo(() => {
    if (goals.length === 0) return null;
    const withPct = goals.map(g => ({
      g,
      pct: g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0,
    }));
    const incomplete = withPct.filter(x => x.pct < 100).sort((a, b) => b.pct - a.pct);
    return incomplete[0] ?? withPct.sort((a, b) => b.pct - a.pct)[0];
  }, [goals]);

  useEffect(() => {
    if (!featured || !userId) return;
    const dedupeKey = `${featured.g.id}:${Math.round(featured.pct)}`;
    if (checkedRef.current === dedupeKey) return;
    checkedRef.current = dedupeKey;

    (async () => {
      const key = milestoneKey(userId, featured.g.id);
      const lastSeen = Number((await AsyncStorage.getItem(key)) ?? '0');
      const crossed = MILESTONES.filter(m => featured.pct >= m && m > lastSeen);
      if (crossed.length === 0) return;

      const newest = crossed[crossed.length - 1];
      await AsyncStorage.setItem(key, String(newest));

      setCelebrateMsg(
        newest >= 100
          ? `🎉 "${featured.g.name}" is fully funded!`
          : `🎯 ${newest}% of the way to "${featured.g.name}"!`,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      Animated.sequence([
        Animated.spring(celebrateAnim, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.delay(2600),
        Animated.timing(celebrateAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setCelebrateMsg(null));
    })();
  }, [featured, userId, celebrateAnim]);

  if (!featured) return null;
  const { g, pct } = featured;
  const clampedPct = Math.min(100, Math.max(0, pct));
  const remaining = Math.max(0, g.targetAmount - g.savedAmount);
  const isComplete = pct >= 100;
  const accent = isComplete ? colors.green : colors.primary;

  return (
    <View>
      {celebrateMsg && (
        <Animated.View
          style={[
            styles.celebrateBanner,
            {
              backgroundColor: accent,
              opacity: celebrateAnim,
              transform: [{
                translateY: celebrateAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }),
              }],
            },
          ]}
        >
          <Text style={styles.celebrateText}>{celebrateMsg}</Text>
        </Animated.View>
      )}
      <Pressable
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push('/goals' as any)}
      >
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: accent + '1A' }]}>
            <Feather name={isComplete ? 'check-circle' : 'target'} size={16} color={accent} />
          </View>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{g.name}</Text>
          <Text style={[styles.pct, { color: accent }]}>{Math.round(clampedPct)}%</Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { width: `${clampedPct}%`, backgroundColor: accent }]} />
        </View>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {isComplete
            ? 'Goal fully funded — nice work!'
            : `${remaining.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP to go`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  celebrateBanner: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  celebrateText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  pct: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
