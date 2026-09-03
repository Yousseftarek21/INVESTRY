import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  useSharedValue, useAnimatedStyle, withDelay, withRepeat, withTiming,
  Easing as REasing,
} from "react-native-reanimated";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  statusMessage?: string;
}

const LOGO_DARK = require("@/assets/images/logo-mark.png");
const LOGO_LIGHT = require("@/assets/images/logo-mark-light.png");

// ─── Equalizer bars ─────────────────────────────────────────────────────────
// Replaces an earlier hand-drawn zigzag chart-line, which drew once over a
// fixed 1.4s and then sat looking "finished" for however much longer the
// real wait took (the splash can run 1.6s-8s depending on network — see
// SPLASH_DATA_CAP_MS in _layout.tsx) — visibly wrong for an indefinite
// loading wait, on top of being a fragile animation to keep smooth (a
// multi-point SVG path drawn via strokeDashoffset). A small market-pulse
// bar wave loops for as long as the splash is mounted, which is both the
// semantically correct loading affordance and, being plain View heights
// under Reanimated worklets, one of the cheapest, most reliable things to
// animate smoothly regardless of what the JS thread is doing at launch.
const BAR_COUNT = 5;
const BAR_W = 6;
const BAR_GAP = 9;
const BAR_MAX_H = 32;
const BAR_MIN_H = 9;

function EqualizerBar({ index, color }: { index: number; color: string }) {
  const height = useSharedValue(BAR_MIN_H);

  useEffect(() => {
    // Slightly different duration per bar (not just a phase offset) so the
    // wave reads as an organic pulse rather than a uniform metronome.
    const duration = 420 + (index % 3) * 60;
    height.value = withDelay(
      index * 90,
      withRepeat(
        withTiming(BAR_MAX_H, { duration, easing: REasing.inOut(REasing.quad) }),
        -1,
        true,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <View style={styles.barTrack}>
      <Reanimated.View style={[styles.bar, { backgroundColor: color }, animatedStyle]} />
    </View>
  );
}

export function CustomSplash({ statusMessage }: Props) {
  const { resolvedTheme } = useAppSettings();
  const colors = useColors();
  const logoIn = useRef(new Animated.Value(0)).current;
  const taglineIn = useRef(new Animated.Value(0)).current;
  const barsIn = useRef(new Animated.Value(0)).current;
  const statusIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo settles first with a soft spring, then a short beat later
    // everything else (tagline, bars, status) fades in together.
    Animated.spring(logoIn, {
      toValue: 1, useNativeDriver: true,
      friction: 7, tension: 60,
    }).start();

    const REVEAL_DELAY = 150;
    Animated.timing(taglineIn, { toValue: 1, duration: 280, delay: REVEAL_DELAY, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(barsIn, { toValue: 1, duration: 280, delay: REVEAL_DELAY, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(statusIn, { toValue: 1, duration: 280, delay: REVEAL_DELAY, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [logoIn, taglineIn, barsIn, statusIn]);

  const logoOpacity = logoIn;
  const logoScale = logoIn.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const taglineTranslateY = taglineIn.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  const barsTranslateY = barsIn.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  const logoSource = resolvedTheme === "dark" ? LOGO_DARK : LOGO_LIGHT;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.Image
        source={logoSource}
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
        resizeMode="contain"
      />

      <Animated.Text
        style={[
          styles.tagline,
          { color: colors.mutedForeground, opacity: taglineIn, transform: [{ translateY: taglineTranslateY }] },
        ]}
      >
        Track All Investments. One Portfolio
      </Animated.Text>

      <Animated.View style={[styles.barsWrap, { opacity: barsIn, transform: [{ translateY: barsTranslateY }] }]}>
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <EqualizerBar key={i} index={i} color={colors.primary} />
        ))}
      </Animated.View>

      <Animated.Text style={[styles.status, { color: colors.mutedForeground, opacity: statusIn }]}>
        {statusMessage ?? ""}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    elevation: Platform.OS === "android" ? 999 : undefined,
  },
  // Icon-only now (no wordmark baked into the image) — square box instead
  // of the old wide 260x40 wordmark banner. resizeMode="contain" on the
  // <Image> keeps it centered regardless of the source PNG's exact aspect.
  logo: {
    width: 96,
    height: 96,
  },
  tagline: {
    marginTop: 10,
    maxWidth: 230,
    fontSize: 13,
    letterSpacing: 0.4,
    textAlign: "center",
  },
  barsWrap: {
    marginTop: 48,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: BAR_GAP,
    height: BAR_MAX_H,
  },
  barTrack: {
    width: BAR_W,
    height: BAR_MAX_H,
    justifyContent: "flex-end",
  },
  bar: {
    width: BAR_W,
    borderRadius: BAR_W / 2,
  },
  status: {
    marginTop: 16,
    fontSize: 12,
    letterSpacing: 0.3,
    minHeight: 16,
  },
});
