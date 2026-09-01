import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { IncomeTransaction, RecurringIncome } from '@/types';
import { useCash } from '@/context/CashContext';
import { useCashBalanceUpdates } from '@/hooks/useCashBalanceUpdates';
import { applyOptimisticTodayChange } from '@/hooks/useCashAccountsTodayChanges';
import { apiFetch } from '@/utils/api';

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
  /** 'pending' entries only — deposits the amount into the chosen cash
      account and flips `collected`, taking it out of the pending net-worth
      total. Kept (not deleted) so it still shows in history, same as a
      recurring entry's credited-month transactions. */
  markIncomeCollected: (id: string, cashAccountId: string) => Promise<void>;
  isLoading: boolean;
  syncError: string | null;
}

const RecurringIncomeContext = createContext<RecurringIncomeContextValue | null>(null);

export function useRecurringIncome() {
  const ctx = useContext(RecurringIncomeContext);
  if (!ctx) throw new Error('useRecurringIncome must be used inside RecurringIncomeProvider');
  return ctx;
}

export function RecurringIncomeProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const { cashAccounts, updateCashAccount, isLoading: cashLoading } = useCash();
  // Only the write path (logUpdate) is used here — per-account history is
  // read elsewhere (cash-accounts.tsx). Without this, a credit deposited
  // into a cash account (mark-collected, or the monthly recurring credit)
  // silently bumped the account's balance field with no logged transaction,
  // so it never showed up under that account's "Recent updates" feed.
  const { logUpdate: logBalanceUpdate } = useCashBalanceUpdates(null);
  // Same optimistic-badge fix as cash-accounts.tsx's own edits/transfers —
  // without this, the "+/- today" chip on a cash account card only updated
  // after Cash Accounts' own today-changes query refetched from the server,
  // which nothing here ever triggered directly, so a mark-collected credit
  // (or a monthly recurring credit) could sit invisible on the badge for as
  // long as that screen's 30s cache stayed fresh.
  const queryClient = useQueryClient();

  const [incomes, setIncomes] = useState<RecurringIncome[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);
  const processedKeyRef = useRef<string | null>(null);

  const persist = useCallback(async (data: RecurringIncome[], uid: string) => {
    try { await AsyncStorage.setItem(storageKey(uid), JSON.stringify(data)); } catch {}
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  // ── Load / clear on auth state change ─────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn || !userId) {
      const prevUserId = loadedRef.current;
      setIncomes([]);
      setIsLoading(false);
      setSyncError(null);
      loadedRef.current = null;
      processedKeyRef.current = null;
      if (prevUserId) AsyncStorage.removeItem(storageKey(prevUserId)).catch(() => null);
      return;
    }

    if (loadedRef.current && loadedRef.current !== userId) {
      const prevUserId = loadedRef.current;
      setIncomes([]);
      AsyncStorage.removeItem(storageKey(prevUserId)).catch(() => null);
    }

    loadedRef.current = userId;
    const capturedUserId = userId;
    let active = true;

    (async () => {
      setIsLoading(true);
      setSyncError(null);

      let localData: RecurringIncome[] = [];
      try {
        const raw = await AsyncStorage.getItem(storageKey(capturedUserId));
        if (!active || loadedRef.current !== capturedUserId) return;
        if (raw) {
          localData = JSON.parse(raw);
          setIncomes(localData);
        }
      } catch { /* ignore */ }

      try {
        const t = await token();
        if (!active || loadedRef.current !== capturedUserId) return;
        if (!t) { setIsLoading(false); return; }

        const res = await apiFetch('/api/recurring-income', t);
        if (!active || loadedRef.current !== capturedUserId) return;

        if (res.ok) {
          const apiData: RecurringIncome[] = await res.json();
          if (!active || loadedRef.current !== capturedUserId) return;

          if (apiData.length === 0 && localData.length > 0) {
            await Promise.all(
              localData.map(r =>
                apiFetch('/api/recurring-income', t, { method: 'POST', body: JSON.stringify(r) })
                  .catch(() => null)
              )
            );
            if (!active || loadedRef.current !== capturedUserId) return;
            await persist(localData, capturedUserId);
          } else if (apiData.length > 0) {
            if (!active || loadedRef.current !== capturedUserId) return;
            setIncomes(apiData);
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

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const addRecurringIncome = useCallback(async (r: RecurringIncome) => {
    if (!userId) return;
    processedKeyRef.current = null;
    setIncomes(prev => { const next = [...prev, r]; persist(next, userId); return next; });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch('/api/recurring-income', t, { method: 'POST', body: JSON.stringify(r) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch (err) {
      setIncomes(prev => { const next = prev.filter(x => x.id !== r.id); persist(next, userId); return next; });
      setSyncError('Failed to save — please try again.');
      throw err;
    }
  }, [token, persist, userId]);

  const updateRecurringIncome = useCallback(async (r: RecurringIncome) => {
    if (!userId) return;
    let previous: RecurringIncome | undefined;
    setIncomes(prev => {
      previous = prev.find(x => x.id === r.id);
      const next = prev.map(x => x.id === r.id ? r : x);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/recurring-income/${r.id}`, t, { method: 'PUT', body: JSON.stringify(r) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch (err) {
      setIncomes(prev => {
        if (!previous) return prev;
        const next = prev.map(x => x.id === r.id ? previous! : x);
        persist(next, userId);
        return next;
      });
      setSyncError('Could not update — please try again.');
      throw err;
    }
  }, [token, persist, userId]);

  const removeRecurringIncome = useCallback(async (id: string) => {
    if (!userId) return;
    let removed: RecurringIncome | undefined;
    setIncomes(prev => {
      removed = prev.find(x => x.id === id);
      const next = prev.filter(x => x.id !== id);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/recurring-income/${id}`, t, { method: 'DELETE' });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch {
      setIncomes(prev => {
        if (!removed || prev.some(x => x.id === id)) return prev;
        const next = [...prev, removed!];
        persist(next, userId);
        return next;
      });
      setSyncError('Could not remove — please try again.');
    }
  }, [token, persist, userId]);

  // ── Mark a pending entry collected ─────────────────────────────────────────
  // Deposits the amount into the chosen cash account (same balance-bump the
  // credit processor does for recurring entries) and flips `collected` so
  // it drops out of the pending net-worth total, without deleting the entry.
  const markIncomeCollected = useCallback(async (id: string, cashAccountId: string) => {
    const inc = incomes.find(x => x.id === id);
    if (!inc || inc.collected) return;
    const account = cashAccounts.find(a => a.id === cashAccountId);
    if (!account) return;

    const resultingBalance = (Number(account.balance) || 0) + inc.amount;
    await updateCashAccount({ ...account, balance: resultingBalance });
    applyOptimisticTodayChange(queryClient, account.id, inc.amount);
    logBalanceUpdate(account.id, inc.amount, resultingBalance);
    await updateRecurringIncome({ ...inc, cashAccountId, collected: true });
  }, [incomes, cashAccounts, updateCashAccount, updateRecurringIncome, logBalanceUpdate, queryClient]);

  // ── Credit processor ───────────────────────────────────────────────────────
  // Credits ALL missed months since lastProcessedMonth, not just the current one.
  // For past months the credit day is irrelevant (it already passed).
  // For the current month the credit day must have been reached today.
  // Each changed entry is synced through updateRecurringIncome (not a direct
  // local setIncomes) so an auto-credit is persisted to the server exactly
  // like a manual edit — otherwise a month's credit would only ever exist on
  // this one device and vanish on sign-out.
  useEffect(() => {
    if (!userId || cashLoading || isLoading || incomes.length === 0) return;

    const now = new Date();
    const ym = currentYearMonth(now);
    const pKey = `${userId}_${ym}`;
    if (processedKeyRef.current === pKey) return;
    processedKeyRef.current = pKey;

    const deltas: Record<string, number> = {};
    const nowISO = now.toISOString();
    const changedIncomes: RecurringIncome[] = [];

    incomes.forEach(inc => {
      // 'pending' entries (one-off, uncollected receivables) have no
      // credit schedule at all — they count toward net worth directly
      // (see the pending-income total in app/(tabs)/index.tsx) until
      // markIncomeCollected deposits them, so this monthly processor must
      // never touch them.
      if (inc.kind === 'pending') return;
      if (!inc.active) return;
      if (now < new Date(inc.startDate)) return;

      // If the linked cash account was deleted, there's nowhere for this
      // credit to land. Leave lastProcessedMonth untouched (don't fabricate
      // a "credited" transaction for money that never moved) so it can
      // catch up correctly if the account is ever recreated.
      const targetAccountId = inc.cashAccountId;
      if (!targetAccountId || !cashAccounts.some(a => a.id === targetAccountId)) return;

      const startYM = currentYearMonth(new Date(inc.startDate));
      const endYM = inc.endDate ? currentYearMonth(new Date(inc.endDate)) : null;

      const candidates = inc.lastProcessedMonth
        ? monthsBetween(inc.lastProcessedMonth, ym)
        : [ym];

      const monthsToCredit = candidates.filter(month => {
        if (month < startYM) return false;
        if (endYM && month > endYM) return false;
        if (month === ym) {
          return now.getDate() >= effectiveCreditDay(inc.creditDay ?? 1, now);
        }
        return true;
      });

      if (monthsToCredit.length === 0) return;

      const totalCredit = inc.amount * monthsToCredit.length;
      deltas[targetAccountId] = (deltas[targetAccountId] || 0) + totalCredit;

      const newTx: IncomeTransaction[] = monthsToCredit.map(month => ({
        month,
        amount: inc.amount,
        creditedAt: nowISO,
      }));

      changedIncomes.push({
        ...inc,
        lastProcessedMonth: ym,
        transactions: [...(inc.transactions ?? []), ...newTx],
      });
    });

    if (changedIncomes.length > 0) {
      Object.entries(deltas).forEach(([accountId, delta]) => {
        const account = cashAccounts.find(a => a.id === accountId);
        if (account) {
          const resultingBalance = (Number(account.balance) || 0) + delta;
          updateCashAccount({ ...account, balance: resultingBalance });
          applyOptimisticTodayChange(queryClient, accountId, delta);
          logBalanceUpdate(accountId, delta, resultingBalance);
        }
      });
      changedIncomes.forEach(inc => { updateRecurringIncome(inc).catch(() => null); });
    }
  }, [incomes, cashAccounts, cashLoading, isLoading, userId, updateCashAccount, updateRecurringIncome, logBalanceUpdate, queryClient]);

  return (
    <RecurringIncomeContext.Provider value={{
      recurringIncomes: incomes,
      addRecurringIncome,
      updateRecurringIncome,
      removeRecurringIncome,
      markIncomeCollected,
      isLoading,
      syncError,
    }}>
      {children}
    </RecurringIncomeContext.Provider>
  );
}
