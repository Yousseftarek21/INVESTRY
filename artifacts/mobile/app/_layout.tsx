import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth } from "@clerk/expo";
import type { TokenCache } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CustomSplash } from "@/components/CustomSplash";
import { HoldingsProvider } from "@/context/HoldingsContext";
import { CashProvider } from "@/context/CashContext";
import { AppSettingsProvider, useAppSettings } from "@/context/AppSettingsContext";
import { BiometricGate } from "@/components/BiometricGate";
import { SubscriptionProvider, _registerPaywallCallback } from "@/context/SubscriptionContext";
import { SubscriptionScreen } from "@/components/SubscriptionScreen";
import { useNotifications } from "@/hooks/useNotifications";
import { getApiBaseUrl } from "@/utils/api";
import * as Updates from "expo-updates";

SplashScreen.preventAutoHideAsync();

const splashStartTime = Date.now();
const MIN_SPLASH_DURATION_MS = Platform.OS === 'web' ? 0 : 2500;

const webTokenCache: TokenCache = {
  getToken: (key: string) => Promise.resolve(localStorage.getItem(key)),
  saveToken: (key: string, value: string) => {
    localStorage.setItem(key, value);
    return Promise.resolve();
  },
  clearToken: (key: string) => {
    localStorage.removeItem(key);
    return Promise.resolve();
  },
};

const nativeTokenCache: TokenCache = {
  getToken: (key: string) => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  clearToken: (key: string) => SecureStore.deleteItemAsync(key),
};

const tokenCache: TokenCache = Platform.OS === "web" ? webTokenCache : nativeTokenCache;

const queryClient = new QueryClient();

interface ClerkConfig {
  publishableKey: string;
  proxyUrl?: string;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-investment"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="cash-accounts"
        options={{ presentation: "modal", headerShown: false }}
      />
    </Stack>
  );
}

function NotificationsInitializer() {
  useNotifications();
  return null;
}

function DirectionWrapper({ children }: { children: React.ReactNode }) {
  const { language } = useAppSettings();
  return (
    <View style={{ flex: 1, direction: language === 'ar' ? 'rtl' : 'ltr' }}>
      {children}
    </View>
  );
}

function BiometricWrapper({ children }: { children: React.ReactNode }) {
  const { biometricLock } = useAppSettings();
  return <BiometricGate enabled={biometricLock}>{children}</BiometricGate>;
}

// Hides the custom splash once Clerk signals it has initialised.
// Lives inside <ClerkProvider> (useAuth works there without needing ClerkLoaded).
let _hideSplash: (() => void) | null = null;
function ClerkReadySignal() {
  const { isLoaded } = useAuth();
  useEffect(() => {
    if (isLoaded && _hideSplash) {
      _hideSplash();
      _hideSplash = null;
    }
  }, [isLoaded]);
  return null;
}

function AppWithPaywall({ children }: { children: React.ReactNode }) {
  const [paywallVisible, setPaywallVisible] = React.useState(false);

  React.useEffect(() => {
    _registerPaywallCallback(() => {
      setPaywallVisible(true);
    });
  }, []);

  return (
    <>
      <NotificationsInitializer />
      {children}
      <SubscriptionScreen
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [showCustomSplash, setShowCustomSplash] = React.useState(true);
  const [clerkConfig, setClerkConfig] = useState<ClerkConfig | null>(null);
  const [updateStatus, setUpdateStatus] = React.useState<string>('');

  // Hide the native splash immediately — our custom splash takes over from here
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Check for OTA update on launch. If one is available, show status in the
  // splash screen, download, then reload — user sees it happen, no blind wait.
  useEffect(() => {
    if (Platform.OS === 'web' || !Updates.isEnabled) return;
    (async () => {
      try {
        setUpdateStatus('Checking for updates…');
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          setUpdateStatus('Downloading update…');
          await Updates.fetchUpdateAsync();
          setUpdateStatus('Applying update…');
          await Updates.reloadAsync();
        } else {
          setUpdateStatus('');
        }
      } catch {
        setUpdateStatus('');
      }
    })();
  }, []);

  // Fetch the correct Clerk publishable key + proxy URL from the API server.
  // 5-second timeout so a slow/unreachable backend never blocks app startup.
  useEffect(() => {
    const apiBase = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Publishable keys are designed to be in client bundles — not a secret.
    // Hardcoding the live key + proxy here ensures old binaries always have a
    // working fallback via OTA even if the API fetch times out.
    const HARDCODED_LIVE_KEY = 'pk_live_Y2xlcmsuaW52c3RyeS5yZXBsaXQuYXBwJA';
    const HARDCODED_LIVE_PROXY = 'https://invstry.replit.app/api/__clerk';
    const envKey = (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim();

    const fallbackConfig: ClerkConfig = {
      publishableKey: envKey || HARDCODED_LIVE_KEY,
      proxyUrl: process.env.EXPO_PUBLIC_CLERK_PROXY_URL || HARDCODED_LIVE_PROXY,
    };

    fetch(`${apiBase}/api/config`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { clerkPublishableKey?: string; clerkProxyUrl?: string }) => {
        const key = (data.clerkPublishableKey ?? '').trim();
        setClerkConfig(
          key
            ? { publishableKey: key, proxyUrl: data.clerkProxyUrl ?? undefined }
            : fallbackConfig,
        );
      })
      .catch(() => {
        setClerkConfig(fallbackConfig);
      })
      .finally(() => clearTimeout(timeoutId));
  }, []);

  const validClerkConfig =
    clerkConfig !== null && clerkConfig.publishableKey.length > 0
      ? clerkConfig
      : null;

  // App tree requires ClerkProvider — wait until fonts + valid Clerk key ready.
  const appReady = (fontsLoaded || !!fontError) && validClerkConfig !== null;

  // Register the callback that ClerkReadySignal will call once Clerk is loaded.
  useEffect(() => {
    _hideSplash = () => {
      const elapsed = Date.now() - splashStartTime;
      const remaining = Math.max(0, MIN_SPLASH_DURATION_MS - elapsed);
      setTimeout(() => setShowCustomSplash(false), remaining);
    };
    return () => { _hideSplash = null; };
  }, []);

  // Safety net: dismiss splash after 8 s no matter what.
  // Also force-resolves clerkConfig if still pending — ensures the app tree
  // always renders and never stays on a permanent black screen.
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCustomSplash(false);
      setClerkConfig((prev) =>
        prev ?? {
          publishableKey: 'pk_live_Y2xlcmsuaW52c3RyeS5yZXBsaXQuYXBwJA',
          proxyUrl: 'https://invstry.replit.app/api/__clerk',
        },
      );
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      {showCustomSplash && <CustomSplash statusMessage={updateStatus} />}

      {appReady && validClerkConfig && (
        <ClerkProvider
          publishableKey={validClerkConfig.publishableKey}
          tokenCache={tokenCache}
          proxyUrl={validClerkConfig.proxyUrl}
        >
          {/*
           * ClerkReadySignal uses useAuth() which works inside ClerkProvider
           * without needing ClerkLoaded. We intentionally do NOT wrap the app
           * tree in <ClerkLoaded> — that component renders null until Clerk
           * finishes initialising, which caused a permanent black screen when
           * the 8s safety net fired before Clerk was ready. Instead, we let
           * the router render immediately and the auth route guards (which
           * already check isLoaded) handle the loading state gracefully.
           */}
          <ClerkReadySignal />
          <SafeAreaProvider>
            <AppSettingsProvider>
              <DirectionWrapper>
              <BiometricWrapper>
              <ErrorBoundary>
                <QueryClientProvider client={queryClient}>
                  <SubscriptionProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <KeyboardProvider>
                        <HoldingsProvider>
                          <CashProvider>
                            <AppWithPaywall>
                              <RootLayoutNav />
                            </AppWithPaywall>
                          </CashProvider>
                        </HoldingsProvider>
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                  </SubscriptionProvider>
                </QueryClientProvider>
              </ErrorBoundary>
              </BiometricWrapper>
              </DirectionWrapper>
            </AppSettingsProvider>
          </SafeAreaProvider>
        </ClerkProvider>
      )}
    </View>
  );
}
