import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { Dividend } from '@/types';
import { apiFetch } from '@/utils/api';

function storageKey(userId: string) {
  return `@investry_dividends_${userId}`;
}

interface DividendsContextValue {
  dividends: Dividend[];
  addDividend: (d: Dividend) => Promise<void>;
  updateDividend: (d: Dividend) => Promise<void>;
  removeDividend: (id: string) => Promise<void>;
  isLoading: boolean;
  syncError: string | null;
}

const DividendsContext = createContext<DividendsContextValue | null>(null);

export function useDividends() {
  const ctx = useContext(DividendsContext);
  if (!ctx) throw new Error('useDividends must be used inside DividendsProvider');
  return ctx;
}

// Same load/sync/CRUD shape as RecurringIncomeContext — manual entries, not
// recurring, so there's no auto-credit processor here, just persistence.
export function DividendsProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();

  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);

  const persist = useCallback(async (data: Dividend[], uid: string) => {
    try { await AsyncStorage.setItem(storageKey(uid), JSON.stringify(data)); } catch {}
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      const prevUserId = loadedRef.current;
      setDividends([]);
      setIsLoading(false);
      setSyncError(null);
      loadedRef.current = null;
      if (prevUserId) AsyncStorage.removeItem(storageKey(prevUserId)).catch(() => null);
      return;
    }

    if (loadedRef.current && loadedRef.current !== userId) {
      const prevUserId = loadedRef.current;
      setDividends([]);
      AsyncStorage.removeItem(storageKey(prevUserId)).catch(() => null);
    }

    loadedRef.current = userId;
    const capturedUserId = userId;
    let active = true;

    (async () => {
      setIsLoading(true);
      setSyncError(null);

      let localData: Dividend[] = [];
      try {
        const raw = await AsyncStorage.getItem(storageKey(capturedUserId));
        if (!active || loadedRef.current !== capturedUserId) return;
        if (raw) {
          localData = JSON.parse(raw);
          setDividends(localData);
        }
      } catch { /* ignore */ }

      try {
        const t = await token();
        if (!active || loadedRef.current !== capturedUserId) return;
        if (!t) { setIsLoading(false); return; }

        const res = await apiFetch('/api/dividends', t);
        if (!active || loadedRef.current !== capturedUserId) return;

        if (res.ok) {
          const apiData: Dividend[] = await res.json();
          if (!active || loadedRef.current !== capturedUserId) return;

          if (apiData.length === 0 && localData.length > 0) {
            await Promise.all(
              localData.map(d =>
                apiFetch('/api/dividends', t, { method: 'POST', body: JSON.stringify(d) })
                  .catch(() => null)
              )
            );
            if (!active || loadedRef.current !== capturedUserId) return;
            await persist(localData, capturedUserId);
          } else if (apiData.length > 0) {
            if (!active || loadedRef.current !== capturedUserId) return;
            setDividends(apiData);
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
  }, [isSignedIn, userId]);

  const addDividend = useCallback(async (d: Dividend) => {
    if (!userId) return;
    setDividends(prev => { const next = [...prev, d]; persist(next, userId); return next; });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch('/api/dividends', t, { method: 'POST', body: JSON.stringify(d) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch (err) {
      setDividends(prev => { const next = prev.filter(x => x.id !== d.id); persist(next, userId); return next; });
      setSyncError('Failed to save — please try again.');
      throw err;
    }
  }, [token, persist, userId]);

  const updateDividend = useCallback(async (d: Dividend) => {
    if (!userId) return;
    let previous: Dividend | undefined;
    setDividends(prev => {
      previous = prev.find(x => x.id === d.id);
      const next = prev.map(x => x.id === d.id ? d : x);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/dividends/${d.id}`, t, { method: 'PUT', body: JSON.stringify(d) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch (err) {
      setDividends(prev => {
        if (!previous) return prev;
        const next = prev.map(x => x.id === d.id ? previous! : x);
        persist(next, userId);
        return next;
      });
      setSyncError('Could not update — please try again.');
      throw err;
    }
  }, [token, persist, userId]);

  const removeDividend = useCallback(async (id: string) => {
    if (!userId) return;
    let removed: Dividend | undefined;
    setDividends(prev => {
      removed = prev.find(x => x.id === id);
      const next = prev.filter(x => x.id !== id);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/dividends/${id}`, t, { method: 'DELETE' });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch {
      setDividends(prev => {
        if (!removed || prev.some(x => x.id === id)) return prev;
        const next = [...prev, removed!];
        persist(next, userId);
        return next;
      });
      setSyncError('Could not remove — please try again.');
    }
  }, [token, persist, userId]);

  return (
    <DividendsContext.Provider value={{ dividends, addDividend, updateDividend, removeDividend, isLoading, syncError }}>
      {children}
    </DividendsContext.Provider>
  );
}
