import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { usePriceAlertsContext } from '@/context/PriceAlertsContext';
import { useActivityLog, ActivityLogEntry } from '@/hooks/useActivityLog';
import { useT } from '@/hooks/useTranslation';

export interface NotificationEvent {
  id: string;
  type: 'price_alert' | 'portfolio_alert' | 'cash_added' | 'cash_edited' | 'holding_added' | 'holding_edited' | 'holding_sold' | 'income_added' | 'income_edited' | 'income_collected';
  title: string;
  subtitle: string;
  at: string; // ISO timestamp
}

const MAX_EVENTS = 50;

function seenKey(userId: string) {
  return `@investry_notifications_last_seen_${userId}`;
}

/**
 * Real, already-happened alerts — distinct from notifications.tsx's own
 * live-computed cards. Every entry here corresponds 1:1 to a push that was
 * genuinely sent: price_alert rows only exist once triggeredAt is set by
 * the same code path that sends the push; activity_log rows (cash/holding/
 * portfolio_alert) are only written by the server when a push is actually
 * being attempted (see activity.ts and portfolioAlertCron.ts) — so nothing
 * here is fabricated, and portfolio milestones show as one entry per 1%
 * actually pushed, not one summary per day.
 */
export function useNotificationHistory() {
  const { userId } = useAuth();
  const t = useT();
  const { alerts } = usePriceAlertsContext();
  const { fetchRecent: fetchActivity } = useActivityLog();
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<number>(0);
  const loadedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setActivity([]);
      setLastSeenAt(0);
      loadedUserRef.current = null;
      return;
    }
    if (loadedUserRef.current === userId) return;
    loadedUserRef.current = userId;

    AsyncStorage.getItem(seenKey(userId))
      .then(raw => setLastSeenAt(raw ? Number(raw) : 0))
      .catch(() => setLastSeenAt(0));

    fetchActivity().then(setActivity);
    // Deliberately NOT depending on fetchActivity — see PriceAlertsContext.tsx
    // for why an unstable Clerk callback reference in this array is
    // dangerous (refires every render, pegging the JS thread). fetchActivity
    // itself is safe (built on useStableGetToken) but is left out too, to
    // keep this effect's one trigger (userId) obvious at a glance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // The effect above only ever runs once per userId (a whole app session,
  // typically) — fine for the initial load, but it means a server-side
  // alert that lands after that load (any push received while the app was
  // already open) never shows up until the next relaunch. The bell screen
  // calls this on every focus so what it displays is never older than "the
  // last time this screen was opened."
  const refetch = useCallback(() => {
    if (!userId) return;
    fetchActivity().then(setActivity);
  }, [userId, fetchActivity]);

  const events = useMemo<NotificationEvent[]>(() => {
    const result: NotificationEvent[] = [];

    alerts.forEach(a => {
      if (!a.triggered || !a.triggeredAt) return;
      result.push({
        id: `price-${a.id}`,
        type: 'price_alert',
        title: a.assetLabel,
        subtitle: `${a.direction === 'above' ? t.directionAbove : t.directionBelow} ${a.targetPrice.toLocaleString('en-EG', { maximumFractionDigits: 2 })} EGP`,
        at: a.triggeredAt,
      });
    });

    activity.forEach(a => {
      result.push({ id: `activity-${a.id}`, type: a.type, title: a.title, subtitle: a.subtitle, at: a.createdAt });
    });

    return result.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_EVENTS);
  }, [alerts, activity, t]);

  const unreadCount = useMemo(
    () => events.filter(e => new Date(e.at).getTime() > lastSeenAt).length,
    [events, lastSeenAt],
  );

  const markAllRead = useCallback(() => {
    if (!userId) return;
    const now = Date.now();
    setLastSeenAt(now);
    AsyncStorage.setItem(seenKey(userId), String(now)).catch(() => null);
  }, [userId]);

  return { events, unreadCount, markAllRead, refetch };
}
