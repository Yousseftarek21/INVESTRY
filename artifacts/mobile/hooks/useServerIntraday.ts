import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';

export interface IntradayPoint { t: number; v: number }

// Today's intraday series recorded server-side by portfolioAlertCron every
// 5 minutes, for every user, whether or not the app was open. This is what
// gives the 1D chart real movement across the day — the on-device sampler
// (useIntradaySamples) can only record what it observed while the app was
// running, so on its own it collapses to a straight start-to-now line.
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
