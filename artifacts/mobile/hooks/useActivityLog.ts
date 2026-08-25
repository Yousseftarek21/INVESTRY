import { useCallback } from 'react';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';

export type ActivityType = 'cash_added' | 'cash_edited' | 'holding_added' | 'holding_edited' | 'holding_sold';

export interface ActivityLogEntry {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  createdAt: string;
}

// Confirms the user's own add/edit actions on cash accounts and investment
// holdings — logs an entry (merged into Notification History by
// useNotificationHistory) and triggers a real push, unlike every other
// alert in this app which is server-cron-triggered on a delay.
export function useActivityLog() {
  const getToken = useStableGetToken();

  const fetchRecent = useCallback(async (): Promise<ActivityLogEntry[]> => {
    try {
      const token = await getToken();
      if (!token) return [];
      const res = await apiFetch('/api/activity', token);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }, [getToken]);

  // Best-effort: if this fails, the add/edit the user just made (already
  // saved separately) is unaffected — only the confirmation is lost.
  // entityId (the cash account / holding id this describes) lets the
  // server clean up this entry automatically if that account/holding is
  // later deleted — otherwise it'd keep showing in the bell forever.
  const logActivity = useCallback(async (type: ActivityType, title: string, subtitle: string, entityId?: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await apiFetch('/api/activity', token, {
        method: 'POST',
        body: JSON.stringify({ type, title, subtitle, entityId }),
      });
    } catch {
      // Best-effort, see above.
    }
  }, [getToken]);

  return { fetchRecent, logActivity };
}
