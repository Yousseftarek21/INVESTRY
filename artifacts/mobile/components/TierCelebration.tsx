import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { TierChange } from '@/hooks/usePortfolioTier';
import { TierId } from '@/utils/portfolioTier';
import { TierSeal, TIER_ACCENT } from '@/components/TierSeal';

export function tierName(id: TierId, t: ReturnType<typeof useT>): string {
  switch (id) {
    case 'core': return t.tierCoreName;
    case 'plus': return t.tierPlusName;
    case 'wealth': return t.tierWealthName;
  }
}

// Core's ice blue and Plus's violet are dark/medium enough for white text;
// Wealth's accent is the bright gold itself, which needs dark text the same
// way the membership card's black-and-gold treatment does.
function btnTextOnAccent(id: TierId | undefined): string {
  return id === 'wealth' ? '#241a02' : '#ffffff';
}

const BURST_SIZE = 160;
const RAY_COUNT = 16;

/**
 * Soft radial glow + a ring of struck rays behind the seal — the "spotlight"
 * a small flat icon can't provide on its own. One static burst, not a
 * spinner: it pops in with the seal (see `reveal` below) and holds, rather
 * than looping, so the moment reads as arrived rather than ongoing.
 */
function Burst({ color, reveal }: { color: string; reveal: Animated.Value }) {
  const rays = Array.from({ length: RAY_COUNT }, (_, i) => {
    const angle = (i / RAY_COUNT) * 2 * Math.PI;
    const long = i % 2 === 0;
    const inner = long ? 46 : 52;
    const outer = long ? 78 : 66;
    const cx = BURST_SIZE / 2;
    const cy = BURST_SIZE / 2;
    return {
      key: i,
      x1: cx + Math.cos(angle) * inner,
      y1: cy + Math.sin(angle) * inner,
      x2: cx + Math.cos(angle) * outer,
      y2: cy + Math.sin(angle) * outer,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: BURST_SIZE,
        height: BURST_SIZE,
        opacity: reveal,
        transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
      }}
    >
      <Svg width={BURST_SIZE} height={BURST_SIZE} viewBox={`0 0 ${BURST_SIZE} ${BURST_SIZE}`}>
        <Defs>
          <RadialGradient id="burstGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.38} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={BURST_SIZE / 2} cy={BURST_SIZE / 2} r={BURST_SIZE / 2} fill="url(#burstGlow)" />
        {rays.map(r => (
          <Line key={r.key} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={color} strokeWidth={2} strokeLinecap="round" strokeOpacity={0.5} />
        ))}
      </Svg>
    </Animated.View>
  );
}

/**
 * Shown once when the user's tier changes, in both directions.
 *
 * A demotion gets the same moment as a promotion by explicit product
 * decision — the tier is meant to be maintained, so losing it has to
 * register. What it does not get is the same *tone*: no red, no down-arrow,
 * no "you lost" copy. It states the new tier and what it takes to get back,
 * because the user just watched their portfolio fall and doesn't need the
 * app to press on it. The number already told them.
 */
export function TierCelebration({
  change,
  onDismiss,
  returnHint,
}: {
  change: TierChange | null;
  onDismiss: () => void;
  /** e.g. "1.2M EGP to return to your previous tier" — omitted on promotion. */
  returnHint?: string;
}) {
  const colors = useColors();
  const t = useT();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const sealPop = useRef(new Animated.Value(0.4)).current;
  const burstReveal = useRef(new Animated.Value(0)).current;

  const promoted = change?.promoted ?? false;
  // A promotion glows in the *new* tier's own color — ice blue, violet, or
  // gold — so the burst and the seal it surrounds read as one object, not
  // a generic gold flourish stamped on every tier. A demotion is
  // deliberately neutral instead — muted, not red. Red is for losses the
  // user needs to act on, and this isn't one.
  const accent = promoted ? (change?.to ? TIER_ACCENT[change.to.id] : colors.primary) : colors.mutedForeground;

  useEffect(() => {
    if (!change) return;
    if (Platform.OS !== 'web') {
      // Success on the way up, a soft tap on the way down — the haptic
      // shouldn't feel like an error either.
      if (promoted) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    scale.setValue(0.85);
    opacity.setValue(0);
    shine.setValue(0);
    sealPop.setValue(0.4);
    burstReveal.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      // The seal itself lands a beat after the card, with more bounce than
      // the card's own settle — the one element in the room that's allowed
      // to overshoot, because it's the thing being celebrated.
      Animated.sequence([
        Animated.delay(80),
        Animated.spring(sealPop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      ]),
      Animated.timing(burstReveal, { toValue: 1, duration: 380, delay: 80, useNativeDriver: true }),
    ]).start();
    // The sweep only runs on a promotion: it's the celebratory flourish, and
    // running it on a demotion would read as celebrating the drop.
    if (promoted) {
      Animated.timing(shine, {
        toValue: 1, duration: 1100, delay: 260,
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      }).start();
    }
  }, [change, promoted, scale, opacity, shine, sealPop, burstReveal]);

  if (!change) return null;

  // `to` is a real tier both on a promotion and on a demotion that still
  // lands on one (Wealth -> Plus, Plus -> Core) — either way the user
  // genuinely holds it now, so its seal shows in that tier's own true
  // colors, not a diminished version of the one before it. `to` is only
  // null when net worth has dropped back under Core's 100k floor entirely,
  // the one case with no tier — and no seal — to show.
  const name = change.to ? tierName(change.to.id, t) : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <Animated.View
          style={[
            s.card,
            { backgroundColor: colors.card, borderColor: accent + '40', opacity, transform: [{ scale }] },
          ]}
        >
          {/* Radial wash tinted with the accent — the card reads as lit from
              behind the seal rather than a flat panel with an icon glued on. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: accent + (promoted ? '0D' : '08') }]} />

          {/* Same angled sweep the hero uses on a million-milestone, so the
              two celebrations on this screen feel like one family. */}
          {promoted && (
            <Animated.View
              pointerEvents="none"
              style={[
                s.sweep,
                {
                  backgroundColor: accent + '1F',
                  transform: [
                    { rotate: '18deg' },
                    { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-220, 260] }) },
                  ],
                },
              ]}
            />
          )}

          <View style={s.sealStage}>
            <Burst color={accent} reveal={burstReveal} />
            {/* The exact same seal the avatar and the card show for
                whichever tier `to` actually is — real colors either way,
                since landing here means genuinely holding it. Only when
                there's no tier left at all does a seal give way to a plain
                neutral mark. */}
            <Animated.View style={{ transform: [{ scale: sealPop }] }}>
              {change.to ? (
                <TierSeal size={76} tier={change.to.id} />
              ) : (
                <View style={[s.noTierMark, { borderColor: colors.mutedForeground + '55' }]}>
                  <Feather name="circle" size={30} color={colors.mutedForeground} />
                </View>
              )}
            </Animated.View>
          </View>

          <Text style={[s.eyebrow, { color: colors.mutedForeground }]}>
            {promoted ? t.tierReachedTitle : t.tierLostTitle}
          </Text>
          {!!name && (
            <Text style={[s.tierName, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {name}
            </Text>
          )}
          <Text style={[s.body, { color: colors.textSecondary }]}>
            {promoted && name ? t.tierReachedBody(name) : name ? t.tierLostBody(name) : t.tierNoneBody}
          </Text>

          {!promoted && !!returnHint && (
            <View style={[s.hintPill, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[s.hint, { color: colors.text }]}>{returnHint}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={onDismiss}
            activeOpacity={0.85}
            style={[s.btn, { backgroundColor: promoted ? accent : colors.muted }]}
          >
            <Text style={[s.btnTxt, { color: promoted ? btnTextOnAccent(change.to?.id) : colors.text }]}>
              {t.tierCelebrateDismiss}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 340, borderRadius: 28, borderWidth: 1,
    paddingHorizontal: 26, paddingTop: 20, paddingBottom: 24,
    alignItems: 'center', gap: 10, overflow: 'hidden',
  },
  sweep: { position: 'absolute', top: -60, bottom: -60, width: 70 },
  sealStage: { width: BURST_SIZE, height: BURST_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: -6 },
  noTierMark: { width: 76, height: 76, borderRadius: 38, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11.5, fontFamily: 'Inter_700Bold', letterSpacing: 1.6, textTransform: 'uppercase' },
  tierName: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
  body: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  hintPill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, marginTop: 2 },
  hint: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  btn: { alignSelf: 'stretch', paddingVertical: 14, borderRadius: 15, alignItems: 'center', marginTop: 14 },
  btnTxt: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
