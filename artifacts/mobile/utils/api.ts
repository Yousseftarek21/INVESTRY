import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Returns the base URL for API calls.
 * - Web: empty string (relative URLs go through the shared Replit proxy)
 * - Native: full URL from app.config extra, falling back to localhost
 */
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web') return '';
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  return extra?.apiBaseUrl ?? 'http://localhost:80';
}

/**
 * Authenticated fetch wrapper. Pass the Clerk session token as the second arg.
 */
export async function apiFetch(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${getApiBaseUrl()}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}
