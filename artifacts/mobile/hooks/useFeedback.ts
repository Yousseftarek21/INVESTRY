import { useCallback } from 'react';
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
  };
}
