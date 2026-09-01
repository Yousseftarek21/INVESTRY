import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';

export interface FeedbackMessage {
  id: string;
  userId: string;
  message: string;
  likeCount: number;
  hasLiked: boolean;
  createdAt: string;
  senderName: string;
  senderImageUrl: string | null;
  isMe: boolean;
}

const QUERY_KEY = ['feedback-messages'];

// The shared feedback chat (app/feedback.tsx). Reads go through useQuery —
// NOT a raw useEffect(() => { load() }, [load]) with getToken/apiFetch in
// its dependency array, which was the actual bug reported ("shows loading"
// forever): react-query's queryFn runs based on queryKey + explicit
// triggers, not on the closure's captured function identities changing
// across renders, so there's no class of "effect keeps re-firing (or never
// resolves the way the UI expects)" bug here the way there was with the
// hand-rolled version. Same read/write split as usePortfolioTargets.ts —
// useQuery for the list, plain async functions + queryClient.setQueryData
// for writes.
export function useFeedback() {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<FeedbackMessage[]>({
    queryKey: QUERY_KEY,
    enabled: !!isSignedIn,
    staleTime: 15 * 1000,
    retry: 1,
    // Polls while the screen is on-screen and focused (react-query pauses
    // refetchInterval when the app backgrounds) so other people's messages
    // and likes show up on their own — a chat that only updates on manual
    // pull-to-refresh doesn't read as live.
    refetchInterval: 15 * 1000,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('no-token');
      const res = await apiFetch('/api/feedback', token);
      if (!res.ok) throw new Error(`API ${res.status}`);
      return res.json();
    },
  });

  const sendMessage = useCallback(async (message: string): Promise<boolean> => {
    const token = await getToken();
    if (!token) return false;
    const res = await apiFetch('/api/feedback', token, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    if (!res.ok) return false;
    const created = (await res.json()) as FeedbackMessage;
    queryClient.setQueryData<FeedbackMessage[]>(QUERY_KEY, prev => [...(prev ?? []), created]);
    return true;
  }, [getToken, queryClient]);

  const toggleLike = useCallback(async (id: string): Promise<void> => {
    // Optimistic — flip immediately, reconcile with the server's real
    // count/state once the response lands, and fall back to a plain
    // refetch (not a manual rollback) on failure so the UI always ends up
    // showing the actual server truth rather than a guessed-at reversal.
    queryClient.setQueryData<FeedbackMessage[]>(QUERY_KEY, prev => prev?.map(m => m.id === id
      ? { ...m, hasLiked: !m.hasLiked, likeCount: m.likeCount + (m.hasLiked ? -1 : 1) }
      : m));
    try {
      const token = await getToken();
      if (!token) throw new Error('no-token');
      const res = await apiFetch(`/api/feedback/${id}/like`, token, { method: 'POST' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const { likeCount, hasLiked } = (await res.json()) as { likeCount: number; hasLiked: boolean };
      queryClient.setQueryData<FeedbackMessage[]>(QUERY_KEY, prev => prev?.map(m => m.id === id ? { ...m, likeCount, hasLiked } : m));
    } catch {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }
  }, [getToken, queryClient]);

  // Optimistic, with rollback — unlike toggleLike (which reconciles via a
  // refetch on failure), a delete that fails on the server must bring the
  // message BACK, not just leave the list stale, or the user would see
  // their own message vanish and reappear on the next poll with no
  // explanation. Own messages only — the server enforces this too
  // (WHERE userId = ...), this is just the same check client-side so the
  // delete action isn't even offered on someone else's message.
  const deleteMessage = useCallback(async (id: string): Promise<boolean> => {
    let removed: FeedbackMessage | undefined;
    queryClient.setQueryData<FeedbackMessage[]>(QUERY_KEY, prev => {
      removed = prev?.find(m => m.id === id);
      return prev?.filter(m => m.id !== id);
    });
    try {
      const token = await getToken();
      if (!token) throw new Error('no-token');
      const res = await apiFetch(`/api/feedback/${id}`, token, { method: 'DELETE' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      return true;
    } catch {
      if (removed) {
        queryClient.setQueryData<FeedbackMessage[]>(QUERY_KEY, prev =>
          prev?.some(m => m.id === id) ? prev : [...(prev ?? []), removed!].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          ),
        );
      }
      return false;
    }
  }, [getToken, queryClient]);

  return {
    messages: query.data ?? [],
    // Only true on the very first fetch with no cached data yet — a
    // background refetch (pull-to-refresh, refocus) never re-hides an
    // already-loaded list behind a full-screen loading state.
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    sendMessage,
    toggleLike,
    deleteMessage,
  };
}

const LAST_SEEN_KEY = '@investry_feedback_last_seen';

// Drives the "something new" badge on the Settings entry row — a card
// that always shows a static "LIVE" pill regardless of whether anything
// actually happened doesn't give anyone a reason to tap back in. There's
// no per-user read-state on the server (that's real scope for a feature
// this size); this is the lightweight version: a local "last time I
// opened the chat" marker compared against the feed's real latest-message
// timestamp from the cheap /feedback/summary endpoint, re-checked every
// time Settings regains focus (including right after leaving the chat
// itself, which is what clears the badge).
export function useFeedbackUnread() {
  const { getToken, isSignedIn } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  const check = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch('/api/feedback/summary', token);
      if (!res.ok) return;
      const { latestCreatedAt } = (await res.json()) as { count: number; latestCreatedAt: string | null };
      if (!latestCreatedAt) { setHasUnread(false); return; }
      const lastSeen = await AsyncStorage.getItem(LAST_SEEN_KEY);
      setHasUnread(!lastSeen || new Date(latestCreatedAt) > new Date(lastSeen));
    } catch {
      // Leave hasUnread at its previous value — a failed check shouldn't
      // flip a real badge off, and showing a stale "new" badge one extra
      // visit is harmless.
    }
  }, [getToken, isSignedIn]);

  useFocusEffect(useCallback(() => { check(); }, [check]));

  return hasUnread;
}

// Called once app/feedback.tsx has actually loaded the feed — marks
// everything up to now as seen. Uses the current time rather than the
// latest message's own timestamp: anything that existed before this
// screen opened is, by definition, something the user just saw.
export async function markFeedbackSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  } catch {
    // Best-effort — worst case the badge shows again next visit.
  }
}
