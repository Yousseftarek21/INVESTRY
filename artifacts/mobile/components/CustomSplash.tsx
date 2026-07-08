import React, { useEffect, useRef } from "react";
import { Animated, Image, Platform, StyleSheet, Text, View } from "react-native";

export function CustomSplash() {
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
    <View style={styles.container}>
      <Image
        source={require("@/assets/images/logo-mark.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.appName}>INVESTRY</Text>
      <Text style={styles.tagline}>Know Your Wealth</Text>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121212",
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
    color: "#1ABBA9",
  },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    letterSpacing: 0.5,
    color: "#8E8E93",
  },
  barTrack: {
    marginTop: 48,
    width: 160,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#2C2C2E",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#1ABBA9",
  },
});
