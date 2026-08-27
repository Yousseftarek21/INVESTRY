import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';

const GLOW_SIZE = 260;
const CONFETTI_COUNT = 14;

// Same radial "spotlight" construction as TierCelebration's Glow, kept
// local rather than shared — the two moments look related on purpose (same
// visual language for "you reached something") but aren't the same event
// and shouldn't be coupled through one shared component.
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
          <RadialGradient id="goalGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#goalGlow)" />
      </Svg>
    </Animated.View>
  );
}

// A handful of small squares fired outward from the badge on a spring, not a
// full particle system — enough to read as "confetti" without the cost or
// risk of a real physics-driven burst. Fixed angles/distances computed once
// per mount so every celebration looks the same rather than jittering.
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

/**
 * Fires once, the instant a deposit or edit takes a goal from not-yet-there
 * to fully funded — the goals list itself only ever showed a flat "Goal
 * achieved!" label, treating a real milestone the same as any other list
 * state. Triggered by the state transition at the moment of the save (see
 * goals.tsx), not by re-deriving "is this done" on every render, so it
 * shows exactly once per completion rather than every time the screen
 * happens to render with the goal already sitting at 100%.
 */
export function GoalCelebration({ goalName, onDismiss }: { goalName: string | null; onDismiss: () => void }) {
  const colors = useColors();
  const t = useT();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const badgePop = useRef(new Animated.Value(0.4)).current;
  const glowReveal = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!goalName) return;
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
  }, [goalName, scale, opacity, badgePop, glowReveal, burst]);

  if (!goalName) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <Animated.View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border, opacity, transform: [{ scale }] }]}>
          <Text style={[s.eyebrow, { color: colors.mutedForeground }]}>{t.goalCelebrateEyebrow}</Text>

          <View style={s.stage}>
            <Glow color={colors.primary} reveal={glowReveal} />
            <View style={s.confettiAnchor}>
              <Confetti color={colors.primary} burst={burst} />
            </View>
            <Animated.View style={[s.badge, { backgroundColor: colors.primary, transform: [{ scale: badgePop }] }]}>
              <Feather name="award" size={40} color={colors.primaryForeground} />
            </Animated.View>
          </View>

          <Text style={[s.name, { color: colors.text }]} numberOfLines={2}>{goalName}</Text>
          <Text style={[s.body, { color: colors.textSecondary }]}>{t.goalCelebrateBody(goalName)}</Text>

          <TouchableOpacity
            onPress={onDismiss}
            activeOpacity={0.85}
            style={[s.btn, { backgroundColor: colors.primary }]}
          >
            <Text style={[s.btnTxt, { color: colors.primaryForeground }]}>{t.goalCelebrateDismiss}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  sheet: { width: '100%', maxWidth: 340, alignItems: 'center', gap: 12, borderRadius: 24, borderWidth: 1, padding: 26 },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.6, textTransform: 'uppercase' },

  stage: { width: GLOW_SIZE, height: 140, alignItems: 'center', justifyContent: 'center' },
  confettiAnchor: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
  badge: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },

  name: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 4 },
  body: { fontSize: 13.5, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, paddingHorizontal: 4 },

  btn: { alignSelf: 'stretch', paddingVertical: 14, borderRadius: 15, alignItems: 'center', marginTop: 8 },
  btnTxt: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
