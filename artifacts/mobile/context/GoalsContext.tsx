import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline?: string;
  note?: string;
  createdAt: string;
  // When set, savedAmount is treated as a last-known snapshot rather than
  // the source of truth — the goals screen displays the linked cash
  // account's live balance instead, so the goal tracks itself as the
  // account balance changes instead of needing manual re-entry.
  linkedCashAccountId?: string;
}

interface GoalsContextValue {
  goals: Goal[];
  addGoal: (g: Goal) => Promise<void>;
  updateGoal: (g: Goal) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  isLoading: boolean;
  syncError: string | null;
}

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error('useGoals must be inside GoalsProvider');
  return ctx;
}

function storageKey(userId: string) {
  return `@istithmarak_goals_${userId}`;
}

export function GoalsProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);

  const persist = useCallback(async (data: Goal[], uid: string) => {
    try { await AsyncStorage.setItem(storageKey(uid), JSON.stringify(data)); } catch {}
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  // ── Load / clear on auth state change ─────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn || !userId) {
      const prevUserId = loadedRef.current;
      setGoals([]);
      setIsLoading(false);
      setSyncError(null);
      loadedRef.current = null;
      if (prevUserId) AsyncStorage.removeItem(storageKey(prevUserId)).catch(() => null);
      return;
    }

    if (loadedRef.current && loadedRef.current !== userId) {
      const prevUserId = loadedRef.current;
      setGoals([]);
      AsyncStorage.removeItem(storageKey(prevUserId)).catch(() => null);
    }

    loadedRef.current = userId;
    const capturedUserId = userId;
    let active = true;

    (async () => {
      setIsLoading(true);
      setSyncError(null);

      // 1. Show this user's own local cache immediately so the UI is never blank
      let localData: Goal[] = [];
      try {
        const raw = await AsyncStorage.getItem(storageKey(capturedUserId));
        if (!active || loadedRef.current !== capturedUserId) return;
        if (raw) {
          localData = JSON.parse(raw);
          setGoals(localData);
        }
      } catch { /* ignore */ }

      // 2. Fetch authoritative data from the API
      try {
        const t = await token();
        if (!active || loadedRef.current !== capturedUserId) return;
        if (!t) { setIsLoading(false); return; }

        const res = await apiFetch('/api/goals', t);
        if (!active || loadedRef.current !== capturedUserId) return;

        if (res.ok) {
          const apiData: Goal[] = await res.json();
          if (!active || loadedRef.current !== capturedUserId) return;

          if (apiData.length === 0 && localData.length > 0) {
            // One-time migration: push this user's own local goals to the cloud.
            await Promise.all(
              localData.map(g =>
                apiFetch('/api/goals', t, { method: 'POST', body: JSON.stringify(g) })
                  .catch(() => null)
              )
            );
            if (!active || loadedRef.current !== capturedUserId) return;
            await persist(localData, capturedUserId);
          } else if (apiData.length > 0) {
            if (!active || loadedRef.current !== capturedUserId) return;
            setGoals(apiData);
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

  // ── Add (optimistic, with rollback) ──────────────────────────────────────
  const addGoal = useCallback(async (g: Goal) => {
    if (!userId) return;
    setGoals(prev => { const next = [...prev, g]; persist(next, userId); return next; });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch('/api/goals', t, { method: 'POST', body: JSON.stringify(g) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch (err) {
      setGoals(prev => {
        const next = prev.filter(x => x.id !== g.id);
        persist(next, userId);
        return next;
      });
      setSyncError('Failed to save — please try again.');
      throw err;
    }
  }, [token, persist, userId]);

  // ── Update (optimistic, with rollback) ───────────────────────────────────
  const updateGoal = useCallback(async (g: Goal) => {
    if (!userId) return;
    let previous: Goal | undefined;
    setGoals(prev => {
      previous = prev.find(x => x.id === g.id);
      const next = prev.map(x => x.id === g.id ? g : x);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/goals/${g.id}`, t, { method: 'PUT', body: JSON.stringify(g) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch (err) {
      setGoals(prev => {
        if (!previous) return prev;
        const next = prev.map(x => x.id === g.id ? previous! : x);
        persist(next, userId);
        return next;
      });
      setSyncError('Could not update — please try again.');
      throw err;
    }
  }, [token, persist, userId]);

  // ── Remove (optimistic, with rollback) ───────────────────────────────────
  const removeGoal = useCallback(async (id: string) => {
    if (!userId) return;
    let removed: Goal | undefined;
    setGoals(prev => {
      removed = prev.find(x => x.id === id);
      const next = prev.filter(x => x.id !== id);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/goals/${id}`, t, { method: 'DELETE' });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch {
      setGoals(prev => {
        if (!removed || prev.some(x => x.id === id)) return prev;
        const next = [...prev, removed!];
        persist(next, userId);
        return next;
      });
      setSyncError('Could not remove — please try again.');
    }
  }, [token, persist, userId]);

  return (
    <GoalsContext.Provider value={{ goals, addGoal, updateGoal, removeGoal, isLoading, syncError }}>
      {children}
    </GoalsContext.Provider>
  );
}
