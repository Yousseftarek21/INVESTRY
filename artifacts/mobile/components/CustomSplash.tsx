import React from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export function CustomSplash() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        source={require("@/assets/images/logo-mark.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.appName, { color: colors.primary }]}>INVESTRY</Text>
      <Text style={[styles.tagline, { color: colors.mutedForeground }]}>Know Your Wealth</Text>
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
    width: 140,
    height: 140,
  },
  appName: {
    marginTop: 24,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
