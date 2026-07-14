import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, ClerkLoaded } from "@clerk/expo";
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
  // The production server holds the pk_live_ key (auto-provisioned by Replit
  // at deploy time). Baking the dev pk_test_ key into the EAS build would make
  // the TestFlight app talk to the wrong Clerk instance and crash on auth.
  useEffect(() => {
    const apiBase = getApiBaseUrl();
    fetch(`${apiBase}/api/config`)
      .then((r) => r.json())
      .then((data: { clerkPublishableKey?: string; clerkProxyUrl?: string }) => {
        const key = (data.clerkPublishableKey ?? '').trim();
        if (key) {
          setClerkConfig({
            publishableKey: key,
            proxyUrl: data.clerkProxyUrl ?? undefined,
          });
        } else {
          // Fallback: use the env var (works in Expo Go / dev builds)
          setClerkConfig({
            publishableKey: (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim(),
            proxyUrl: process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined,
          });
        }
      })
      .catch(() => {
        // Network error — fall back to env var so dev / offline still works
        setClerkConfig({
          publishableKey: (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim(),
          proxyUrl: process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined,
        });
      });
  }, []);

  // Once fonts are ready, wait out whatever remains of MIN_SPLASH_DURATION
  // before revealing the app. We no longer block on clerkConfig so the web
  // preview always gets past the splash (Clerk key may be empty on web).
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    const elapsed = Date.now() - splashStartTime;
    const remaining = Math.max(0, MIN_SPLASH_DURATION_MS - elapsed);
    const timer = setTimeout(() => setShowCustomSplash(false), remaining);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  // Hard-cap: never stay on splash more than 6 s regardless of anything.
  useEffect(() => {
    const timer = setTimeout(() => setShowCustomSplash(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  // Guard: only mount ClerkProvider when we have a non-empty publishable key.
  const validClerkConfig =
    clerkConfig !== null && clerkConfig.publishableKey.length > 0
      ? clerkConfig
      : null;

  const appReady = fontsLoaded || !!fontError;

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      {/* Custom splash renders immediately on first mount — no providers needed */}
      {showCustomSplash && <CustomSplash statusMessage={updateStatus} />}

      {/* Full app tree mounts once fonts are ready. ClerkProvider is only
          wrapped when a valid publishable key is available (native builds).
          On web the key is often absent so we render without auth — markets,
          holdings (local) and settings still work fine without Clerk. */}
      {appReady && (() => {
        const inner = (
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
        );
        if (validClerkConfig) {
          return (
            <ClerkProvider
              publishableKey={validClerkConfig.publishableKey}
              tokenCache={tokenCache}
              proxyUrl={validClerkConfig.proxyUrl}
            >
              <ClerkLoaded>{inner}</ClerkLoaded>
            </ClerkProvider>
          );
        }
        return inner;
      })()}
    </View>
  );
}
