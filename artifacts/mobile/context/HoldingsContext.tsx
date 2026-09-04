import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { Holding } from '@/types';
import { apiFetch } from '@/utils/api';

/**
 * Returns the per-user AsyncStorage key so that holdings from one account
 * are never visible to a different account on the same device.
 */
function holdingsKey(userId: string) {
  return `@istithmarak_holdings_${userId}`;
}

// Deterministic JSON stringify (sorted keys), with undefined/null/'' keys
// dropped so all three compare as the same "no value" — used only by
// updateHolding's no-op check below, never persisted. The drop is the fix
// for a real bug caught live: editing screens normalize an unset optional
// field (e.g. notes) from undefined to '' on pre-fill (setNotes(holding.notes
// ?? '')), then always include it as an explicit key on save. An older
// holding that never had notes set at all (key absent, not '') would then
// compare unequal on that key alone — a false "real change" on every
// no-op save, for any holding with an unset optional field. 0/false are
// real, meaningful values and are deliberately NOT dropped here.
function stableStringify(v: unknown): string {
  return JSON.stringify(v, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .filter(k => (value as Record<string, unknown>)[k] !== undefined && (value as Record<string, unknown>)[k] !== null && (value as Record<string, unknown>)[k] !== '')
        .sort()
        .reduce((acc, k) => { acc[k] = (value as Record<string, unknown>)[k]; return acc; }, {} as Record<string, unknown>);
    }
    return value;
  });
}

interface HoldingsContextValue {
  holdings: Holding[];
  addHolding: (holding: Holding) => Promise<void>;
  removeHolding: (id: string) => Promise<void>;
  updateHolding: (holding: Holding) => Promise<void>;
  sellHolding: (id: string, saleProceeds: number, saleDate: string, notes?: string, quantity?: number) => Promise<void>;
  isLoading: boolean;
  syncError: string | null;
}

const HoldingsContext = createContext<HoldingsContextValue | null>(null);

export function HoldingsProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Tracks the userId whose data is currently loaded in memory.
  const loadedUserRef = useRef<string | null>(null);

  const persist = useCallback(async (data: Holding[], uid: string) => {
    try { await AsyncStorage.setItem(holdingsKey(uid), JSON.stringify(data)); } catch { /* ignore */ }
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  // ── Load / clear on auth state change ─────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn || !userId) {
      // Wipe in-memory state immediately so no stale holdings are ever shown
      // to a different account.
      const prevUserId = loadedUserRef.current;
      setHoldings([]);
      setIsLoading(false);
      setSyncError(null);
      loadedUserRef.current = null;

      // Delete the signed-out user's on-disk cache so the next person who
      // opens the app cannot see it even without a network connection.
      if (prevUserId) {
        AsyncStorage.removeItem(holdingsKey(prevUserId)).catch(() => null);
      }
      return;
    }

    // If userId changed without a full sign-out (account switch), wipe first.
    if (loadedUserRef.current && loadedUserRef.current !== userId) {
      const prevUserId = loadedUserRef.current;
      setHoldings([]);
      AsyncStorage.removeItem(holdingsKey(prevUserId)).catch(() => null);
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
      let localData: Holding[] = [];
      try {
        const raw = await AsyncStorage.getItem(holdingsKey(capturedUserId));
        // Guard: bail out if the effect was cancelled or the user changed
        if (!active || loadedUserRef.current !== capturedUserId) return;
        if (raw) {
          localData = JSON.parse(raw);
          setHoldings(localData);
        }
      } catch { /* ignore */ }

      // 2. Fetch authoritative data from the API
      try {
        const t = await token();
        if (!active || loadedUserRef.current !== capturedUserId) return;
        if (!t) { setIsLoading(false); return; }

        const res = await apiFetch('/api/holdings', t);
        if (!active || loadedUserRef.current !== capturedUserId) return;

        if (res.ok) {
          const apiData: Holding[] = await res.json();
          if (!active || loadedUserRef.current !== capturedUserId) return;

          if (apiData.length === 0 && localData.length > 0) {
            // One-time migration: push this user's own local holdings to the
            // cloud. We only reach here if the per-user key had data, which
            // means those holdings were written by this specific userId.
            await Promise.all(
              localData.map(h =>
                apiFetch('/api/holdings', t, { method: 'POST', body: JSON.stringify(h) })
                  .catch(() => null)
              )
            );
            if (!active || loadedUserRef.current !== capturedUserId) return;
            await persist(localData, capturedUserId);
          } else if (apiData.length > 0) {
            if (!active || loadedUserRef.current !== capturedUserId) return;
            setHoldings(apiData);
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

  // ── Add (optimistic, with rollback) ──────────────────────────────────────
  // Rollback only touches this holding's own row via a functional update,
  // rather than restoring a captured full-array snapshot — a snapshot taken
  // before this call went out can be stale by the time it fails, and
  // restoring it would silently erase any other concurrent add/update/remove
  // that succeeded in the meantime.
  const addHolding = useCallback(async (holding: Holding) => {
    if (!userId) return;
    // Stamped locally, not sent to the server (POST body stays the plain
    // holding) — the server's own createdAt/updatedAt (set at insert time)
    // is the source of truth on the next GET, this just makes the "touched
    // today" signal correct the instant the add happens, for
    // touchedToday()'s exclusion of today's-change (see index.tsx).
    const now = new Date().toISOString();
    const stamped: Holding = { ...holding, createdAt: now, updatedAt: now } as Holding;
    setHoldings(prev => {
      const next = [...prev, stamped];
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch('/api/holdings', t, { method: 'POST', body: JSON.stringify(holding) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch (err) {
      setHoldings(prev => {
        const next = prev.filter(h => h.id !== holding.id);
        persist(next, userId);
        return next;
      });
      setSyncError('Failed to save — please try again.');
      throw err; // let the caller know the save actually failed instead of navigating away as if it succeeded
    }
  }, [token, persist, userId]);

  // ── Remove (optimistic, with rollback) ───────────────────────────────────
  const removeHolding = useCallback(async (id: string) => {
    if (!userId) return;
    let removed: Holding | undefined;
    setHoldings(prev => {
      removed = prev.find(h => h.id === id);
      const next = prev.filter(h => h.id !== id);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/holdings/${id}`, t, { method: 'DELETE' });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch {
      setHoldings(prev => {
        if (!removed || prev.some(h => h.id === id)) return prev;
        const next = [...prev, removed];
        persist(next, userId);
        return next;
      });
      setSyncError('Could not remove — please try again.');
    }
  }, [token, persist, userId]);

  // ── Sell (records a realized sale, then removes locally — like remove,
  // but re-throws on failure like add/update since a "sold" action that
  // silently didn't save is worse than one that visibly failed) ───────────
  //
  // `quantity` less than the lot's full grams/shares is a PARTIAL sale — the
  // server shrinks this same lot in place instead of deleting it (see
  // POST /holdings/:id/sell), so the local state mirrors that: update the
  // lot's quantity rather than removing it. Omitting quantity, or passing
  // the full amount, behaves exactly as before.
  const sellHolding = useCallback(async (id: string, saleProceeds: number, saleDate: string, notes?: string, quantity?: number) => {
    if (!userId) return;
    const t = await token();
    if (!t) throw new Error('Not signed in');
    const res = await apiFetch(`/api/holdings/${id}/sell`, t, {
      method: 'POST',
      body: JSON.stringify({ saleProceeds, saleDate, notes, quantity }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    setHoldings(prev => {
      const existing = prev.find(h => h.id === id);
      let fullQty: number | null = null;
      if (existing) {
        if (existing.type === 'gold' || existing.type === 'silver') fullQty = existing.grams;
        else if (existing.type === 'stock') fullQty = existing.shares;
      }
      const isPartial = existing != null && quantity != null && fullQty != null && quantity < fullQty - 1e-9;

      let next: Holding[];
      if (isPartial && existing) {
        const remaining = fullQty! - quantity!;
        const updated = (existing.type === 'stock'
          ? { ...existing, shares: remaining, updatedAt: new Date().toISOString() }
          : { ...existing, grams: remaining, updatedAt: new Date().toISOString() }) as Holding;
        next = prev.map(h => h.id === id ? updated : h);
      } else {
        next = prev.filter(h => h.id !== id);
      }
      persist(next, userId);
      return next;
    });
  }, [token, persist, userId]);

  // ── Update (optimistic, with rollback) ───────────────────────────────────
  const updateHolding = useCallback(async (holding: Holding) => {
    if (!userId) return;
    let previous: Holding | undefined;
    // Same reasoning as addHolding's stamp — local-only, PUT body stays the
    // plain holding. createdAt is carried over from what was already
    // loaded (an edit is not a new holding), only updatedAt moves to now —
    // but ONLY when something actually changed. Opening Edit and tapping
    // Save with nothing touched used to still bump updatedAt unconditionally
    // here, which is what "touched today" (utils/cairoDate.ts) keys off of
    // for whether a holding's Today %-change can safely use live prices —
    // a real user report, confirmed live: a plain re-save silently dropped
    // that holding out of Today's total for the rest of the day, since
    // there was no genuine edit to stamp a fresh reference price from
    // either. The API server has the identical no-op check for the same
    // reason (routes/holdings.ts) — fixed in both places since the client
    // never re-reads updatedAt from the server's response here.
    let stamped: Holding = holding;
    setHoldings(prev => {
      previous = prev.find(h => h.id === holding.id);
      // holding (the raw form payload from the edit screen) never carries
      // createdAt or updatedAt at all — they're only merged in below, after
      // this check — so both have to be stripped from `previous` too, or
      // every save would compare unequal on createdAt alone regardless of
      // whether anything real changed (caught live: the first version of
      // this check compared them still present on one side only).
      const { updatedAt: _prevUpdatedAt, createdAt: _prevCreatedAt, ...prevRest } = (previous ?? {}) as Record<string, unknown>;
      const { updatedAt: _newUpdatedAt, createdAt: _newCreatedAt, ...newRest } = holding as unknown as Record<string, unknown>;
      const isNoOpSave = !!previous && stableStringify(prevRest) === stableStringify(newRest);
      stamped = {
        ...holding,
        updatedAt: isNoOpSave ? previous!.updatedAt : new Date().toISOString(),
        createdAt: previous?.createdAt ?? holding.createdAt,
      } as Holding;
      const next = prev.map(h => h.id === holding.id ? stamped : h);
      persist(next, userId);
      return next;
    });
    try {
      const t = await token();
      if (t) {
        const res = await apiFetch(`/api/holdings/${holding.id}`, t, { method: 'PUT', body: JSON.stringify(holding) });
        if (!res.ok) throw new Error(`${res.status}`);
      }
    } catch (err) {
      setHoldings(prev => {
        if (!previous) return prev;
        const next = prev.map(h => h.id === holding.id ? previous! : h);
        persist(next, userId);
        return next;
      });
      setSyncError('Could not update — please try again.');
      throw err; // let the caller know the save actually failed instead of navigating away as if it succeeded
    }
  }, [token, persist, userId]);

  return (
    <HoldingsContext.Provider value={{ holdings, addHolding, removeHolding, updateHolding, sellHolding, isLoading, syncError }}>
      {children}
    </HoldingsContext.Provider>
  );
}

export function useHoldings() {
  const ctx = useContext(HoldingsContext);
  if (!ctx) throw new Error('useHoldings must be used inside HoldingsProvider');
  return ctx;
}
