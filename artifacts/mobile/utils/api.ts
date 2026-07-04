import { Platform } from 'react-native';

/**
 * Returns the base URL for API calls.
 * - Web: empty string (relative URLs go through the shared Replit proxy)
 * - Native: full URL from EXPO_PUBLIC_DOMAIN (injected by the dev-server start
 *   command), falling back to localhost
 */
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web') return '';
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : 'http://localhost:80';
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
