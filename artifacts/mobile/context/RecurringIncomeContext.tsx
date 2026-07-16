import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { RecurringIncome } from '@/types';
import { useCash } from '@/context/CashContext';

function storageKey(userId: string) {
  return `@istithmarak_recurring_incomes_${userId}`;
}

function currentYearMonth(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function effectiveCreditDay(day: number, d: Date = new Date()) {
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.min(day, daysInMonth);
}

interface RecurringIncomeContextValue {
  recurringIncomes: RecurringIncome[];
  addRecurringIncome: (r: RecurringIncome) => Promise<void>;
  updateRecurringIncome: (r: RecurringIncome) => Promise<void>;
  removeRecurringIncome: (id: string) => Promise<void>;
  isLoading: boolean;
}

const RecurringIncomeContext = createContext<RecurringIncomeContextValue | null>(null);

export function useRecurringIncome() {
  const ctx = useContext(RecurringIncomeContext);
  if (!ctx) throw new Error('useRecurringIncome must be used inside RecurringIncomeProvider');
  return ctx;
}

export function RecurringIncomeProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const { cashAccounts, updateCashAccount, isLoading: cashLoading } = useCash();

  const [incomes, setIncomes] = useState<RecurringIncome[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadedRef = useRef<string | null>(null);
  // Tracks the last userId+month that was processed this app session so we
  // never double-credit even if dependencies re-render multiple times.
  const processedKeyRef = useRef<string | null>(null);

  const persist = useCallback(async (data: RecurringIncome[], uid: string) => {
    try { await AsyncStorage.setItem(storageKey(uid), JSON.stringify(data)); } catch {}
  }, []);

  // ── Load / clear on auth state change ────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn || !userId) {
      const prev = loadedRef.current;
      setIncomes([]);
      setIsLoading(false);
      loadedRef.current = null;
      processedKeyRef.current = null;
      if (prev) AsyncStorage.removeItem(storageKey(prev)).catch(() => null);
      return;
    }
    if (loadedRef.current === userId) return;
    loadedRef.current = userId;

    (async () => {
      setIsLoading(true);
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        setIncomes(raw ? (JSON.parse(raw) as RecurringIncome[]) : []);
      } catch {
        setIncomes([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isSignedIn, userId]);

  // ── Credit processor ─────────────────────────────────────────────────────
  // Runs whenever incomes / cashAccounts change. The processedKeyRef guard
  // ensures we only run once per userId+month per app session.
  useEffect(() => {
    if (!userId || cashLoading || isLoading || incomes.length === 0) return;

    const now = new Date();
    const ym = currentYearMonth(now);
    const pKey = `${userId}_${ym}`;
    if (processedKeyRef.current === pKey) return;
    processedKeyRef.current = pKey;

    let changed = false;
    const next = incomes.map(inc => {
      if (!inc.active) return inc;
      if (inc.lastProcessedMonth === ym) return inc;
      if (now < new Date(inc.startDate)) return inc;
      if (inc.endDate && now > new Date(inc.endDate)) return inc;
      if (now.getDate() < effectiveCreditDay(inc.creditDay, now)) return inc;

      const account = cashAccounts.find(a => a.id === inc.cashAccountId);
      if (!account) return inc;

      updateCashAccount({ ...account, balance: (Number(account.balance) || 0) + inc.amount });
      changed = true;
      return { ...inc, lastProcessedMonth: ym };
    });

    if (changed) {
      setIncomes(next);
      persist(next, userId);
    }
  }, [incomes, cashAccounts, cashLoading, isLoading, userId, updateCashAccount, persist]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const addRecurringIncome = useCallback(async (r: RecurringIncome) => {
    if (!userId) return;
    setIncomes(prev => {
      const next = [...prev, r];
      persist(next, userId!);
      return next;
    });
  }, [userId, persist]);

  const updateRecurringIncome = useCallback(async (r: RecurringIncome) => {
    if (!userId) return;
    setIncomes(prev => {
      const next = prev.map(x => x.id === r.id ? r : x);
      persist(next, userId!);
      return next;
    });
  }, [userId, persist]);

  const removeRecurringIncome = useCallback(async (id: string) => {
    if (!userId) return;
    setIncomes(prev => {
      const next = prev.filter(x => x.id !== id);
      persist(next, userId!);
      return next;
    });
  }, [userId, persist]);

  return (
    <RecurringIncomeContext.Provider value={{
      recurringIncomes: incomes,
      addRecurringIncome,
      updateRecurringIncome,
      removeRecurringIncome,
      isLoading,
    }}>
      {children}
    </RecurringIncomeContext.Provider>
  );
}
