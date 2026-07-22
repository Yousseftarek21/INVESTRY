import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';
import { usePriceAlertsContext } from '@/context/PriceAlertsContext';
import { useT } from '@/hooks/useTranslation';

export interface NotificationEvent {
  id: string;
  type: 'price_alert' | 'portfolio_alert';
  title: string;
  subtitle: string;
  at: string; // ISO timestamp
}

interface ServerSnapshot { date: string; totalValue: number; notified: boolean }

function seenKey(userId: string) {
  return `@investry_notifications_last_seen_${userId}`;
}

/**
 * Real, already-happened alerts — distinct from notifications.tsx's own
 * "Upcoming" list (income due soon, live gold/silver moves). Backed by the
 * same rows the push crons already write server-side (price_alerts.
 * triggeredAt, portfolio_snapshots.notified), so this is never fabricated:
 * an event only appears here because a real push was actually sent for it.
 */
export function useNotificationHistory() {
  const { userId, getToken } = useAuth();
  const t = useT();
  const { alerts } = usePriceAlertsContext();
  const [snapshots, setSnapshots] = useState<ServerSnapshot[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<number>(0);
  const loadedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setSnapshots([]);
      setLastSeenAt(0);
      loadedUserRef.current = null;
      return;
    }
    if (loadedUserRef.current === userId) return;
    loadedUserRef.current = userId;

    AsyncStorage.getItem(seenKey(userId))
      .then(raw => setLastSeenAt(raw ? Number(raw) : 0))
      .catch(() => setLastSeenAt(0));

    (async () => {
      try {
        const authToken = await getToken();
        if (!authToken) return;
        const res = await apiFetch('/api/portfolio/snapshots', authToken);
        if (!res.ok) return;
        const rows: ServerSnapshot[] = await res.json();
        setSnapshots(rows);
      } catch { /* offline — just shows price alerts */ }
    })();
    // Deliberately NOT depending on getToken — see PriceAlertsContext.tsx
    // for why an unstable Clerk callback reference in this array is
    // dangerous (refires every render, pegging the JS thread).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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

    const sorted = [...snapshots].sort((x, y) => x.date.localeCompare(y.date));
    sorted.forEach((s, i) => {
      if (!s.notified) return;
      const prev = sorted[i - 1];
      if (!prev || prev.totalValue <= 0) return;
      const pct = ((s.totalValue - prev.totalValue) / prev.totalValue) * 100;
      const up = pct > 0;
      result.push({
        id: `portfolio-${s.date}`,
        type: 'portfolio_alert',
        title: up ? t.portfolioUpAlert : t.portfolioDownAlert,
        subtitle: `${up ? '+' : ''}${pct.toFixed(1)}${t.pctSinceYesterday}`,
        // Snapshots only carry a date, not a real time-of-day — noon UTC
        // keeps same-day ordering stable without implying false precision.
        at: `${s.date}T12:00:00.000Z`,
      });
    });

    return result.sort((a, b) => b.at.localeCompare(a.at));
  }, [alerts, snapshots, t]);

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

  return { events, unreadCount, markAllRead };
}
