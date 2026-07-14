import { useAuth } from "@clerk/expo";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, Tabs, router } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";

// On web (preview), skip Clerk auth gate so the UI is always visible.
const IS_WEB = Platform.OS === "web";

import { useAppSettings } from "@/context/AppSettingsContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/hooks/useTranslation";

function LoadingScreen() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function NativeTabLayout() {
  const t = useT();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "chart.pie", selected: "chart.pie.fill" }} />
        <Label>{t.portfolio}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="markets">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>{t.markets}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="holdings">
        <Icon sf={{ default: "plus.circle.fill", selected: "plus.circle.fill" }} />
        <Label>{t.addTab}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="analytics">
        <Icon sf={{ default: "chart.xyaxis.line", selected: "chart.xyaxis.line" }} />
        <Label>{t.analytics}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <Label>{t.settings}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const t = useT();
  const { resolvedTheme } = useAppSettings();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={resolvedTheme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
            />
          ) : null,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.portfolio,
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="markets"
        options={{
          title: t.markets,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="bar-chart-2" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="holdings"
        options={{
          title: t.addTab,
          tabBarButton: () => (
            <Pressable
              onPress={() => router.push('/add-investment' as any)}
              style={tabStyles.addWrap}
              accessibilityLabel={t.addInvestment}
            >
              <View style={[tabStyles.addBtn, { backgroundColor: colors.primary }]}>
                <Feather name="plus" size={26} color="#000" />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: t.analytics,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.xyaxis.line" tintColor={color} size={22} />
            ) : (
              <Feather name="activity" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.settings,
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  addWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Platform.OS === 'ios' ? 0 : 2,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#C9A227',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 6,
    elevation: 5,
  },
  addLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 3,
  },
});

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded && !IS_WEB) return <LoadingScreen />;
  // On web preview, skip auth gate — show tabs directly
  if (!isSignedIn && !IS_WEB) return <Redirect href={"/(auth)/welcome" as any} />;

  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
