import { useAuth } from '@clerk/expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';

export interface LeaderboardEntry {
  nickname: string;
  pctReturn: number;
  rank: number;
  isMe: boolean;
}

interface LeaderboardResponse {
  weekStart: string;
  top: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  optedIn: boolean;
}

const EMPTY: LeaderboardResponse = { weekStart: '', top: [], me: null, optedIn: false };

// Same react-query pattern as useCashAccountsTodayChanges — a short
// staleTime rather than no cache at all, so reopening the screen doesn't
// show a blank list for a beat every time.
export function useLeaderboard() {
  const { userId, isSignedIn } = useAuth();
  const getToken = useStableGetToken();
  const queryClient = useQueryClient();
  // Scoped by userId, not a flat key: a flat key would keep serving the
  // previous account's cached opted-in status (from before sign-out, or
  // from a fetch that raced the sign-out and got a token-less EMPTY) to
  // whoever's session mounts next, for up to staleTime — surfacing the
  // "join" banner right after re-signing into an account that had already
  // joined, or leaking one account's status into the next on a shared
  // device. Every user-scoped context in this app (Holdings, Cash, Goals,
  // Subscription, …) clears its own cache on account change for the same
  // reason; this is the react-query-native way to get the same guarantee.
  const queryKey = ['competition-leaderboard', userId] as const;

  const query = useQuery<LeaderboardResponse>({
    queryKey,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return EMPTY;
      const res = await apiFetch('/api/competition/leaderboard', token);
      if (!res.ok) return EMPTY;
      return res.json();
    },
    enabled: !!isSignedIn && !!userId,
    staleTime: 30_000,
  });

  const join = async (nickname: string): Promise<boolean> => {
    const token = await getToken();
    if (!token) return false;
    const res = await apiFetch('/api/competition/join', token, {
      method: 'PUT',
      body: JSON.stringify({ nickname }),
    });
    if (res.ok) await queryClient.invalidateQueries({ queryKey });
    return res.ok;
  };

  const leave = async (): Promise<boolean> => {
    const token = await getToken();
    if (!token) return false;
    const res = await apiFetch('/api/competition/leave', token, { method: 'POST' });
    if (res.ok) await queryClient.invalidateQueries({ queryKey });
    return res.ok;
  };

  return {
    ...(query.data ?? EMPTY),
    isLoading: query.isLoading,
    // Read directly from the server's own flag, not inferred from `me` —
    // a just-joined user with no snapshot history yet is genuinely opted in
    // but has nothing to rank, and would otherwise never leave the join
    // screen despite having already joined. See routes/competition.ts.
    isOptedIn: query.data?.optedIn ?? false,
    refresh: query.refetch,
    join,
    leave,
  };
}
