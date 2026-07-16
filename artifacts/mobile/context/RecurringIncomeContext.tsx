import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { IncomeTransaction, RecurringIncome } from '@/types';
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

/**
 * Returns all months from `fromExclusive + 1 month` through `toInclusive`.
 * e.g. monthsBetween('2026-04', '2026-07') → ['2026-05','2026-06','2026-07']
 */
function monthsBetween(fromExclusive: string, toInclusive: string): string[] {
  const result: string[] = [];
  let [y, m] = fromExclusive.split('-').map(Number);
  const [ty, tm] = toInclusive.split('-').map(Number);
  m++;
  if (m > 12) { m = 1; y++; }
  while (y < ty || (y === ty && m <= tm)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
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
  const processedKeyRef = useRef<string | null>(null);

  const persist = useCallback(async (data: RecurringIncome[], uid: string) => {
    try { await AsyncStorage.setItem(storageKey(uid), JSON.stringify(data)); } catch {}
  }, []);

  // ── Load / clear on auth state change ─────────────────────────────────────
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

  // ── Credit processor ───────────────────────────────────────────────────────
  // Credits ALL missed months since lastProcessedMonth, not just the current one.
  // For past months the credit day is irrelevant (it already passed).
  // For the current month the credit day must have been reached today.
  useEffect(() => {
    if (!userId || cashLoading || isLoading || incomes.length === 0) return;

    const now = new Date();
    const ym = currentYearMonth(now);
    const pKey = `${userId}_${ym}`;
    if (processedKeyRef.current === pKey) return;
    processedKeyRef.current = pKey;

    const deltas: Record<string, number> = {};
    const nowISO = now.toISOString();
    let changed = false;

    const next = incomes.map(inc => {
      if (!inc.active) return inc;
      if (now < new Date(inc.startDate)) return inc;

      const startYM = currentYearMonth(new Date(inc.startDate));
      const endYM = inc.endDate ? currentYearMonth(new Date(inc.endDate)) : null;

      const candidates = inc.lastProcessedMonth
        ? monthsBetween(inc.lastProcessedMonth, ym)
        : [ym];

      const monthsToCredit = candidates.filter(month => {
        if (month < startYM) return false;
        if (endYM && month > endYM) return false;
        if (month === ym) {
          return now.getDate() >= effectiveCreditDay(inc.creditDay, now);
        }
        return true;
      });

      if (monthsToCredit.length === 0) return inc;

      const totalCredit = inc.amount * monthsToCredit.length;
      deltas[inc.cashAccountId] = (deltas[inc.cashAccountId] || 0) + totalCredit;

      const newTx: IncomeTransaction[] = monthsToCredit.map(month => ({
        month,
        amount: inc.amount,
        creditedAt: nowISO,
      }));

      changed = true;
      return {
        ...inc,
        lastProcessedMonth: ym,
        transactions: [...(inc.transactions ?? []), ...newTx],
      };
    });

    if (changed) {
      Object.entries(deltas).forEach(([accountId, delta]) => {
        const account = cashAccounts.find(a => a.id === accountId);
        if (account) {
          updateCashAccount({ ...account, balance: (Number(account.balance) || 0) + delta });
        }
      });
      setIncomes(next);
      persist(next, userId);
    }
  }, [incomes, cashAccounts, cashLoading, isLoading, userId, updateCashAccount, persist]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const addRecurringIncome = useCallback(async (r: RecurringIncome) => {
    if (!userId) return;
    processedKeyRef.current = null;
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
