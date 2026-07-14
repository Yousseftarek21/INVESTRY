import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { Holding } from '@/types';
import { apiFetch } from '@/utils/api';

/**
 * Returns the per-user AsyncStorage key so that holdings from one account
 * are never visible to a different account on the same device.
 */
function holdingsKey(userId: string) {
  return `@istithmarak_holdings_${userId}`;
}

interface HoldingsContextValue {
  holdings: Holding[];
  addHolding: (holding: Holding) => Promise<void>;
  removeHolding: (id: string) => Promise<void>;
  updateHolding: (holding: Holding) => Promise<void>;
  isLoading: boolean;
  syncError: string | null;
}

const HoldingsContext = createContext<HoldingsContextValue | null>(null);

export function HoldingsProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Tracks the userId whose data is currently loaded in memory.
  const loadedUserRef = useRef<string | null>(null);

  const persist = useCallback(async (data: Holding[], uid: string) => {
    try { await AsyncStorage.setItem(holdingsKey(uid), JSON.stringify(data)); } catch { /* ignore */ }
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  // ── Load / clear on auth state change ─────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn || !userId) {
      // Wipe in-memory state immediately so no stale holdings are ever shown
      // to a different account.
      const prevUserId = loadedUserRef.current;
      setHoldings([]);
      setIsLoading(false);
      setSyncError(null);
      loadedUserRef.current = null;

      // Delete the signed-out user's on-disk cache so the next person who
      // opens the app cannot see it even without a network connection.
      if (prevUserId) {
        AsyncStorage.removeItem(holdingsKey(prevUserId)).catch(() => null);
      }
      return;
    }

    // If userId changed without a full sign-out (account switch), wipe first.
    if (loadedUserRef.current && loadedUserRef.current !== userId) {
      const prevUserId = loadedUserRef.current;
      setHoldings([]);
      AsyncStorage.removeItem(holdingsKey(prevUserId)).catch(() => null);
    }

    loadedUserRef.current = userId;

    // Capture the userId this closure is loading for. Every post-await branch
    // checks this value so that a concurrent auth change cannot inject stale
    // data from a prior user into the current session.
    const capturedUserId = userId;
    let active = true;

    (async () => {
      setIsLoading(true);
      setSyncError(null);

      // 1. Show this user's own local cache immediately so the UI is never blank
      let localData: Holding[] = [];
      try {
        const raw = await AsyncStorage.getItem(holdingsKey(capturedUserId));
        // Guard: bail out if the effect was cancelled or the user changed
        if (!active || loadedUserRef.current !== capturedUserId) return;
        if (raw) {
          localData = JSON.parse(raw);
          setHoldings(localData);
        }
      } catch { /* ignore */ }

      // 2. Fetch authoritative data from the API
      try {
        const t = await token();
        if (!active || loadedUserRef.current !== capturedUserId) return;
        if (!t) { setIsLoading(false); return; }

        const res = await apiFetch('/api/holdings', t);
        if (!active || loadedUserRef.current !== capturedUserId) return;

        if (res.ok) {
          const apiData: Holding[] = await res.json();
          if (!active || loadedUserRef.current !== capturedUserId) return;

          if (apiData.length === 0 && localData.length > 0) {
            // One-time migration: push this user's own local holdings to the
            // cloud. We only reach here if the per-user key had data, which
            // means those holdings were written by this specific userId.
            await Promise.all(
              localData.map(h =>
                apiFetch('/api/holdings', t, { method: 'POST', body: JSON.stringify(h) })
                  .catch(() => null)
              )
            );
            if (!active || loadedUserRef.current !== capturedUserId) return;
            await persist(localData, capturedUserId);
          } else if (apiData.length > 0) {
            if (!active || loadedUserRef.current !== capturedUserId) return;
            setHoldings(apiData);
            await persist(apiData, capturedUserId);
          }
          // else: both empty — nothing to do
        } else {
          if (!active || loadedUserRef.current !== capturedUserId) return;
          setSyncError('Could not sync — showing local data.');
        }
      } catch {
        if (!active || loadedUserRef.current !== capturedUserId) return;
        setSyncError('Offline — showing local data.');
      } finally {
        if (active && loadedUserRef.current === capturedUserId) {
          setIsLoading(false);
        }
      }
    })();

    return () => { active = false; };
  }, [isSignedIn, userId]);

  // ── Add (optimistic, with rollback) ──────────────────────────────────────
  const addHolding = useCallback(async (holding: Holding) => {
    if (!userId) return;
    let snapshot: Holding[] = [];
    setHoldings(prev => {
      snapshot = prev;
      const next = [...prev, holding];
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch('/api/holdings', t, { method: 'POST', body: JSON.stringify(holding) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch {
      setHoldings(snapshot);
      persist(snapshot, userId);
      setSyncError('Failed to save — please try again.');
    }
  }, [token, persist, userId]);

  // ── Remove (optimistic, with rollback) ───────────────────────────────────
  const removeHolding = useCallback(async (id: string) => {
    if (!userId) return;
    let snapshot: Holding[] = [];
    setHoldings(prev => {
      snapshot = prev;
      const next = prev.filter(h => h.id !== id);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/holdings/${id}`, t, { method: 'DELETE' });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch {
      setHoldings(snapshot);
      persist(snapshot, userId);
      setSyncError('Could not remove — please try again.');
    }
  }, [token, persist, userId]);

  // ── Update (optimistic, with rollback) ───────────────────────────────────
  const updateHolding = useCallback(async (holding: Holding) => {
    if (!userId) return;
    let snapshot: Holding[] = [];
    setHoldings(prev => {
      snapshot = prev;
      const next = prev.map(h => h.id === holding.id ? holding : h);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/holdings/${holding.id}`, t, { method: 'PUT', body: JSON.stringify(holding) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch {
      setHoldings(snapshot);
      persist(snapshot, userId);
      setSyncError('Could not update — please try again.');
    }
  }, [token, persist, userId]);

  return (
    <HoldingsContext.Provider value={{ holdings, addHolding, removeHolding, updateHolding, isLoading, syncError }}>
      {children}
    </HoldingsContext.Provider>
  );
}

export function useHoldings() {
  const ctx = useContext(HoldingsContext);
  if (!ctx) throw new Error('useHoldings must be used inside HoldingsProvider');
  return ctx;
}
