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
import React, { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CustomSplash } from "@/components/CustomSplash";
import { NoNetworkScreen } from "@/components/NoNetworkScreen";
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

// Signals from ClerkReadySignal back to the root layout.
// Module-level so they survive across re-renders without being in state.
let _hideSplash: (() => void) | null = null;
let _onClerkReady: (() => void) | null = null;

// Lives inside <ClerkProvider> — useAuth() works there without needing a
// ClerkLoaded gate. Fires _hideSplash and _onClerkReady once Clerk is ready.
function ClerkReadySignal() {
  const { isLoaded } = useAuth();
  useEffect(() => {
    if (isLoaded) {
      if (_onClerkReady) { _onClerkReady(); _onClerkReady = null; }
      if (_hideSplash) { _hideSplash(); _hideSplash = null; }
    }
  }, [isLoaded]);
  return null;
}

// @clerk/expo v3.x does not export a <ClerkLoaded> component, so we build
// the equivalent: renders children only after Clerk has fully initialised.
// This guarantees that useSignIn()/useSignUp() are never undefined inside
// auth screens — without this guard, accessing signUp.status or errors.fields
// before isLoaded crashes the component on every render.
function ClerkLoaded({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  if (!isLoaded) return null;
  return <>{children}</>;
}

function StatusBarManager() {
  const { resolvedTheme } = useAppSettings();
  return <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} translucent />;
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
      <StatusBarManager />
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

  // clerkReady tracks whether Clerk has successfully initialised.
  // clerkReadyRef is used inside setTimeout callbacks (avoids stale closures).
  const [clerkReady, setClerkReady] = useState(false);
  const clerkReadyRef = useRef(false);

  // Set when we detect a network failure — either from the /api/config fetch
  // throwing a non-abort error or from the 8s safety net expiring before Clerk
  // ever loads.  Cleared automatically if Clerk loads later (self-healing).
  const [networkError, setNetworkError] = useState(false);

  // Hide the native splash immediately — our custom splash takes over
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

  // Fetch the correct Clerk publishable key + proxy URL from the API server.
  // 5-second timeout so a slow/unreachable backend never blocks app startup.
  // On any network failure we fall back to the hardcoded live credentials so
  // Clerk can still attempt to initialise.  If Clerk also fails (no network),
  // the 8s safety net below will reveal the NoNetworkScreen.
  useEffect(() => {
    const apiBase = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Publishable keys are designed to be in client bundles — not a secret.
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
      .catch((err) => {
        // AbortError = our own 5s timeout (not a network error per se — Clerk
        // may still load via the hardcoded fallback). Any other error means the
        // device has no network, so pre-flag it; the 8s safety net will confirm.
        if (err?.name !== 'AbortError') {
          setNetworkError(true);
        }
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

  // Register the callbacks that ClerkReadySignal will invoke.
  useEffect(() => {
    _hideSplash = () => {
      const elapsed = Date.now() - splashStartTime;
      const remaining = Math.max(0, MIN_SPLASH_DURATION_MS - elapsed);
      setTimeout(() => setShowCustomSplash(false), remaining);
    };
    _onClerkReady = () => {
      clerkReadyRef.current = true;
      setClerkReady(true);
      // Clear any previously flagged network error — Clerk managed to load.
      setNetworkError(false);
    };
    return () => { _hideSplash = null; _onClerkReady = null; };
  }, []);

  // Safety net: dismiss splash after 8 s no matter what.
  // Also force-resolves clerkConfig if still pending — ensures the app tree
  // always renders.  If Clerk hasn't loaded by then, flag a network error so
  // the user sees an actionable "No connection" screen instead of a blank one.
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCustomSplash(false);
      setClerkConfig((prev) =>
        prev ?? {
          publishableKey: 'pk_live_Y2xlcmsuaW52c3RyeS5yZXBsaXQuYXBwJA',
          proxyUrl: 'https://invstry.replit.app/api/__clerk',
        },
      );
      // clerkReadyRef is safe to read here (not stale like state would be).
      if (!clerkReadyRef.current) {
        setNetworkError(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  // Show no-network screen: splash is gone, Clerk still hasn't loaded, and we
  // detected a network failure.  Automatically dismissed if Clerk loads later.
  const showNetworkError = !showCustomSplash && networkError && !clerkReady;

  return (
    <SafeAreaProvider>
      <AppSettingsProvider>
        <DirectionWrapper>
        <View style={{ flex: 1, backgroundColor: "#121212" }}>
          {showCustomSplash && <CustomSplash statusMessage={updateStatus} />}

          {showNetworkError && <NoNetworkScreen />}

          {appReady && validClerkConfig && (
            <ClerkProvider
              publishableKey={validClerkConfig.publishableKey}
              tokenCache={tokenCache}
              proxyUrl={validClerkConfig.proxyUrl}
            >
              {/*
               * ClerkReadySignal sits outside ClerkLoaded so it can fire and hide
               * the splash the moment isLoaded becomes true, before the app tree
               * is visible. The app tree (inside ClerkLoaded) only renders once
               * Clerk is fully initialised, ensuring useSignIn()/useSignUp() are
               * never undefined in auth screens. If Clerk never loads (no network),
               * the 8s safety net sets networkError=true and NoNetworkScreen shows.
               */}
              <ClerkReadySignal />
              <ClerkLoaded>
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
              </ClerkLoaded>
            </ClerkProvider>
          )}
        </View>
        </DirectionWrapper>
      </AppSettingsProvider>
    </SafeAreaProvider>
  );
}
