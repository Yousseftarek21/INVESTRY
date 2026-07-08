import React from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";

export function CustomSplash() {
  return (
    <View style={styles.container}>
      <Image
        source={require("@/assets/images/logo-mark.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.appName}>INVESTRY</Text>
      <Text style={styles.tagline}>Know Your Wealth</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#060D1A",
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
    color: "#D4AC0D",
  },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    letterSpacing: 0.5,
    color: "#6B7F96",
  },
});
