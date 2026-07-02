import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { Holding } from '@/types';
import { apiFetch } from '@/utils/api';

const CACHE_KEY = '@istithmarak_holdings_cache';

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

  const cache = useCallback(async (data: Holding[]) => {
    try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  // Load on sign-in: API first, local cache fallback
  useEffect(() => {
    if (!isSignedIn) { setIsLoading(false); return; }

    (async () => {
      setIsLoading(true);
      setSyncError(null);

      // Show cached data immediately so the UI is not blank
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) setHoldings(JSON.parse(cached));
      } catch { /* ignore */ }

      // Fetch authoritative data from the API
      try {
        const t = await token();
        if (t) {
          const res = await apiFetch('/api/holdings', t);
          if (res.ok) {
            const data: Holding[] = await res.json();
            setHoldings(data);
            await cache(data);
          } else {
            setSyncError('Could not sync with server.');
          }
        }
      } catch {
        setSyncError('Offline — showing cached data.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isSignedIn]);

  const addHolding = useCallback(async (holding: Holding) => {
    setHoldings(prev => { const next = [...prev, holding]; cache(next); return next; });
    try {
      const t = await token();
      if (t) await apiFetch('/api/holdings', t, { method: 'POST', body: JSON.stringify(holding) });
    } catch { setSyncError('Saved locally — will sync when online.'); }
  }, [token, cache]);

  const removeHolding = useCallback(async (id: string) => {
    setHoldings(prev => { const next = prev.filter(h => h.id !== id); cache(next); return next; });
    try {
      const t = await token();
      if (t) await apiFetch(`/api/holdings/${id}`, t, { method: 'DELETE' });
    } catch { setSyncError('Removed locally — will sync when online.'); }
  }, [token, cache]);

  const updateHolding = useCallback(async (holding: Holding) => {
    setHoldings(prev => { const next = prev.map(h => h.id === holding.id ? holding : h); cache(next); return next; });
    try {
      const t = await token();
      if (t) await apiFetch(`/api/holdings/${holding.id}`, t, { method: 'PUT', body: JSON.stringify(holding) });
    } catch { setSyncError('Updated locally — will sync when online.'); }
  }, [token, cache]);

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
