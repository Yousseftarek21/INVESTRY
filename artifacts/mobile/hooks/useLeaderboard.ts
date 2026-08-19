import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';

const QUERY_KEY = ['competition-leaderboard'];

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
  const getToken = useStableGetToken();
  const queryClient = useQueryClient();

  const query = useQuery<LeaderboardResponse>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return EMPTY;
      const res = await apiFetch('/api/competition/leaderboard', token);
      if (!res.ok) return EMPTY;
      return res.json();
    },
    staleTime: 30_000,
  });

  const join = async (nickname: string): Promise<boolean> => {
    const token = await getToken();
    if (!token) return false;
    const res = await apiFetch('/api/competition/join', token, {
      method: 'PUT',
      body: JSON.stringify({ nickname }),
    });
    if (res.ok) await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    return res.ok;
  };

  const leave = async (): Promise<boolean> => {
    const token = await getToken();
    if (!token) return false;
    const res = await apiFetch('/api/competition/leave', token, { method: 'POST' });
    if (res.ok) await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
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
