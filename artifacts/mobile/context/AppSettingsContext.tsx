import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { Language } from '@/i18n';

export type ThemeMode = 'light' | 'dark' | 'system';
export type WeightUnit = 'g' | 'oz';

interface NotificationPrefs {
  priceAlerts: boolean;
  portfolioAlerts: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
}

interface AppSettingsValue {
  themeMode: ThemeMode;
  language: Language;
  resolvedTheme: 'light' | 'dark';
  weightUnit: WeightUnit;
  hapticsEnabled: boolean;
  analyticsEnabled: boolean;
  notifications: NotificationPrefs;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  setHapticsEnabled: (val: boolean) => Promise<void>;
  setAnalyticsEnabled: (val: boolean) => Promise<void>;
  setNotification: (key: keyof NotificationPrefs, val: boolean) => Promise<void>;
  isLoaded: boolean;
}

const K = {
  theme: '@invstry_theme',
  lang: '@invstry_lang',
  weight: '@invstry_weight',
  haptics: '@invstry_haptics',
  analytics: '@invstry_analytics',
  notif: '@invstry_notif',
};

const DEFAULT_NOTIF: NotificationPrefs = {
  priceAlerts: true,
  portfolioAlerts: true,
  dailySummary: false,
  weeklySummary: false,
};

const AppSettingsContext = createContext<AppSettingsValue | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [language, setLanguageState] = useState<Language>('en');
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('g');
  const [hapticsEnabled, setHapticsState] = useState(true);
  const [analyticsEnabled, setAnalyticsState] = useState(true);
  const [notifications, setNotificationsState] = useState<NotificationPrefs>(DEFAULT_NOTIF);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, l, w, h, a, n] = await Promise.all([
          AsyncStorage.getItem(K.theme),
          AsyncStorage.getItem(K.lang),
          AsyncStorage.getItem(K.weight),
          AsyncStorage.getItem(K.haptics),
          AsyncStorage.getItem(K.analytics),
          AsyncStorage.getItem(K.notif),
        ]);
        if (t === 'light' || t === 'dark' || t === 'system') setThemeModeState(t);
        if (l === 'en' || l === 'ar') setLanguageState(l);
        if (w === 'g' || w === 'oz') setWeightUnitState(w);
        if (h !== null) setHapticsState(h === 'true');
        if (a !== null) setAnalyticsState(a === 'true');
        if (n) {
          try { setNotificationsState({ ...DEFAULT_NOTIF, ...JSON.parse(n) }); } catch { /* use defaults */ }
        }
      } catch {
        // use defaults
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themeMode;

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(K.theme, mode);
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem(K.lang, lang);
  }, []);

  const setWeightUnit = useCallback(async (unit: WeightUnit) => {
    setWeightUnitState(unit);
    await AsyncStorage.setItem(K.weight, unit);
  }, []);

  const setHapticsEnabled = useCallback(async (val: boolean) => {
    setHapticsState(val);
    await AsyncStorage.setItem(K.haptics, String(val));
  }, []);

  const setAnalyticsEnabled = useCallback(async (val: boolean) => {
    setAnalyticsState(val);
    await AsyncStorage.setItem(K.analytics, String(val));
  }, []);

  const setNotification = useCallback(async (key: keyof NotificationPrefs, val: boolean) => {
    setNotificationsState(prev => {
      const next = { ...prev, [key]: val };
      AsyncStorage.setItem(K.notif, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AppSettingsContext.Provider value={{
      themeMode, language, resolvedTheme,
      weightUnit, hapticsEnabled, analyticsEnabled, notifications,
      setThemeMode, setLanguage, setWeightUnit,
      setHapticsEnabled, setAnalyticsEnabled, setNotification,
      isLoaded,
    }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used inside AppSettingsProvider');
  return ctx;
}
