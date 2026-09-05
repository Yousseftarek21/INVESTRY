import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  useSharedValue, useAnimatedStyle, withDelay, withRepeat, withTiming,
  Easing as REasing,
} from "react-native-reanimated";
import colors from "@/constants/colors";

interface Props {
  statusMessage?: string;
}

// Always the light-mode mark, regardless of the device's own Dark/Light
// Mode setting — matches the native launch screen (SplashScreen.storyboard),
// which was made light-only, so the two don't disagree the instant this
// JS-rendered screen takes over from it.
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
  // 0 -> BAR_MIN_H/BAR_MAX_H (shrunk), 1 -> full height. Was previously a
  // pixel height (BAR_MIN_H..BAR_MAX_H) applied straight to the `height`
  // style, which forces a native layout pass every frame, for all 5 bars,
  // at exactly the moment the UI thread is also busy mounting the rest of
  // the app at cold start — competing for the same thread is what caused
  // the visible lag. A scale factor applied via `transform` is GPU-
  // composited and never touches layout, so it stays smooth regardless of
  // what else the UI thread is doing.
  const scale = useSharedValue(BAR_MIN_H / BAR_MAX_H);

  useEffect(() => {
    // Slightly different duration per bar (not just a phase offset) so the
    // wave reads as an organic pulse rather than a uniform metronome.
    const duration = 420 + (index % 3) * 60;
    scale.value = withDelay(
      index * 90,
      withRepeat(
        withTiming(1, { duration, easing: REasing.inOut(REasing.quad) }),
        -1,
        true,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    // The bar's own height is now fixed at BAR_MAX_H (see styles.bar) and
    // scaled down visually — transform scales from the center by default,
    // so translateY re-anchors the visible bar to the track's bottom edge
    // (same "grows up from the floor" look the height-based version had).
    transform: [
      { translateY: (BAR_MAX_H * (1 - scale.value)) / 2 },
      { scaleY: scale.value },
    ],
  }));

  return (
    <View style={styles.barTrack}>
      <Reanimated.View style={[styles.bar, { backgroundColor: color }, animatedStyle]} />
    </View>
  );
}

export function CustomSplash({ statusMessage }: Props) {
  const palette = colors.light;
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

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Animated.Image
        source={LOGO_LIGHT}
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
        resizeMode="contain"
      />

      <Animated.Text
        style={[
          styles.tagline,
          { color: palette.mutedForeground, opacity: taglineIn, transform: [{ translateY: taglineTranslateY }] },
        ]}
      >
        Track All Investments. One Portfolio
      </Animated.Text>

      <Animated.View style={[styles.barsWrap, { opacity: barsIn, transform: [{ translateY: barsTranslateY }] }]}>
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <EqualizerBar key={i} index={i} color={palette.primary} />
        ))}
      </Animated.View>

      <Animated.Text style={[styles.status, { color: palette.mutedForeground, opacity: statusIn }]}>
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
    // Fixed at full height now — the pulse is done via transform: scaleY
    // in EqualizerBar's animatedStyle, not by resizing this box.
    width: BAR_W,
    height: BAR_MAX_H,
    borderRadius: BAR_W / 2,
  },
  status: {
    marginTop: 16,
    fontSize: 12,
    letterSpacing: 0.3,
    minHeight: 16,
  },
});
