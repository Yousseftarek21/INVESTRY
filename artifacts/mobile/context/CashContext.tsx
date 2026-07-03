import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { CashAccount } from '@/types';
import { apiFetch } from '@/utils/api';

/**
 * Returns the per-user AsyncStorage key so that cash accounts from one
 * account are never visible to a different account on the same device.
 */
function cashAccountsKey(userId: string) {
  return `@istithmarak_cash_accounts_${userId}`;
}

interface CashContextValue {
  cashAccounts: CashAccount[];
  addCashAccount: (account: CashAccount) => Promise<void>;
  removeCashAccount: (id: string) => Promise<void>;
  updateCashAccount: (account: CashAccount) => Promise<void>;
  totalCash: number;
  isLoading: boolean;
  syncError: string | null;
}

const CashContext = createContext<CashContextValue | null>(null);

export function CashProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Tracks the userId whose data is currently loaded in memory.
  const loadedUserRef = useRef<string | null>(null);

  const persist = useCallback(async (data: CashAccount[], uid: string) => {
    try { await AsyncStorage.setItem(cashAccountsKey(uid), JSON.stringify(data)); } catch { /* ignore */ }
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  // ── Load / clear on auth state change ─────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn || !userId) {
      // Wipe in-memory state immediately so no stale cash accounts are ever
      // shown to a different account.
      const prevUserId = loadedUserRef.current;
      setCashAccounts([]);
      setIsLoading(false);
      setSyncError(null);
      loadedUserRef.current = null;

      // Delete the signed-out user's on-disk cache so the next person who
      // opens the app cannot see it even without a network connection.
      if (prevUserId) {
        AsyncStorage.removeItem(cashAccountsKey(prevUserId)).catch(() => null);
      }
      return;
    }

    // If userId changed without a full sign-out (account switch), wipe first.
    if (loadedUserRef.current && loadedUserRef.current !== userId) {
      const prevUserId = loadedUserRef.current;
      setCashAccounts([]);
      AsyncStorage.removeItem(cashAccountsKey(prevUserId)).catch(() => null);
    }

    loadedUserRef.current = userId;

    // Capture the userId this closure is loading for. Every post-await branch
    // checks this value so that a concurrent auth change cannot inject stale
    // data from a prior user into the current session.
    const capturedUserId = userId;
    let active = true;

    (async () => {
      setIsLoading(true);
      setSyncError(null);

      // 1. Show this user's own local cache immediately so the UI is never blank
      let localData: CashAccount[] = [];
      try {
        const raw = await AsyncStorage.getItem(cashAccountsKey(capturedUserId));
        // Guard: bail out if the effect was cancelled or the user changed
        if (!active || loadedUserRef.current !== capturedUserId) return;
        if (raw) {
          localData = JSON.parse(raw);
          setCashAccounts(localData);
        }
      } catch { /* ignore */ }

      // 2. Fetch authoritative data from the API
      try {
        const t = await token();
        if (!active || loadedUserRef.current !== capturedUserId) return;
        if (!t) { setIsLoading(false); return; }

        const res = await apiFetch('/api/cash-accounts', t);
        if (!active || loadedUserRef.current !== capturedUserId) return;

        if (res.ok) {
          const apiData: CashAccount[] = await res.json();
          if (!active || loadedUserRef.current !== capturedUserId) return;

          if (apiData.length === 0 && localData.length > 0) {
            // One-time migration: push this user's own local cash accounts to
            // the cloud. We only reach here if the per-user key had data,
            // which means those accounts were written by this specific userId.
            await Promise.all(
              localData.map(a =>
                apiFetch('/api/cash-accounts', t, { method: 'POST', body: JSON.stringify(a) })
                  .catch(() => null)
              )
            );
            if (!active || loadedUserRef.current !== capturedUserId) return;
            await persist(localData, capturedUserId);
          } else if (apiData.length > 0) {
            if (!active || loadedUserRef.current !== capturedUserId) return;
            setCashAccounts(apiData);
            await persist(apiData, capturedUserId);
          }
          // else: both empty — nothing to do
        } else {
          if (!active || loadedUserRef.current !== capturedUserId) return;
          setSyncError('Could not sync — showing local data.');
        }
      } catch {
        if (!active || loadedUserRef.current !== capturedUserId) return;
        setSyncError('Offline — showing local data.');
      } finally {
        if (active && loadedUserRef.current === capturedUserId) {
          setIsLoading(false);
        }
      }
    })();

    return () => { active = false; };
  }, [isSignedIn, userId]);

  // ── Add (optimistic) ──────────────────────────────────────────────────────
  const addCashAccount = useCallback(async (account: CashAccount) => {
    if (!userId) return;
    setCashAccounts(prev => { const next = [...prev, account]; persist(next, userId); return next; });
    try {
      const t = await token();
      if (t) await apiFetch('/api/cash-accounts', t, { method: 'POST', body: JSON.stringify(account) });
    } catch { setSyncError('Saved locally — will sync when online.'); }
  }, [token, persist, userId]);

  // ── Remove (optimistic) ───────────────────────────────────────────────────
  const removeCashAccount = useCallback(async (id: string) => {
    if (!userId) return;
    setCashAccounts(prev => { const next = prev.filter(a => a.id !== id); persist(next, userId); return next; });
    try {
      const t = await token();
      if (t) await apiFetch(`/api/cash-accounts/${id}`, t, { method: 'DELETE' });
    } catch { setSyncError('Removed locally — will sync when online.'); }
  }, [token, persist, userId]);

  // ── Update (optimistic) ───────────────────────────────────────────────────
  const updateCashAccount = useCallback(async (account: CashAccount) => {
    if (!userId) return;
    setCashAccounts(prev => { const next = prev.map(a => a.id === account.id ? account : a); persist(next, userId); return next; });
    try {
      const t = await token();
      if (t) await apiFetch(`/api/cash-accounts/${account.id}`, t, { method: 'PUT', body: JSON.stringify(account) });
    } catch { setSyncError('Updated locally — will sync when online.'); }
  }, [token, persist, userId]);

  const totalCash = cashAccounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <CashContext.Provider value={{ cashAccounts, addCashAccount, removeCashAccount, updateCashAccount, totalCash, isLoading, syncError }}>
      {children}
    </CashContext.Provider>
  );
}

export function useCash() {
  const ctx = useContext(CashContext);
  if (!ctx) throw new Error('useCash must be used inside CashProvider');
  return ctx;
}
