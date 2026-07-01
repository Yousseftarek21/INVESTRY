import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Holding } from '@/types';

const STORAGE_KEY = '@istithmarak_holdings';

interface HoldingsContextValue {
  holdings: Holding[];
  addHolding: (holding: Holding) => Promise<void>;
  removeHolding: (id: string) => Promise<void>;
  updateHolding: (holding: Holding) => Promise<void>;
  isLoading: boolean;
}

const HoldingsContext = createContext<HoldingsContextValue | null>(null);

export function HoldingsProvider({ children }: { children: React.ReactNode }) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setHoldings(JSON.parse(raw));
      } catch {
        // ignore storage errors
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: Holding[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('[Holdings] Failed to persist holdings to storage:', e);
    }
  }, []);

  const addHolding = useCallback(async (holding: Holding) => {
    setHoldings(prev => {
      const next = [...prev, holding];
      persist(next);
      return next;
    });
  }, [persist]);

  const removeHolding = useCallback(async (id: string) => {
    setHoldings(prev => {
      const next = prev.filter(h => h.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const updateHolding = useCallback(async (holding: Holding) => {
    setHoldings(prev => {
      const next = prev.map(h => h.id === holding.id ? holding : h);
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <HoldingsContext.Provider value={{ holdings, addHolding, removeHolding, updateHolding, isLoading }}>
      {children}
    </HoldingsContext.Provider>
  );
}

export function useHoldings() {
  const ctx = useContext(HoldingsContext);
  if (!ctx) throw new Error('useHoldings must be used inside HoldingsProvider');
  return ctx;
}
