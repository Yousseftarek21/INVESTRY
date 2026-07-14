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
import React, { useCallback, useEffect, useState } from "react";
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

/**
 * Waits for Clerk auth state to be determined, then calls onDone after
 * the minimum splash duration has elapsed. Renders no UI itself — the
 * single CustomSplash instance in the parent stays visible until onDone fires.
 */
function SplashGate({
  onDone,
  children,
}: {
  onDone: () => void;
  children: React.ReactNode;
}) {
  const { isLoaded } = useAuth();

  // Dismiss once Clerk is ready AND minimum duration has passed.
  useEffect(() => {
    if (!isLoaded) return;
    const elapsed = Date.now() - splashStartTime;
    const remaining = Math.max(0, MIN_SPLASH_DURATION_MS - elapsed);
    const t = setTimeout(onDone, remaining);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Safety net: never block longer than 8 s.
  useEffect(() => {
    const t = setTimeout(onDone, 8000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // Single splash instance — dismissed only after Clerk + timer are both done.
  const [showSplash, setShowSplash] = useState(true);
  const [clerkConfig, setClerkConfig] = useState<ClerkConfig | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('');

  const hideSplash = useCallback(() => setShowSplash(false), []);

  // Hide the native splash immediately — our custom splash takes over from here.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Check for OTA update on launch.
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

  // Fetch Clerk publishable key + proxy URL from the API server.
  useEffect(() => {
    const apiBase = getApiBaseUrl();
    fetch(`${apiBase}/api/config`)
      .then((r) => r.json())
      .then((data: { clerkPublishableKey?: string; clerkProxyUrl?: string }) => {
        const key = (data.clerkPublishableKey ?? '').trim();
        if (key) {
          setClerkConfig({ publishableKey: key, proxyUrl: data.clerkProxyUrl ?? undefined });
        } else {
          setClerkConfig({
            publishableKey: (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim(),
            proxyUrl: process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined,
          });
        }
      })
      .catch(() => {
        setClerkConfig({
          publishableKey: (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim(),
          proxyUrl: process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined,
        });
      });
  }, []);

  const validClerkConfig =
    clerkConfig !== null && clerkConfig.publishableKey.length > 0 ? clerkConfig : null;

  // Both fonts AND the Clerk config must be ready before mounting the app tree.
  const appReady = (fontsLoaded || !!fontError) && validClerkConfig !== null;

  return (
    <View style={{ flex: 1, backgroundColor: "#060D1A" }}>
      {/* Single CustomSplash — mounts immediately, dismissed when SplashGate
          calls hideSplash (Clerk ready + MIN_SPLASH_DURATION_MS elapsed).
          absoluteFillObject keeps it on top of the app tree while visible. */}
      {showSplash && <CustomSplash statusMessage={updateStatus} />}

      {/* App tree mounts behind the splash as soon as fonts + config are ready.
          SplashGate fires hideSplash once Clerk auth state is determined. */}
      {appReady && validClerkConfig && (
        <ClerkProvider
          publishableKey={validClerkConfig.publishableKey}
          tokenCache={tokenCache}
          proxyUrl={validClerkConfig.proxyUrl}
        >
          <SplashGate onDone={hideSplash}>
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
          </SplashGate>
        </ClerkProvider>
      )}
    </View>
  );
}
