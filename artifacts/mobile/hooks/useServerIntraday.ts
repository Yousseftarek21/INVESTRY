import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';

export interface IntradayPoint { t: number; v: number }

// Today's intraday series recorded server-side by portfolioAlertCron every
// 5 minutes, for every user, whether or not the app was open — the single
// source for the 1D chart's real intraday texture. Deliberately no
// on-device fallback: an earlier version also sampled locally while the app
// was running and preferred whichever source settled first, which made the
// chart flash one curve shape then swap to another as the two sources
// resolved at different speeds. Server-only means every screen shows the
// same shape for the same day, and the chart simply waits (see index.tsx's
// and analytics.tsx's todaySamples) rather than ever painting a second,
// different-looking curve.
export function useServerIntraday() {
  const { userId, isSignedIn } = useAuth();
  const getToken = useStableGetToken();

  return useQuery<IntradayPoint[]>({
    queryKey: ['portfolio-intraday', userId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const res = await apiFetch('/api/portfolio/intraday', token);
      if (!res.ok) return [];
      const data = await res.json() as { points?: IntradayPoint[] };
      return Array.isArray(data.points) ? data.points : [];
    },
    enabled: !!isSignedIn && !!userId,
    // The series only grows once per 5-minute cron tick, so polling faster
    // than that would just repeat the same payload.
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
