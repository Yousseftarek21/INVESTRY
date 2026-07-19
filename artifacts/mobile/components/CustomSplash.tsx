import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  statusMessage?: string;
}

const LOGO_DARK = require("@/assets/images/logo-mark.png");
const LOGO_LIGHT = require("@/assets/images/logo-mark-light.png");

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

const GLOW_SIZE = 240;

export function CustomSplash({ statusMessage }: Props) {
  const { resolvedTheme } = useAppSettings();
  const colors = useColors();
  const progress = useRef(new Animated.Value(0)).current;
  const logoIn = useRef(new Animated.Value(0)).current;
  const taglineIn = useRef(new Animated.Value(0)).current;
  const chartIn = useRef(new Animated.Value(0)).current;
  const statusIn = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // A cascading reveal — logo settles in with a soft spring, then the
    // tagline, chart, and status fade in one after another, instead of
    // everything appearing at once.
    Animated.sequence([
      Animated.spring(logoIn, {
        toValue: 1, useNativeDriver: true,
        friction: 7, tension: 60,
      }),
      Animated.stagger(120, [
        Animated.timing(taglineIn, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(chartIn, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(statusIn, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: 2000,
      delay: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.4, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [progress, logoIn, taglineIn, chartIn, statusIn, glow]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CHART_PATH_LENGTH, 0],
  });
  const dotOpacity = progress.interpolate({
    inputRange: [0, 0.85, 1],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });
  const logoOpacity = logoIn;
  const logoScale = logoIn.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const taglineTranslateY = taglineIn.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  const chartTranslateY = chartIn.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  const logoSource = resolvedTheme === "dark" ? LOGO_DARK : LOGO_LIGHT;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.logoWrap}>
        <Animated.View style={[styles.glowWrap, { opacity: glow }]}>
          <Svg width={GLOW_SIZE} height={GLOW_SIZE} viewBox={`0 0 ${GLOW_SIZE} ${GLOW_SIZE}`}>
            <Defs>
              <RadialGradient id="splashGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.28} />
                <Stop offset="60%" stopColor={colors.primary} stopOpacity={0.08} />
                <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#splashGlow)" />
          </Svg>
        </Animated.View>
        <Animated.Image
          source={logoSource}
          style={[
            styles.logo,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
          resizeMode="contain"
        />
      </View>

      <Animated.Text
        style={[
          styles.tagline,
          { color: colors.mutedForeground, opacity: taglineIn, transform: [{ translateY: taglineTranslateY }] },
        ]}
      >
        All Investments. One Place.
      </Animated.Text>

      <Animated.View style={[styles.chartWrap, { opacity: chartIn, transform: [{ translateY: chartTranslateY }] }]}>
        <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
          <AnimatedPath
            d={CHART_PATH}
            stroke={colors.primary}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CHART_PATH_LENGTH}
            strokeDashoffset={strokeDashoffset}
          />
          <AnimatedCircle
            cx={CHART_POINTS[CHART_POINTS.length - 1][0]}
            cy={CHART_POINTS[CHART_POINTS.length - 1][1]}
            r={4}
            fill={colors.primary}
            opacity={dotOpacity}
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
  logoWrap: {
    width: 260,
    height: 74,
    alignItems: "center",
    justifyContent: "center",
  },
  glowWrap: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 260,
    height: 74,
  },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    letterSpacing: 0.5,
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
