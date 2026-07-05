import React from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";

export function CustomSplash() {
  return (
    <View style={styles.container}>
      <Image
        source={require("@/assets/images/icon.png")}
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
    backgroundColor: "#060D1A",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    elevation: Platform.OS === "android" ? 999 : undefined,
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 28,
  },
  appName: {
    marginTop: 24,
    fontSize: 28,
    fontWeight: "700",
    color: "#D4AC0D",
    letterSpacing: 1.5,
  },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    color: "#B8B8BC",
    letterSpacing: 0.5,
  },
});
