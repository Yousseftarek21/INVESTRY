import { useCallback } from 'react';
import { apiFetch } from '@/utils/api';
import { useStableGetToken } from './useStableGetToken';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useT } from './useTranslation';

export type ActivityType = 'cash_added' | 'cash_edited' | 'holding_added' | 'holding_edited' | 'holding_sold' | 'income_added' | 'income_edited' | 'income_collected' | 'rental_added' | 'rental_edited'
  | 'rental_unit_added' | 'lease_added' | 'loan_added' | 'loan_payment' | 'loan_paid_off' | 'dividend_added';

export interface ActivityLogEntry {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  entityId?: string | null;
  createdAt: string;
}

// Confirms the user's own add/edit actions on cash accounts and investment
// holdings — logs an entry (merged into Notification History by
// useNotificationHistory) and triggers a real push, unlike every other
// alert in this app which is server-cron-triggered on a delay.
export function useActivityLog() {
  const getToken = useStableGetToken();
  const { hideValues } = useAppSettings();
  const t = useT();

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
      // The push shows on the lock screen: with "hide values" on, keep the
      // amounts out of it and let the tap open the details instead.
      const body = hideValues ? t.actTapForDetails : subtitle;
      await apiFetch('/api/activity', token, {
        method: 'POST',
        body: JSON.stringify({ type, title, subtitle: body, entityId }),
      });
    } catch {
      // Best-effort, see above.
    }
  }, [getToken, hideValues, t]);

  return { fetchRecent, logActivity };
}
