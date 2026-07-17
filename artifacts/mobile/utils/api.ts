import { Platform } from 'react-native';

/**
 * The stable, permanent production API domain (Render). Used as the fallback
 * for any built app (TestFlight/App Store) where EXPO_PUBLIC_DOMAIN wasn't
 * set at build time. Never point this at an ephemeral/dev-only domain — those
 * rotate and any build that bakes one in will silently lose backend
 * connectivity later.
 */
const PRODUCTION_API_DOMAIN = 'api.investry.app';

/**
 * Returns the base URL for API calls.
 * - Web: empty string (relative URLs go through the shared Replit proxy)
 * - Native (dev): full URL from EXPO_PUBLIC_DOMAIN (injected by the dev-server
 *   start command), so Expo Go talks to this workspace's live dev backend
 * - Native (built app, e.g. TestFlight/App Store): EXPO_PUBLIC_DOMAIN is not
 *   set at build time, so falls back to the permanent production domain
 */
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web') return '';
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return `https://${domain || PRODUCTION_API_DOMAIN}`;
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
