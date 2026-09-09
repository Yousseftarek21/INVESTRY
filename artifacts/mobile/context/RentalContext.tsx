import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { RentalRecord } from '@/types';
import { apiFetch } from '@/utils/api';

function storageKey(userId: string) {
  return `@investry_rental_records_${userId}`;
}

interface RentalContextValue {
  rentals: RentalRecord[];
  addRental: (r: RentalRecord) => Promise<void>;
  updateRental: (r: RentalRecord) => Promise<void>;
  removeRental: (id: string) => Promise<void>;
  isLoading: boolean;
  syncError: string | null;
}

const RentalContext = createContext<RentalContextValue | null>(null);

export function useRentalRecords() {
  const ctx = useContext(RentalContext);
  if (!ctx) throw new Error('useRentalRecords must be used inside RentalProvider');
  return ctx;
}

// Same load/sync/CRUD shape as DividendsContext — manual entries, not
// recurring, so there's no auto-credit processor here, just persistence.
export function RentalProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();

  const [rentals, setRentals] = useState<RentalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);

  const persist = useCallback(async (data: RentalRecord[], uid: string) => {
    try { await AsyncStorage.setItem(storageKey(uid), JSON.stringify(data)); } catch {}
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      const prevUserId = loadedRef.current;
      setRentals([]);
      setIsLoading(false);
      setSyncError(null);
      loadedRef.current = null;
      if (prevUserId) AsyncStorage.removeItem(storageKey(prevUserId)).catch(() => null);
      return;
    }

    if (loadedRef.current && loadedRef.current !== userId) {
      const prevUserId = loadedRef.current;
      setRentals([]);
      AsyncStorage.removeItem(storageKey(prevUserId)).catch(() => null);
    }

    loadedRef.current = userId;
    const capturedUserId = userId;
    let active = true;

    (async () => {
      setIsLoading(true);
      setSyncError(null);

      let localData: RentalRecord[] = [];
      try {
        const raw = await AsyncStorage.getItem(storageKey(capturedUserId));
        if (!active || loadedRef.current !== capturedUserId) return;
        if (raw) {
          localData = JSON.parse(raw);
          setRentals(localData);
        }
      } catch { /* ignore */ }

      try {
        const t = await token();
        if (!active || loadedRef.current !== capturedUserId) return;
        if (!t) { setIsLoading(false); return; }

        const res = await apiFetch('/api/rentals', t);
        if (!active || loadedRef.current !== capturedUserId) return;

        if (res.ok) {
          const apiData: RentalRecord[] = await res.json();
          if (!active || loadedRef.current !== capturedUserId) return;

          if (apiData.length === 0 && localData.length > 0) {
            await Promise.all(
              localData.map(r =>
                apiFetch('/api/rentals', t, { method: 'POST', body: JSON.stringify(r) })
                  .catch(() => null)
              )
            );
            if (!active || loadedRef.current !== capturedUserId) return;
            await persist(localData, capturedUserId);
          } else if (apiData.length > 0) {
            if (!active || loadedRef.current !== capturedUserId) return;
            setRentals(apiData);
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

  const addRental = useCallback(async (r: RentalRecord) => {
    if (!userId) return;
    setRentals(prev => { const next = [...prev, r]; persist(next, userId); return next; });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch('/api/rentals', t, { method: 'POST', body: JSON.stringify(r) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch (err) {
      setRentals(prev => { const next = prev.filter(x => x.id !== r.id); persist(next, userId); return next; });
      setSyncError('Failed to save — please try again.');
      throw err;
    }
  }, [token, persist, userId]);

  const updateRental = useCallback(async (r: RentalRecord) => {
    if (!userId) return;
    let previous: RentalRecord | undefined;
    setRentals(prev => {
      previous = prev.find(x => x.id === r.id);
      const next = prev.map(x => x.id === r.id ? r : x);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/rentals/${r.id}`, t, { method: 'PUT', body: JSON.stringify(r) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch (err) {
      setRentals(prev => {
        if (!previous) return prev;
        const next = prev.map(x => x.id === r.id ? previous! : x);
        persist(next, userId);
        return next;
      });
      setSyncError('Could not update — please try again.');
      throw err;
    }
  }, [token, persist, userId]);

  const removeRental = useCallback(async (id: string) => {
    if (!userId) return;
    let removed: RentalRecord | undefined;
    setRentals(prev => {
      removed = prev.find(x => x.id === id);
      const next = prev.filter(x => x.id !== id);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/rentals/${id}`, t, { method: 'DELETE' });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch {
      setRentals(prev => {
        if (!removed || prev.some(x => x.id === id)) return prev;
        const next = [...prev, removed!];
        persist(next, userId);
        return next;
      });
      setSyncError('Could not remove — please try again.');
    }
  }, [token, persist, userId]);

  return (
    <RentalContext.Provider value={{ rentals, addRental, updateRental, removeRental, isLoading, syncError }}>
      {children}
    </RentalContext.Provider>
  );
}
