import "@/utils/textScaling";
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
import { RecurringIncomeProvider } from "@/context/RecurringIncomeContext";
import { DividendsProvider } from "@/context/DividendsContext";
import { GoalsProvider } from "@/context/GoalsContext";
import { PriceAlertsProvider } from "@/context/PriceAlertsContext";
import { AppSettingsProvider, useAppSettings } from "@/context/AppSettingsContext";
import { BiometricGate } from "@/components/BiometricGate";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { Paywall } from "@/components/Paywall";
import { ForceUpdateGate } from "@/components/ForceUpdateGate";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { useNotificationTapRouting } from "@/hooks/useNotificationTapRouting";
import { getApiBaseUrl, apiFetch } from "@/utils/api";
import { hydratePricesFromCache, prefetchMarketPrices, whenMarketPricesSettled } from "@/hooks/usePrices";
import { hydrateEGXIndicesFromCache, prefetchEGXIndices } from "@/hooks/useEGXIndices";
import { hydrateRealEstatePricesFromCache, prefetchRealEstatePrices } from "@/hooks/useRealEstatePrices";
import { hydrateRealEstateCompoundsFromCache, prefetchRealEstateCompounds } from "@/hooks/useRealEstateCompoundPrices";
import { hydrateGlobalStocksFromCache, prefetchGlobalStocks } from "@/hooks/useGlobalStocks";
import { hydrateUSIndicesFromCache, prefetchUSIndices } from "@/hooks/useUSIndices";
import { initMetaSDK } from "@/utils/metaSdk";
import { syncRevenueCatUser, clearRevenueCatUser } from "@/utils/revenuecat";
import * as Updates from "expo-updates";

SplashScreen.preventAutoHideAsync();

const splashStartTime = Date.now();
// Floor so the splash's own reveal choreography (logo spring + staggered
// fade-ins, ~0.5s) always finishes on screen before hide, without holding
// a fast load back as long as the old 2.5s floor did. The equalizer bars
// themselves loop indefinitely rather than drawing to a fixed finish point,
// so unlike the previous chart-line animation this floor isn't calibrated
// against how long any one animation takes to complete.
const MIN_SPLASH_DURATION_MS = Platform.OS === 'web' ? 0 : 1600;

// Hard ceiling on how long the splash may wait for launch data before
// revealing anyway. Observed price latency is ~570ms against a 1600ms splash,
// so this headroom is normally unused — it exists purely so a bad network
// can never turn a loading state into a stuck screen.
const SPLASH_DATA_CAP_MS = Platform.OS === 'web' ? 0 : 3000;

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

// Both run at module load — before React renders anything — so the Home hero
// shows a true portfolio total on its first frame instead of a placeholder.
// Deliberately not components: they touch nothing in the render tree,
// including the auth screens.
//
//  - hydrate: seeds the last prices from disk (a few ms) — covers every launch
//    after the first.
//  - prefetch: starts the network request now rather than when a tab mounts,
//    so the ~1.6s splash covers the ~570ms round trip — this is what makes a
//    FIRST launch real too, when there is no cache yet.
//
// Ordering is safe either way: hydratePricesFromCache refuses to overwrite
// data once a real fetch has landed.
void hydratePricesFromCache(queryClient);
prefetchMarketPrices(queryClient);

// Same reasoning, extended to EGX indices and real estate — neither gates
// the splash (they're not on the first screen the user sees), but warming
// both before any tab mounts means the EGX chips and Real Estate tab show
// real data instantly instead of a visible delay on every cold open.
void hydrateEGXIndicesFromCache(queryClient);
prefetchEGXIndices(queryClient);
void hydrateRealEstatePricesFromCache(queryClient);
prefetchRealEstatePrices(queryClient);
void hydrateRealEstateCompoundsFromCache(queryClient);
prefetchRealEstateCompounds(queryClient);
// Same reasoning again — US Markets (100 stocks + 3 indices) had none of
// this, so it was the one tab that visibly lagged behind EGX/Metals/Real
// Estate on every cold open instead of showing real data immediately.
void hydrateGlobalStocksFromCache(queryClient);
prefetchGlobalStocks(queryClient);
void hydrateUSIndicesFromCache(queryClient);
prefetchUSIndices(queryClient);

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
        name="add-choose"
        options={{ presentation: "transparentModal", headerShown: false, animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="add-investment"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="cash-accounts"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="cash-history"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="recurring-income"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="dividends"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="leaderboard"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="notifications"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="price-alerts"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="tbills-calculator"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="goals"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="financial-tool"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="ai-assistant"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="ai-assistant-history"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="target-allocation"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="feedback"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="tiers"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="stock-financials"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="help-center"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="settings-account"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="settings-appearance"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="settings-notifications"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="settings-portfolio"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="settings-privacy"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="settings-support"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="invite-friends"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="sharia-screening"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

function NotificationsInitializer() {
  const { notifications } = useAppSettings();
  usePushRegistration(
    notifications.portfolioAlerts,
    notifications.priceAlerts,
    notifications.dailySummary,
    notifications.weeklySummary,
  );
  useNotificationTapRouting();
  return null;
}

// Mounted post-sign-in (inside AppWithPaywall), same timing as push
// notification registration — not on the cold-start splash path, so the ATT
// prompt never competes with the biometric gate for the user's first frame.
function MetaSDKInitializer() {
  useEffect(() => {
    void initMetaSDK();
  }, []);
  return null;
}

// Keeps RevenueCat's own app_user_id in lockstep with the signed-in Clerk
// user, so the RevenueCat webhook (which writes usersTable.plan keyed by
// that id) always lands on the right account. No-op on Android/web — see
// isIOSIAPAvailable().
function RevenueCatInitializer() {
  const { userId, isSignedIn } = useAuth();
  useEffect(() => {
    if (isSignedIn && userId) syncRevenueCatUser(userId);
    else if (isSignedIn === false) clearRevenueCatUser();
  }, [isSignedIn, userId]);
  return null;
}

// Syncs AppSettingsContext's language to usersTable.language so server-sent
// pushes (broadcast-push today, eventually the summary/alert crons) know
// which language to send in — without this, every push defaults to English
// regardless of the device's actual setting. Lives here, not inside
// AppSettingsProvider itself, because that provider sits outside
// ClerkProvider in the tree below (so it can theme/localize the loading
// screen before Clerk is even ready) — useAuth() isn't safe to call there.
// Same bridge-component pattern as NotificationsInitializer/
// RevenueCatInitializer just above. Fires on every `language` change,
// which also covers the one-time backfill for existing accounts: the
// effect runs once more as soon as hydration replaces the 'en' default
// with whatever was actually stored, so an existing Arabic user's real
// preference reaches the server even though they never explicitly
// re-triggered setLanguage.
function LanguageSyncInitializer() {
  const { language, isLoaded } = useAppSettings();
  const { getToken, isSignedIn } = useAuth();
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        await apiFetch('/api/account/language', token, {
          method: 'PUT',
          body: JSON.stringify({ language }),
        });
      } catch {
        // Best-effort — a failed sync just means the next server push
        // falls back to English for this user until it succeeds another
        // time; never worth surfacing to the user over.
      }
    })();
  }, [language, isLoaded, isSignedIn, getToken]);
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
  const { biometricLock, setBiometricLock } = useAppSettings();
  const { isSignedIn } = useAuth();
  const wasSignedInRef = useRef(false);

  // Biometric lock is a plain device-level toggle (one AsyncStorage key,
  // not scoped per account), so without this it silently carries over to
  // whoever signs in next. Reset it on a genuine sign-out transition (not
  // on initial mount before any sign-in has happened) so re-signing in
  // requires explicitly turning it back on.
  useEffect(() => {
    if (wasSignedInRef.current && isSignedIn === false) {
      setBiometricLock(false);
    }
    if (isSignedIn) wasSignedInRef.current = true;
  }, [isSignedIn, setBiometricLock]);

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
  return (
    <>
      <StatusBarManager />
      <NotificationsInitializer />
      <MetaSDKInitializer />
      <RevenueCatInitializer />
      <LanguageSyncInitializer />
      <Paywall />
      {children}
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
    // No proxyUrl here: Clerk's SDK reaches the Frontend API domain encoded
    // in the publishable key directly (clerk.investry.app), which has its
    // own verified custom domain — no proxy workaround needed.
    const HARDCODED_LIVE_KEY = 'pk_live_Y2xlcmsuaW52ZXN0cnkuYXBwJA';
    const envKey = (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim();

    const fallbackConfig: ClerkConfig = {
      publishableKey: envKey || HARDCODED_LIVE_KEY,
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
      setTimeout(async () => {
        // Hold the reveal until the launch price fetch has landed, so the hero
        // is complete the moment it appears — total AND today's change — rather
        // than showing a dash that fills in a beat later while the user is
        // already looking at it. Clerk is usually ready before prices are, so
        // without this the card can paint mid-flight.
        //
        // Capped against splash start, not from here, so this can only ever
        // extend the splash to SPLASH_DATA_CAP_MS total. A slow or offline
        // device reveals on time with the dash instead of being stranded.
        await whenMarketPricesSettled(SPLASH_DATA_CAP_MS - (Date.now() - splashStartTime));
        setShowCustomSplash(false);
      }, remaining);
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
          publishableKey: 'pk_live_Y2xlcmsuaW52ZXN0cnkuYXBwJA',
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
        <View style={{ flex: 1, backgroundColor: "#000000" }}>
          {showCustomSplash && <CustomSplash statusMessage={updateStatus} />}

          {showNetworkError && <NoNetworkScreen />}

          {/* Mounted this high, outside the Clerk/auth gate, so a native
              binary old enough to matter is blocked everywhere — signed in
              or not, mid-onboarding or not — not just once someone reaches
              the main app. */}
          <ForceUpdateGate />

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
                            <GoalsProvider>
                            <RecurringIncomeProvider>
                            <DividendsProvider>
                            <PriceAlertsProvider>
                              <AppWithPaywall>
                                <RootLayoutNav />
                              </AppWithPaywall>
                            </PriceAlertsProvider>
                            </DividendsProvider>
                            </RecurringIncomeProvider>
                          </GoalsProvider>
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
