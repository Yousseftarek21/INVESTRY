import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { Holding } from '@/types';
import { apiFetch } from '@/utils/api';

// Same key as the original implementation — preserves all existing local data
const LOCAL_KEY = '@istithmarak_holdings';

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
  const { getToken, isSignedIn } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Track the last user who loaded so we can clear state on sign-out
  const loadedRef = useRef(false);

  const persist = useCallback(async (data: Holding[]) => {
    try { await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  // ── Load / clear on auth state change ─────────────────────────────────────
  useEffect(() => {
    // Not signed in — clear everything so no stale data leaks between accounts
    if (!isSignedIn) {
      setHoldings([]);
      setIsLoading(false);
      setSyncError(null);
      loadedRef.current = false;
      return;
    }

    (async () => {
      setIsLoading(true);
      setSyncError(null);

      // 1. Show local data immediately so the UI is never blank
      let localData: Holding[] = [];
      try {
        const raw = await AsyncStorage.getItem(LOCAL_KEY);
        if (raw) { localData = JSON.parse(raw); setHoldings(localData); }
      } catch { /* ignore */ }

      // 2. Fetch authoritative data from the API
      try {
        const t = await token();
        if (!t) { setIsLoading(false); return; }

        const res = await apiFetch('/api/holdings', t);
        if (res.ok) {
          const apiData: Holding[] = await res.json();

          if (apiData.length === 0 && localData.length > 0) {
            // One-time migration: push all local holdings up to the cloud
            // so the user's existing data isn't lost when they first go online
            await Promise.all(
              localData.map(h =>
                apiFetch('/api/holdings', t, { method: 'POST', body: JSON.stringify(h) })
                  .catch(() => null)
              )
            );
            // Local data is canonical for this session; API now has it for next session
            await persist(localData);
          } else if (apiData.length > 0) {
            setHoldings(apiData);
            await persist(apiData);
          }
          // else: both empty — nothing to do

          loadedRef.current = true;
        } else {
          setSyncError('Could not sync — showing local data.');
        }
      } catch {
        setSyncError('Offline — showing local data.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isSignedIn]);

  // ── Add (optimistic) ──────────────────────────────────────────────────────
  const addHolding = useCallback(async (holding: Holding) => {
    setHoldings(prev => { const next = [...prev, holding]; persist(next); return next; });
    try {
      const t = await token();
      if (t) await apiFetch('/api/holdings', t, { method: 'POST', body: JSON.stringify(holding) });
    } catch { setSyncError('Saved locally — will sync when online.'); }
  }, [token, persist]);

  // ── Remove (optimistic) ───────────────────────────────────────────────────
  const removeHolding = useCallback(async (id: string) => {
    setHoldings(prev => { const next = prev.filter(h => h.id !== id); persist(next); return next; });
    try {
      const t = await token();
      if (t) await apiFetch(`/api/holdings/${id}`, t, { method: 'DELETE' });
    } catch { setSyncError('Removed locally — will sync when online.'); }
  }, [token, persist]);

  // ── Update (optimistic) ───────────────────────────────────────────────────
  const updateHolding = useCallback(async (holding: Holding) => {
    setHoldings(prev => { const next = prev.map(h => h.id === holding.id ? holding : h); persist(next); return next; });
    try {
      const t = await token();
      if (t) await apiFetch(`/api/holdings/${holding.id}`, t, { method: 'PUT', body: JSON.stringify(holding) });
    } catch { setSyncError('Updated locally — will sync when online.'); }
  }, [token, persist]);

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
