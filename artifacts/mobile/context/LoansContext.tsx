import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';
import { DEV_GUEST, devGuestLoans } from '@/utils/devGuest';
import type { Loan } from '@/types';

interface LoansContextValue {
  loans: Loan[];
  isLoading: boolean;
  addLoan: (l: Loan) => Promise<void>;
  updateLoan: (l: Loan) => Promise<void>;
  removeLoan: (id: string) => Promise<void>;
}

const LoansContext = createContext<LoansContextValue | null>(null);

export function useLoans() {
  const ctx = useContext(LoansContext);
  if (!ctx) throw new Error('useLoans must be inside LoansProvider');
  return ctx;
}

function storageKey(userId: string) {
  return `@investry_loans_${userId}`;
}

// Server is the source of truth; the cache only paints the last known list
// instantly. Writes are optimistic and undo their own change if the request
// fails. Loads only when the signed-in user changes (getToken must not be an
// effect dependency — see the 2026-11-02 request-loop fix).
export function LoansProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadedRef = useRef<string | null>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const persist = useCallback((data: Loan[], uid: string) => {
    AsyncStorage.setItem(storageKey(uid), JSON.stringify(data)).catch(() => null);
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getTokenRef.current(); } catch { return null; }
  }, []);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      const prev = loadedRef.current;
      setLoans(devGuestLoans());
      setIsLoading(false);
      loadedRef.current = null;
      if (prev) AsyncStorage.removeItem(storageKey(prev)).catch(() => null);
      return;
    }
    if (loadedRef.current && loadedRef.current !== userId) {
      AsyncStorage.removeItem(storageKey(loadedRef.current)).catch(() => null);
      setLoans([]);
    }
    loadedRef.current = userId;
    const uid = userId;
    let active = true;
    (async () => {
      setIsLoading(true);
      try {
        const raw = await AsyncStorage.getItem(storageKey(uid));
        if (active && raw && loadedRef.current === uid) setLoans(JSON.parse(raw));
      } catch { /* corrupt cache — the server answer replaces it */ }
      try {
        const t = await token();
        if (!t || !active || loadedRef.current !== uid) return;
        const res = await apiFetch('/api/loans', t);
        if (!res.ok || !active || loadedRef.current !== uid) return;
        const data = ((await res.json()) as Loan[]).map(l => ({ ...l, payments: l.payments ?? [] }));
        if (!active || loadedRef.current !== uid) return;
        setLoans(data);
        persist(data, uid);
      } catch { /* offline — keep the cache */ } finally {
        if (active && loadedRef.current === uid) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isSignedIn, userId, token, persist]);

  const write = useCallback(async (
    apply: (list: Loan[]) => Loan[],
    undo: (list: Loan[]) => Loan[],
    request: (t: string) => Promise<Response>,
  ) => {
    // Simulator guest mode: change the demo data on this device only.
    if (!userId && DEV_GUEST) { setLoans(prev => apply(prev)); return; }
    if (!userId) throw new Error('Not signed in');
    setLoans(prev => { const next = apply(prev); persist(next, userId); return next; });
    try {
      const t = await token();
      if (!t) throw new Error('Not signed in');
      const res = await request(t);
      if (!res.ok) throw new Error(`${res.status}`);
    } catch (err) {
      setLoans(prev => { const next = undo(prev); persist(next, userId); return next; });
      throw err;
    }
  }, [userId, token, persist]);

  const addLoan = useCallback((l: Loan) => write(
    list => [...list, l],
    list => list.filter(x => x.id !== l.id),
    t => apiFetch('/api/loans', t, { method: 'POST', body: JSON.stringify(l) }),
  ), [write]);

  const updateLoan = useCallback(async (l: Loan) => {
    let previous: Loan | undefined;
    setLoans(prev => { previous = prev.find(x => x.id === l.id); return prev; });
    return write(
      list => list.map(x => (x.id === l.id ? l : x)),
      list => (previous ? list.map(x => (x.id === l.id ? previous! : x)) : list),
      t => apiFetch(`/api/loans/${l.id}`, t, { method: 'PUT', body: JSON.stringify(l) }),
    );
  }, [write]);

  const removeLoan = useCallback(async (id: string) => {
    let removed: Loan | undefined;
    setLoans(prev => { removed = prev.find(x => x.id === id); return prev; });
    return write(
      list => list.filter(x => x.id !== id),
      list => (removed && !list.some(x => x.id === id) ? [...list, removed] : list),
      t => apiFetch(`/api/loans/${id}`, t, { method: 'DELETE' }),
    );
  }, [write]);

  return (
    <LoansContext.Provider value={{ loans, isLoading, addLoan, updateLoan, removeLoan }}>
      {children}
    </LoansContext.Provider>
  );
}
