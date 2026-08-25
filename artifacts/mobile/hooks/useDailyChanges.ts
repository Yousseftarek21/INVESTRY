import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';

export interface DailyChange {
  date: string; // trading day key, "YYYY-MM-DD"
  pctReturn: number;
}

const QUERY_KEY = ['daily-changes'];

// The server's per-day closed "Today's Change %" history — same
// report-style shape as useSoldHoldings (past, never edited in place), so a
// plain react-query read is enough. Written by portfolioAlertCron.ts every
// 5 minutes, one row per trading day, so a past day's entry here is that
// day's real, final value from when the Home tab's badge last showed it
// before the day rolled over — not reconstructed or estimated.
export function useDailyChanges() {
  const getToken = useStableGetToken();

  const query = useQuery<DailyChange[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const res = await apiFetch('/api/portfolio/daily-changes', token);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  return { dailyChanges: query.data ?? [], isLoading: query.isLoading };
}
