import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useSubscription } from '@/context/SubscriptionContext';

interface LockedFeatureCardProps {
  feature: string;
  description: string;
  /** Fills the screen instead of sitting as an inline card — for a screen
   * that's entirely gated (e.g. AI Assistant) rather than one section of one. */
  fullScreen?: boolean;
  /** Set when this card renders on a screen presented via expo-router's
   * `presentation: "modal"` (e.g. app/ai-assistant.tsx) — confirmed live
   * that opening the Paywall's own Modal directly from on top of one of
   * those silently fails to appear (state updates, nothing renders; see
   * showPaywallFromModal's own comment in SubscriptionContext.tsx for how
   * that was traced). Dismisses the current screen first, same fix used at
   * every other gate reached from a modal screen. Screens that aren't
   * modal-presented (Settings > Notifications, the Analytics tab) leave
   * this unset — showPaywall works fine there, and dismissing would be a
   * wrong, unwanted navigation. */
  fromModalScreen?: boolean;
}

const GLOW_SIZE = 92;

// A true radial gradient (react-native-svg) — same construction as
// GoalCelebration.tsx/TierCelebration's own Glow.
function IconGlow({ color }: { color: string }) {
  return (
    <View style={s.glowWrap} pointerEvents="none">
      <Svg width={GLOW_SIZE} height={GLOW_SIZE} viewBox={`0 0 ${GLOW_SIZE} ${GLOW_SIZE}`}>
        <Defs>
          <RadialGradient id="lockGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.15} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#lockGlow)" />
      </Svg>
    </View>
  );
}

// The one locked-state treatment every gate in the app uses — replaces both
// the old inline "Upgrade to PRO" card style and any one-off per-screen
// lock UI. Always opens the same Paywall modal, via showPaywall() or
// showPaywallFromModal() depending on fromModalScreen.
//
// Full card treatment, not just a decorated icon: a gold foil ribbon (same
// language as the Paywall's own price card), a two-tone gradient seal for
// the lock instead of a flat tinted circle, a one-time shine sweep on
// mount, and a gold-cast border/background wash so the card itself reads
// as "something premium sits behind this" from a glance, not just its CTA.
export function LockedFeatureCard({ feature, description, fullScreen, fromModalScreen }: LockedFeatureCardProps) {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const { showPaywall, showPaywallFromModal } = useSubscription();

  const shine = useRef(new Animated.Value(0)).current;
  const sealPop = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.spring(sealPop, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    Animated.timing(shine, {
      toValue: 1, duration: 1200, delay: 200,
      easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
    // Mount-once — this component remounts per screen visit anyway (it's
    // never kept alive across navigations), so no dependency array needed
    // beyond the animated values themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPress = () => { impact(); (fromModalScreen ? showPaywallFromModal : showPaywall)(); };

  return (
    <View style={[s.wrap, fullScreen && s.wrapFullScreen]}>
      <View style={[s.card, { borderColor: colors.primary + '35' }]}>
        <LinearGradient
          colors={[colors.primary + '1C', colors.card, colors.card]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            s.sweep,
            {
              transform: [
                { rotate: '20deg' },
                { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-220, 340] }) },
              ],
            },
          ]}
        />

        <View style={[s.ribbon, { backgroundColor: colors.primary }]}>
          <Feather name="star" size={9} color="#2b2308" />
          <Text style={s.ribbonText}>{t.subComparePro}</Text>
        </View>

        <Animated.View style={[s.iconStage, { transform: [{ scale: sealPop }] }]}>
          <IconGlow color={colors.primary} />
          <LinearGradient
            colors={[colors.primary, '#8a6a1c']}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={s.iconSeal}
          >
            <View style={s.iconSealRing} />
            <Feather name="lock" size={22} color="#2b2308" />
          </LinearGradient>
        </Animated.View>

        <Text style={[s.title, { color: colors.text }]}>{feature}</Text>
        <Text style={[s.desc, { color: colors.mutedForeground }]}>{description}</Text>

        <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={s.ctaShadow}>
          <LinearGradient
            colors={[colors.primary, '#C79A2E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.cta}
          >
            <Feather name="star" size={14} color="#2b2308" />
            <Text style={s.ctaText}>{t.subUpgradeTo} {t.subComparePro}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingVertical: 4 },
  wrapFullScreen: { flex: 1, justifyContent: 'center', paddingHorizontal: 4 },

  card: {
    alignItems: 'center', gap: 8,
    borderRadius: 22, borderWidth: 1.5,
    paddingVertical: 30, paddingHorizontal: 24,
    overflow: 'hidden',
  },
  sweep: { position: 'absolute', top: -100, bottom: -100, width: 90, backgroundColor: 'rgba(255,255,255,0.08)' },

  ribbon: {
    position: 'absolute', top: 14, end: 14,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
  },
  ribbonText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#2b2308', textTransform: 'uppercase', letterSpacing: 0.5 },

  iconStage: { width: GLOW_SIZE, height: GLOW_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 4, marginTop: 6 },
  glowWrap: { position: 'absolute' },
  iconSeal: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  iconSealRing: {
    position: 'absolute', width: 52, height: 52, borderRadius: 26,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },

  title: { fontSize: 17, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  desc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19, marginBottom: 8, paddingHorizontal: 4 },

  // The shadow lives on its own wrapper — shadows and a LinearGradient
  // fill don't compose cleanly on the same view.
  ctaShadow: {
    alignSelf: 'stretch', borderRadius: 14,
    shadowColor: '#C79A2E', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 14, borderRadius: 14,
  },
  ctaText: { fontSize: 14.5, fontFamily: 'Inter_700Bold', color: '#2b2308' },
});
