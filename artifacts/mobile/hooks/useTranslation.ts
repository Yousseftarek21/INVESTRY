import { useAppSettings } from '@/context/AppSettingsContext';
import { translations } from '@/i18n';

export function useT() {
  const { language } = useAppSettings();
  return translations[language];
}
