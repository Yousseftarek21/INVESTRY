import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { TierChange } from '@/hooks/usePortfolioTier';
import { TierId } from '@/utils/portfolioTier';
import { TIER_ACCENT } from '@/components/TierSeal';
import { TIER_GRADIENT, TIER_TEXT, WEALTH_ACCENT_LINE } from '@/components/TierCard';

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

const GLOW_SIZE = 300;

/**
 * Soft radial glow behind the card — the "spotlight" a flat panel can't
 * provide on its own. Pops in with the card and holds, rather than looping,
 * so the moment reads as arrived rather than ongoing.
 */
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
          <RadialGradient id="tierGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.1} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#tierGlow)" />
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
 *
 * Centerpiece is the actual membership card (see TierCard) rather than the
 * small circular seal — the same gradient/chip/embossed-name/shine
 * construction, at celebration size, so unlocking a tier and opening its
 * card afterward feel like the same object, not two different visual
 * languages for one idea.
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
  const cardPop = useRef(new Animated.Value(0.5)).current;
  const glowReveal = useRef(new Animated.Value(0)).current;

  const promoted = change?.promoted ?? false;
  // A promotion glows in the *new* tier's own color — ice blue, violet, or
  // gold — so the glow and the card it surrounds read as one object, not a
  // generic gold flourish stamped on every tier. A demotion is deliberately
  // neutral instead — muted, not red. Red is for losses the user needs to
  // act on, and this isn't one.
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
    cardPop.setValue(0.5);
    glowReveal.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      // The card itself lands a beat after the sheet, with more bounce than
      // the sheet's own settle — the one element in the room that's allowed
      // to overshoot, because it's the thing being celebrated.
      Animated.sequence([
        Animated.delay(80),
        Animated.spring(cardPop, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      ]),
      Animated.timing(glowReveal, { toValue: 1, duration: 380, delay: 80, useNativeDriver: true }),
    ]).start();
    // The sweep only runs on a promotion: it's the celebratory flourish, and
    // running it on a demotion would read as celebrating the drop.
    if (promoted) {
      Animated.timing(shine, {
        toValue: 1, duration: 1200, delay: 320,
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      }).start();
    }
  }, [change, promoted, scale, opacity, shine, cardPop, glowReveal]);

  if (!change) return null;

  // `to` is a real tier both on a promotion and on a demotion that still
  // lands on one (Wealth -> Plus, Plus -> Core) — either way the user
  // genuinely holds it now, so its card shows in that tier's own true
  // colors, not a diminished version of the one before it. `to` is only
  // null when net worth has dropped back under Core's own floor entirely,
  // the one case with no tier — and no card — to show.
  const name = change.to ? tierName(change.to.id, t) : null;
  const onCard = change.to ? TIER_TEXT[change.to.id] : '#ffffff';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <Animated.View style={[s.sheet, { opacity, transform: [{ scale }] }]}>
          <Text style={[s.eyebrow, { color: colors.mutedForeground }]}>
            {promoted ? t.tierReachedTitle : t.tierLostTitle}
          </Text>

          <View style={s.cardStage}>
            <Glow color={accent} reveal={glowReveal} />
            <Animated.View style={{ width: '100%', transform: [{ scale: cardPop }] }}>
              {change.to ? (
                <View style={s.cardShadowWrap}>
                  <LinearGradient
                    colors={TIER_GRADIENT[change.to.id]}
                    start={{ x: 0.05, y: 0 }}
                    end={{ x: 0.95, y: 1 }}
                    style={s.card}
                  >
                    <LinearGradient
                      colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.32)']}
                      style={StyleSheet.absoluteFillObject}
                      pointerEvents="none"
                    />
                    {promoted && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          s.sweep,
                          {
                            transform: [
                              { rotate: '18deg' },
                              { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-220, 280] }) },
                            ],
                          },
                        ]}
                      />
                    )}

                    <View style={s.cardTopRow}>
                      <Text style={[s.issuer, { color: onCard }]}>INVESTRY</Text>
                      <Feather name="wifi" size={17} color={onCard} style={{ opacity: 0.85, transform: [{ rotate: '90deg' }] }} />
                    </View>

                    <View style={s.chip}>
                      <View style={[s.chipLine, { backgroundColor: onCard + '55' }]} />
                      <View style={[s.chipLine, { backgroundColor: onCard + '55' }]} />
                    </View>

                    {change.to.id === 'wealth' && (
                      <LinearGradient
                        colors={WEALTH_ACCENT_LINE}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.accentLine}
                      />
                    )}

                    <Text style={[s.cardTierName, { color: onCard }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {name}
                    </Text>
                  </LinearGradient>
                </View>
              ) : (
                <View style={[s.noTierMark, { borderColor: colors.mutedForeground + '55' }]}>
                  <Feather name="circle" size={30} color={colors.mutedForeground} />
                </View>
              )}
            </Animated.View>
          </View>

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
  sheet: { width: '100%', maxWidth: 360, alignItems: 'center', gap: 14 },
  eyebrow: { fontSize: 11.5, fontFamily: 'Inter_700Bold', letterSpacing: 1.6, textTransform: 'uppercase' },

  cardStage: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  cardShadowWrap: {
    width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.4, shadowRadius: 24,
  },
  card: {
    borderRadius: 22, padding: 20, aspectRatio: 1.65, width: '100%',
    justifyContent: 'space-between', overflow: 'hidden',
  },
  sweep: { position: 'absolute', top: -80, bottom: -80, width: 90, backgroundColor: 'rgba(255,255,255,0.16)' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  issuer: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 2.2 },
  chip: { width: 30, height: 22, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', padding: 3.5, justifyContent: 'space-evenly' },
  chipLine: { height: 1.5, borderRadius: 1 },
  accentLine: { height: 2, borderRadius: 1, opacity: 0.9, marginBottom: 6 },
  cardTierName: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },

  noTierMark: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  body: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  hintPill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  hint: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  btn: { alignSelf: 'stretch', paddingVertical: 14, borderRadius: 15, alignItems: 'center', marginTop: 4 },
  btnTxt: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
