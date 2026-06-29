import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { Language } from '@/i18n';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppSettingsValue {
  themeMode: ThemeMode;
  language: Language;
  resolvedTheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
  isLoaded: boolean;
}

const THEME_KEY = '@istithmarak_theme';
const LANG_KEY = '@istithmarak_lang';

const AppSettingsContext = createContext<AppSettingsValue | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, l] = await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(LANG_KEY),
        ]);
        if (t === 'light' || t === 'dark' || t === 'system') setThemeModeState(t);
        if (l === 'en' || l === 'ar') setLanguageState(l);
      } catch {
        // use defaults
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    themeMode === 'system'
      ? (systemScheme === 'light' ? 'light' : 'dark')
      : themeMode;

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_KEY, mode);
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem(LANG_KEY, lang);
  }, []);

  return (
    <AppSettingsContext.Provider value={{ themeMode, language, resolvedTheme, setThemeMode, setLanguage, isLoaded }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used inside AppSettingsProvider');
  return ctx;
}
