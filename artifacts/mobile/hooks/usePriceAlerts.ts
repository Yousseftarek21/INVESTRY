import { useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@clerk/expo';
import { MarketPrices } from '@/types';
import { goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { EGXStockLive } from '@/hooks/useEGXMarket';

/**
 * Builds the { assetKey: currentPrice } dict alerts are checked against.
 * Shared between the background checker (app/_layout.tsx) and the
 * price-alerts screen (so the "current price" shown while creating an
 * alert always matches what will actually trigger it).
 */
export function buildAlertPricesDict(
  prices: MarketPrices | undefined,
  egxStocks: EGXStockLive[] | undefined,
): Record<string, number> {
  if (!prices) return {};
  const dict: Record<string, number> = {
    usd_egp:     prices.usdToEgp,
    gold_24k:    goldPricePerGram(prices, '24k'),
    gold_22k:    goldPricePerGram(prices, '22k'),
    gold_21k:    goldPricePerGram(prices, '21k'),
    gold_18k:    goldPricePerGram(prices, '18k'),
    silver_gram: silverPricePerGram(prices),
  };
  egxStocks?.forEach(s => { dict[`stock_${s.ticker}`] = s.price; });
  return dict;
}

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

// Namespaced per-user, matching every other local data store (Cash, Holdings,
// Goals, RecurringIncome) — without this, alerts created by one account would
// stay readable, editable, and would keep notifying whoever signs in next on
// the same device.
function alertsKey(userId: string) {
  return `@investry_price_alerts_${userId}`;
}

export async function loadAlerts(userId: string | null | undefined): Promise<PriceAlert[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(alertsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveAlerts(alerts: PriceAlert[], userId: string): Promise<void> {
  try { await AsyncStorage.setItem(alertsKey(userId), JSON.stringify(alerts)); } catch {}
}

export async function addAlert(alert: PriceAlert, userId: string): Promise<void> {
  const alerts = await loadAlerts(userId);
  await saveAlerts([...alerts, alert], userId);
}

export async function removeAlert(id: string, userId: string): Promise<void> {
  const alerts = await loadAlerts(userId);
  await saveAlerts(alerts.filter(a => a.id !== id), userId);
}

/**
 * Call this whenever prices update. Checks all active alerts against current
 * prices, fires a local notification for any that have crossed their threshold,
 * and marks them as triggered so they don't fire again.
 */
export async function checkAlerts(
  prices: Record<string, number>,
  sendNotification: (title: string, body: string) => void,
  userId: string,
): Promise<void> {
  const alerts = await loadAlerts(userId);
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
  if (changed) await saveAlerts(next, userId);
}

/** Hook that runs checkAlerts whenever `prices` changes. */
export function usePriceAlertChecker(prices: Record<string, number> | null, enabled: boolean = true) {
  const { isSignedIn, userId } = useAuth();
  const lastCheckedRef = useRef<string>('');
  const prevUserRef = useRef<string | null>(null);

  const sendNotification = useCallback((title: string, body: string) => {
    Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    }).catch(() => null);
  }, []);

  // Wipe the previous account's alerts from storage on sign-out or account
  // switch, matching Cash/Holdings/Goals/RecurringIncome — otherwise the
  // next person to sign in on this device would inherit them.
  useEffect(() => {
    const prevUser = prevUserRef.current;
    if (prevUser && prevUser !== userId) {
      AsyncStorage.removeItem(alertsKey(prevUser)).catch(() => null);
    }
    prevUserRef.current = userId ?? null;
  }, [userId]);

  useEffect(() => {
    if (!prices || !isSignedIn || !userId || !enabled) return;
    const key = JSON.stringify(prices);
    if (lastCheckedRef.current === key) return;
    lastCheckedRef.current = key;
    checkAlerts(prices, sendNotification, userId);
  }, [prices, isSignedIn, userId, enabled, sendNotification]);
}
