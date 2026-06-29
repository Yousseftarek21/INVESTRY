import { useAppSettings } from '@/context/AppSettingsContext';
import colors from '@/constants/colors';

export function useColors() {
  const { resolvedTheme } = useAppSettings();
  const palette = colors[resolvedTheme];
  return { ...palette, radius: colors.radius };
}
