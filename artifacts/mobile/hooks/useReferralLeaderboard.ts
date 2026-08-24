import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';

export type ReferralLeaderboardPeriod = 'month' | 'all';

export interface ReferralLeaderboardEntry {
  userId: string;
  name: string;
  imageUrl: string | null;
  referredCount: number;
  rank: number;
  isMe: boolean;
}

interface ReferralLeaderboardResponse {
  period: ReferralLeaderboardPeriod;
  periodStart: string | null;
  top: ReferralLeaderboardEntry[];
  me: ReferralLeaderboardEntry | null;
}

const emptyFor = (period: ReferralLeaderboardPeriod): ReferralLeaderboardResponse => (
  { period, periodStart: null, top: [], me: null }
);

// No opt-in gate here (unlike useLeaderboard) — everyone who's ever
// referred someone is automatically eligible, there's no separate "join
// the referral leaderboard" action.
export function useReferralLeaderboard(period: ReferralLeaderboardPeriod = 'month') {
  const { userId, isSignedIn } = useAuth();
  const getToken = useStableGetToken();
  const queryKey = ['referral-leaderboard', userId, period] as const;

  const query = useQuery<ReferralLeaderboardResponse>({
    queryKey,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return emptyFor(period);
      const res = await apiFetch(`/api/referral/leaderboard?period=${period}`, token);
      if (!res.ok) return emptyFor(period);
      return res.json();
    },
    enabled: !!isSignedIn && !!userId,
    // Referral counts change far less often than the 5-minute portfolio
    // snapshots the portfolio leaderboard polls at — a 30s staleTime plus
    // pull-to-refresh is enough to avoid a stuck-stale screen without
    // polling for data that rarely changes minute to minute.
    staleTime: 30_000,
  });

  return {
    ...(query.data ?? emptyFor(period)),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refresh: query.refetch,
  };
}
