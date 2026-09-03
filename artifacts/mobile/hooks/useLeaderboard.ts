import { useAuth } from '@clerk/expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';

export type LeaderboardPeriod = 'week' | 'month';

export interface LeaderboardEntry {
  userId: string;
  name: string;
  imageUrl: string | null;
  pctReturn: number;
  rank: number;
  isMe: boolean;
}

interface LeaderboardResponse {
  period: LeaderboardPeriod;
  periodStart: string;
  top: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  optedIn: boolean;
}

const emptyFor = (period: LeaderboardPeriod): LeaderboardResponse => (
  { period, periodStart: '', top: [], me: null, optedIn: false }
);

// Same react-query pattern as useCashAccountsTodayChanges — a short
// staleTime rather than no cache at all, so reopening the screen doesn't
// show a blank list for a beat every time.
export function useLeaderboard(period: LeaderboardPeriod = 'week') {
  const { userId, isSignedIn } = useAuth();
  const getToken = useStableGetToken();
  const queryClient = useQueryClient();
  // Scoped by userId AND period, not a flat key: a flat key would keep
  // serving the previous account's cached opted-in status (from before
  // sign-out, or from a fetch that raced the sign-out and got a token-less
  // EMPTY) to whoever's session mounts next, for up to staleTime — surfacing
  // the "join" banner right after re-signing into an account that had
  // already joined, or leaking one account's status into the next on a
  // shared device. Every user-scoped context in this app (Holdings, Cash,
  // Goals, Subscription, …) clears its own cache on account change for the
  // same reason; this is the react-query-native way to get the same
  // guarantee. Scoping by period too means switching Weekly/Monthly is an
  // instant cache hit on a second visit instead of a refetch every time.
  const queryKey = ['competition-leaderboard', userId, period] as const;

  const query = useQuery<LeaderboardResponse>({
    queryKey,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return emptyFor(period);
      const res = await apiFetch(`/api/competition/leaderboard?period=${period}`, token);
      if (!res.ok) return emptyFor(period);
      return res.json();
    },
    enabled: !!isSignedIn && !!userId,
    // Ranks are computed live off portfolio_snapshots, which
    // portfolioAlertCron writes every 5 minutes — staleTime: 0 means every
    // time this screen is opened it fetches fresh rather than showing a
    // stale cached read (the leaderboard felt "stuck" before this, since a
    // reopen within the old 30s window silently reused the previous number).
    // refetchInterval keeps it updating while the screen stays open, matched
    // to the same 5-minute cadence useServerIntraday already polls at —
    // polling faster would just repeat the same payload between cron ticks.
    staleTime: 0,
    refetchInterval: 5 * 60_000,
  });

  const join = async (): Promise<boolean> => {
    const token = await getToken();
    if (!token) return false;
    const res = await apiFetch('/api/competition/join', token, { method: 'PUT' });
    if (res.ok) {
      await queryClient.invalidateQueries({ queryKey: ['competition-leaderboard', userId] });
    }
    return res.ok;
  };

  const leave = async (): Promise<boolean> => {
    const token = await getToken();
    if (!token) return false;
    const res = await apiFetch('/api/competition/leave', token, { method: 'POST' });
    if (res.ok) {
      await queryClient.invalidateQueries({ queryKey: ['competition-leaderboard', userId] });
    }
    return res.ok;
  };

  return {
    ...(query.data ?? emptyFor(period)),
    isLoading: query.isLoading,
    // Read directly from the server's own flag, not inferred from `me` —
    // a just-joined user with no snapshot history yet is genuinely opted in
    // but has nothing to rank, and would otherwise never leave the join
    // screen despite having already joined. See routes/competition.ts.
    isOptedIn: query.data?.optedIn ?? false,
    // Distinct from isLoading (which only covers the very first fetch) —
    // this is what a pull-to-refresh spinner should key off, so it clears
    // even though isLoading has long since gone false.
    isFetching: query.isFetching,
    refresh: query.refetch,
    join,
    leave,
  };
}

export interface LeaderboardResultEntry {
  userId: string;
  name: string;
  imageUrl: string | null;
  pctReturn: number;
  rank: number;
}

interface LastResultResponse {
  periodType: LeaderboardPeriod;
  periodStart: string | null;
  top: LeaderboardResultEntry[];
}

const emptyResultFor = (period: LeaderboardPeriod): LastResultResponse => (
  { periodType: period, periodStart: null, top: [] }
);

// The FROZEN result of the most recently CLOSED week/month — distinct from
// useLeaderboard above, which is always the current, still-in-progress
// period. Backed by leaderboardPeriodResultsCron.ts's own table, so this is
// only ever "the last week/month that actually finished," never a live
// number. Server-side gates this to opted-in users only (empty otherwise) —
// see routes/competition.ts's own comment — matching "shown in the
// leaderboard, not outside it, and only to people who joined."
export function useLastLeaderboardResult(period: LeaderboardPeriod = 'week') {
  const { userId, isSignedIn } = useAuth();
  const getToken = useStableGetToken();
  const queryKey = ['competition-last-result', userId, period] as const;

  const query = useQuery<LastResultResponse>({
    queryKey,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return emptyResultFor(period);
      const res = await apiFetch(`/api/competition/last-result?period=${period}`, token);
      if (!res.ok) return emptyResultFor(period);
      return res.json();
    },
    // DISABLED — real users reported last week's frozen top 3 as visibly
    // wrong (this week's live leaderboard is unaffected and confirmed
    // correct; only leaderboardPeriodResultsCron.ts's frozen computation
    // is suspect). Query short-circuits to empty rather than fetching, so
    // the persistent recap card and celebration modal in app/leaderboard.tsx
    // both correctly render nothing (both already gate on `top.length > 0`)
    // without touching either of those call sites. Root cause not yet
    // diagnosed — likely the accepted "frozen ranking uses current holdings
    // against historical prices" limitation documented on
    // computeFrozenPeriodPerformance, or a stock/metal price history table
    // too young at the time this first ran to cover a full week back. Do
    // not re-enable (flip back to `!!isSignedIn && !!userId`) without
    // confirming the fix — this table isn't blanked, so simply re-enabling
    // this query will resurface the same bad row immediately.
    enabled: false,
    // Only changes when a period rolls over (at most twice a week across
    // week+month), not worth polling on the leaderboard's 5-minute cadence —
    // a plain 30-minute staleTime avoids a redundant fetch every time this
    // screen reopens within that window.
    staleTime: 30 * 60_000,
  });

  return {
    ...(query.data ?? emptyResultFor(period)),
    isLoading: query.isLoading,
  };
}
