import React, { useEffect, useRef } from "react";
import { Animated, Image, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
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
const CHART_W = 160;
const CHART_H = 36;
const CHART_POINTS = [
  [0, 28], [32, 22], [64, 26], [96, 14], [128, 18], [160, 6],
] as const;
const CHART_PATH = CHART_POINTS.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
const CHART_PATH_LENGTH = 170; // approx length of the segments above, with margin

export function CustomSplash({ statusMessage }: Props) {
  const { resolvedTheme } = useAppSettings();
  const colors = useColors();
  const progress = useRef(new Animated.Value(0)).current;
  const logoIn = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(logoIn, {
      toValue: 1,
      duration: 550,
      useNativeDriver: true,
    }).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: 2200,
      useNativeDriver: false,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 1100, useNativeDriver: true }),
      ]),
    ).start();
  }, [progress, logoIn, glow]);

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
  const logoScale = logoIn.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const logoTranslateY = logoIn.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.logoWrap}>
        <Animated.View style={[styles.logoGlow, { backgroundColor: colors.primary, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] }) }]} />
        <Animated.Image
          source={resolvedTheme === "dark" ? LOGO_DARK : LOGO_LIGHT}
          style={[
            styles.logo,
            { opacity: logoOpacity, transform: [{ scale: logoScale }, { translateY: logoTranslateY }] },
          ]}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.tagline, { color: colors.mutedForeground }]}>All Investments. One Place.</Text>

      <View style={styles.chartWrap}>
        <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
          <Path
            d={CHART_PATH}
            stroke={colors.secondary}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <AnimatedPath
            d={CHART_PATH}
            stroke={colors.primary}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CHART_PATH_LENGTH}
            strokeDashoffset={strokeDashoffset}
          />
          <AnimatedCircle
            cx={CHART_POINTS[CHART_POINTS.length - 1][0]}
            cy={CHART_POINTS[CHART_POINTS.length - 1][1]}
            r={3.5}
            fill={colors.primary}
            opacity={dotOpacity}
          />
        </Svg>
      </View>

      <Text style={[styles.status, { color: colors.mutedForeground }]}>
        {statusMessage ?? ""}
      </Text>
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
  logoGlow: {
    position: "absolute",
    width: 220,
    height: 90,
    borderRadius: 45,
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
