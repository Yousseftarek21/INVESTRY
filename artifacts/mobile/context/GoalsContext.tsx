import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline?: string;
  note?: string;
  createdAt: string;
}

interface GoalsContextValue {
  goals: Goal[];
  addGoal: (g: Goal) => Promise<void>;
  updateGoal: (g: Goal) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  isLoading: boolean;
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
  const { isSignedIn, userId } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadedRef = useRef<string | null>(null);

  const persist = useCallback(async (data: Goal[], uid: string) => {
    try { await AsyncStorage.setItem(storageKey(uid), JSON.stringify(data)); } catch {}
  }, []);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      const prev = loadedRef.current;
      setGoals([]);
      loadedRef.current = null;
      if (prev) AsyncStorage.removeItem(storageKey(prev)).catch(() => null);
      return;
    }
    if (loadedRef.current === userId) return;
    loadedRef.current = userId;
    (async () => {
      setIsLoading(true);
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        setGoals(raw ? JSON.parse(raw) : []);
      } catch { setGoals([]); } finally { setIsLoading(false); }
    })();
  }, [isSignedIn, userId]);

  const addGoal = useCallback(async (g: Goal) => {
    if (!userId) return;
    setGoals(prev => { const next = [...prev, g]; persist(next, userId!); return next; });
  }, [userId, persist]);

  const updateGoal = useCallback(async (g: Goal) => {
    if (!userId) return;
    setGoals(prev => { const next = prev.map(x => x.id === g.id ? g : x); persist(next, userId!); return next; });
  }, [userId, persist]);

  const removeGoal = useCallback(async (id: string) => {
    if (!userId) return;
    setGoals(prev => { const next = prev.filter(x => x.id !== id); persist(next, userId!); return next; });
  }, [userId, persist]);

  return (
    <GoalsContext.Provider value={{ goals, addGoal, updateGoal, removeGoal, isLoading }}>
      {children}
    </GoalsContext.Provider>
  );
}
