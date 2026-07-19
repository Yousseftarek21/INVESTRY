import React, { useEffect, useRef } from "react";
import { Animated, Image, Platform, StyleSheet, Text, View } from "react-native";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  statusMessage?: string;
}

const LOGO_DARK = require("@/assets/images/logo-mark.png");
const LOGO_LIGHT = require("@/assets/images/logo-mark-light.png");

export function CustomSplash({ statusMessage }: Props) {
  const { resolvedTheme } = useAppSettings();
  const colors = useColors();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 2200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        source={resolvedTheme === "dark" ? LOGO_DARK : LOGO_LIGHT}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.tagline, { color: colors.mutedForeground }]}>All Investments. One Place.</Text>

      <View style={[styles.barTrack, { backgroundColor: colors.secondary }]}>
        <Animated.View style={[styles.barFill, { width: barWidth, backgroundColor: colors.primary }]} />
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
  logo: {
    width: 260,
    height: 74,
  },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  barTrack: {
    marginTop: 48,
    width: 160,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
  status: {
    marginTop: 16,
    fontSize: 12,
    letterSpacing: 0.3,
    minHeight: 16,
  },
});
