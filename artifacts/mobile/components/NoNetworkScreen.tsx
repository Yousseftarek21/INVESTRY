import React, { useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { useT } from "@/hooks/useTranslation";

export function NoNetworkScreen() {
  const t = useT();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    if (Platform.OS === "web") {
      // @ts-ignore
      window.location.reload();
      return;
    }
    try {
      await Updates.reloadAsync();
    } catch {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("@/assets/images/logo-mark.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>↯</Text>
      </View>

      <Text style={styles.title}>{t.noConnectionTitle}</Text>
      <Text style={styles.body}>
        {t.noConnectionMessage}
      </Text>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, retrying && styles.buttonDisabled]}
        onPress={handleRetry}
        disabled={retrying}
      >
        {retrying ? (
          <ActivityIndicator color="#121212" size="small" />
        ) : (
          <Text style={styles.buttonText}>{t.tryAgain}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121212",
    zIndex: 998,
    paddingHorizontal: 40,
  },
  logo: {
    width: 150,
    height: 43,
    opacity: 0.5,
    marginBottom: 48,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1E1E1E",
    borderWidth: 1.5,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  iconText: {
    fontSize: 28,
    color: "#C9A227",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F2F2F2",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  button: {
    backgroundColor: "#C9A227",
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 140,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#121212",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
