import { useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@clerk/expo';

export interface PriceAlert {
  id: string;
  assetKey: string;
  assetLabel: string;
  targetPrice: number;
  direction: 'above' | 'below';
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}

const ALERTS_KEY = '@investry_price_alerts';

export async function loadAlerts(): Promise<PriceAlert[]> {
  try {
    const raw = await AsyncStorage.getItem(ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveAlerts(alerts: PriceAlert[]): Promise<void> {
  try { await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)); } catch {}
}

export async function addAlert(alert: PriceAlert): Promise<void> {
  const alerts = await loadAlerts();
  await saveAlerts([...alerts, alert]);
}

export async function removeAlert(id: string): Promise<void> {
  const alerts = await loadAlerts();
  await saveAlerts(alerts.filter(a => a.id !== id));
}

/**
 * Call this whenever prices update. Checks all active alerts against current
 * prices, fires a local notification for any that have crossed their threshold,
 * and marks them as triggered so they don't fire again.
 */
export async function checkAlerts(
  prices: Record<string, number>,
  sendNotification: (title: string, body: string) => void,
): Promise<void> {
  const alerts = await loadAlerts();
  let changed = false;
  const next = alerts.map(a => {
    if (a.triggered) return a;
    const current = prices[a.assetKey];
    if (current == null) return a;
    const crossed =
      (a.direction === 'above' && current >= a.targetPrice) ||
      (a.direction === 'below' && current <= a.targetPrice);
    if (!crossed) return a;
    sendNotification(
      a.assetLabel,
      `${a.direction === 'above' ? '↑' : '↓'} Target ${a.targetPrice.toLocaleString('en-EG', { maximumFractionDigits: 2 })} EGP reached`,
    );
    changed = true;
    return { ...a, triggered: true, triggeredAt: new Date().toISOString() };
  });
  if (changed) await saveAlerts(next);
}

/** Hook that runs checkAlerts whenever `prices` changes. */
export function usePriceAlertChecker(prices: Record<string, number> | null) {
  const { isSignedIn } = useAuth();
  const lastCheckedRef = useRef<string>('');

  const sendNotification = useCallback((title: string, body: string) => {
    Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    }).catch(() => null);
  }, []);

  useEffect(() => {
    if (!prices || !isSignedIn) return;
    const key = JSON.stringify(prices);
    if (lastCheckedRef.current === key) return;
    lastCheckedRef.current = key;
    checkAlerts(prices, sendNotification);
  }, [prices, isSignedIn, sendNotification]);
}
