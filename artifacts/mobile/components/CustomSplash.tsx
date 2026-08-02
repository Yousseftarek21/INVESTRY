import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  useSharedValue, useAnimatedProps, withDelay, withTiming,
  Easing as REasing, interpolate as rInterpolate, Extrapolation,
} from "react-native-reanimated";
import Svg, { Path, Circle } from "react-native-svg";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  statusMessage?: string;
}

const LOGO_DARK = require("@/assets/images/logo-mark.png");
const LOGO_LIGHT = require("@/assets/images/logo-mark-light.png");

// The chart-line draw specifically uses Reanimated, not the classic Animated
// API used everywhere else on this screen — react-native's "native driver"
// flag reliably covers opacity/transform (used for the logo/tagline/status
// fades below) but doesn't reliably keep SVG's strokeDashoffset off the JS
// thread the same way, which is what was causing this one animation to
// visibly stutter during the heavy JS-thread startup work (fonts, contexts,
// AsyncStorage/API reads) that's running at the same time. Reanimated
// worklets run on the UI thread regardless of what the JS thread is doing.
const RAnimatedPath = Reanimated.createAnimatedComponent(Path);
const RAnimatedCircle = Reanimated.createAnimatedComponent(Circle);

// A small "chart line" drawn left-to-right as loading progresses, instead of
// a generic bar — echoes the app's own portfolio charts. Straight segments
// over a fixed set of points (up-with-volatility, not a boring straight
// climb) approximated to a path length used for the stroke-draw animation.
const CHART_W = 176;
const CHART_H = 40;
const CHART_POINTS = [
  [0, 30], [35, 23], [70, 28], [106, 15], [141, 20], [176, 6],
] as const;
const CHART_PATH = CHART_POINTS.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
const CHART_PATH_LENGTH = 190; // approx length of the segments above, with margin

export function CustomSplash({ statusMessage }: Props) {
  const { resolvedTheme } = useAppSettings();
  const colors = useColors();
  const progress = useSharedValue(0);
  const logoIn = useRef(new Animated.Value(0)).current;
  const taglineIn = useRef(new Animated.Value(0)).current;
  const chartIn = useRef(new Animated.Value(0)).current;
  const statusIn = useRef(new Animated.Value(0)).current;

  const REVEAL_DELAY = 150;

  useEffect(() => {
    // Logo settles first with a soft spring, then a short beat later
    // everything else (tagline, chart, status) fades in together — and the
    // chart line's fade-in and its draw-in share that same start time, so it
    // never appears partway-drawn the moment it becomes visible.
    Animated.spring(logoIn, {
      toValue: 1, useNativeDriver: true,
      friction: 7, tension: 60,
    }).start();

    Animated.timing(taglineIn, { toValue: 1, duration: 280, delay: REVEAL_DELAY, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(chartIn, { toValue: 1, duration: 280, delay: REVEAL_DELAY, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(statusIn, { toValue: 1, duration: 280, delay: REVEAL_DELAY, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();

    // Linear, not eased — the zigzag's segments are uneven lengths (steep
    // "up" jumps vs. flatter stretches), so an eased curve made the draw
    // speed visibly change mid-animation on top of the geometry already
    // doing that; constant speed reads as one smooth stroke instead.
    progress.value = withDelay(REVEAL_DELAY, withTiming(1, { duration: 1400, easing: REasing.linear }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoIn, taglineIn, chartIn, statusIn]);

  const pathAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CHART_PATH_LENGTH * (1 - progress.value),
  }));
  const dotAnimatedProps = useAnimatedProps(() => ({
    opacity: rInterpolate(progress.value, [0, 0.85, 1], [0, 0, 1], Extrapolation.CLAMP),
  }));
  const logoOpacity = logoIn;
  const logoScale = logoIn.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const taglineTranslateY = taglineIn.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  const chartTranslateY = chartIn.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
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

      <Animated.View style={[styles.chartWrap, { opacity: chartIn, transform: [{ translateY: chartTranslateY }] }]}>
        <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
          <RAnimatedPath
            d={CHART_PATH}
            stroke={colors.primary}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CHART_PATH_LENGTH}
            animatedProps={pathAnimatedProps}
          />
          <RAnimatedCircle
            cx={CHART_POINTS[CHART_POINTS.length - 1][0]}
            cy={CHART_POINTS[CHART_POINTS.length - 1][1]}
            r={4}
            fill={colors.primary}
            animatedProps={dotAnimatedProps}
          />
        </Svg>
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
  logo: {
    width: 260,
    height: 40,
  },
  tagline: {
    marginTop: 10,
    maxWidth: 230,
    fontSize: 13,
    letterSpacing: 0.4,
    textAlign: "center",
  },
  chartWrap: {
    marginTop: 48,
  },
  status: {
    marginTop: 16,
    fontSize: 12,
    letterSpacing: 0.3,
    minHeight: 16,
  },
});
