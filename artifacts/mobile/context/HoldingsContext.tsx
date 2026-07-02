import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { Holding } from '@/types';
import { apiFetch } from '@/utils/api';

// Keep the original key so existing locally-stored data is still found
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
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Persist to local storage (same key as always)
  const persist = useCallback(async (data: Holding[]) => {
    try { await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  // ── Load on sign-in ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn) { setIsLoading(false); return; }

    (async () => {
      setIsLoading(true);
      setSyncError(null);

      // 1. Show local data immediately so the UI is never blank
      let localData: Holding[] = [];
      try {
        const raw = await AsyncStorage.getItem(LOCAL_KEY);
        if (raw) { localData = JSON.parse(raw); setHoldings(localData); }
      } catch { /* ignore */ }

      // 2. Fetch authoritative data from API
      try {
        const t = await token();
        if (!t) { setIsLoading(false); return; }

        const res = await apiFetch('/api/holdings', t);
        if (res.ok) {
          const apiData: Holding[] = await res.json();

          // One-time migration: if the API is empty but we have local data,
          // push everything up so the user doesn't lose their holdings.
          if (apiData.length === 0 && localData.length > 0) {
            await Promise.all(
              localData.map(h => apiFetch('/api/holdings', t, {
                method: 'POST',
                body: JSON.stringify(h),
              }).catch(() => null))
            );
            // Local data is now the source of truth for this session
            setHoldings(localData);
          } else {
            setHoldings(apiData);
            await persist(apiData);
          }
        } else {
          // API failed — keep local data showing
          setSyncError('Offline — showing local data.');
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
