import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';

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

interface PriceAlertsContextValue {
  alerts: PriceAlert[];
  addAlert: (a: PriceAlert) => Promise<void>;
  removeAlert: (id: string) => Promise<void>;
  /** Re-pulls from the server — picks up alerts the background cron marked
   *  triggered while the app was closed. Call when the screen is opened. */
  refresh: () => Promise<void>;
  isLoading: boolean;
  syncError: string | null;
}

const PriceAlertsContext = createContext<PriceAlertsContextValue | null>(null);

export function usePriceAlertsContext() {
  const ctx = useContext(PriceAlertsContext);
  if (!ctx) throw new Error('usePriceAlertsContext must be inside PriceAlertsProvider');
  return ctx;
}

function storageKey(userId: string) {
  return `@investry_price_alerts_${userId}`;
}

export function PriceAlertsProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);

  const persist = useCallback(async (data: PriceAlert[], uid: string) => {
    try { await AsyncStorage.setItem(storageKey(uid), JSON.stringify(data)); } catch {}
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  const fetchFromServer = useCallback(async (uid: string): Promise<void> => {
    const t = await token();
    if (!t) return;
    const res = await apiFetch('/api/price-alerts', t);
    if (loadedRef.current !== uid) return;
    if (res.ok) {
      const apiData: PriceAlert[] = await res.json();
      if (loadedRef.current !== uid) return;
      setAlerts(apiData);
      await persist(apiData, uid);
    } else {
      setSyncError('Could not sync — showing local data.');
    }
  }, [token, persist]);

  // ── Load / clear on auth state change ─────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn || !userId) {
      const prevUserId = loadedRef.current;
      setAlerts([]);
      setIsLoading(false);
      setSyncError(null);
      loadedRef.current = null;
      if (prevUserId) AsyncStorage.removeItem(storageKey(prevUserId)).catch(() => null);
      return;
    }

    if (loadedRef.current && loadedRef.current !== userId) {
      const prevUserId = loadedRef.current;
      setAlerts([]);
      AsyncStorage.removeItem(storageKey(prevUserId)).catch(() => null);
    }

    loadedRef.current = userId;
    const capturedUserId = userId;
    let active = true;

    (async () => {
      setIsLoading(true);
      setSyncError(null);

      let localData: PriceAlert[] = [];
      try {
        const raw = await AsyncStorage.getItem(storageKey(capturedUserId));
        if (!active || loadedRef.current !== capturedUserId) return;
        if (raw) {
          localData = JSON.parse(raw);
          setAlerts(localData);
        }
      } catch { /* ignore */ }

      try {
        const t = await token();
        if (!active || loadedRef.current !== capturedUserId) return;
        if (!t) { setIsLoading(false); return; }

        const res = await apiFetch('/api/price-alerts', t);
        if (!active || loadedRef.current !== capturedUserId) return;

        if (res.ok) {
          const apiData: PriceAlert[] = await res.json();
          if (!active || loadedRef.current !== capturedUserId) return;

          if (apiData.length === 0 && localData.length > 0) {
            // One-time migration: push this user's own local alerts to the cloud.
            await Promise.all(
              localData.map(a =>
                apiFetch('/api/price-alerts', t, { method: 'POST', body: JSON.stringify(a) })
                  .catch(() => null)
              )
            );
            if (!active || loadedRef.current !== capturedUserId) return;
            await persist(localData, capturedUserId);
          } else if (apiData.length > 0) {
            if (!active || loadedRef.current !== capturedUserId) return;
            setAlerts(apiData);
            await persist(apiData, capturedUserId);
          }
        } else {
          if (!active || loadedRef.current !== capturedUserId) return;
          setSyncError('Could not sync — showing local data.');
        }
      } catch {
        if (!active || loadedRef.current !== capturedUserId) return;
        setSyncError('Offline — showing local data.');
      } finally {
        if (active && loadedRef.current === capturedUserId) {
          setIsLoading(false);
        }
      }
    })();

    return () => { active = false; };
    // Deliberately NOT depending on `token`/`persist` — Clerk's getToken
    // isn't guaranteed to keep a stable reference across renders, and
    // including it here caused this effect to refire on every render
    // (setIsLoading → re-render → new token identity → refire), pegging
    // the JS thread with a fetch loop from app boot. Matches every other
    // context's load effect (Goals, RecurringIncome, Cash, Holdings).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try { await fetchFromServer(userId); } catch { /* keep showing cached data */ }
  }, [userId, fetchFromServer]);

  // ── Add (optimistic, with rollback) ──────────────────────────────────────
  const addAlert = useCallback(async (a: PriceAlert) => {
    if (!userId) return;
    setAlerts(prev => { const next = [...prev, a]; persist(next, userId); return next; });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch('/api/price-alerts', t, { method: 'POST', body: JSON.stringify(a) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch (err) {
      setAlerts(prev => {
        const next = prev.filter(x => x.id !== a.id);
        persist(next, userId);
        return next;
      });
      setSyncError('Failed to save — please try again.');
      throw err;
    }
  }, [token, persist, userId]);

  // ── Remove (optimistic, with rollback) ───────────────────────────────────
  const removeAlert = useCallback(async (id: string) => {
    if (!userId) return;
    let removed: PriceAlert | undefined;
    setAlerts(prev => {
      removed = prev.find(x => x.id === id);
      const next = prev.filter(x => x.id !== id);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/price-alerts/${id}`, t, { method: 'DELETE' });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch {
      setAlerts(prev => {
        if (!removed || prev.some(x => x.id === id)) return prev;
        const next = [...prev, removed!];
        persist(next, userId);
        return next;
      });
      setSyncError('Could not remove — please try again.');
    }
  }, [token, persist, userId]);

  return (
    <PriceAlertsContext.Provider value={{ alerts, addAlert, removeAlert, refresh, isLoading, syncError }}>
      {children}
    </PriceAlertsContext.Provider>
  );
}
