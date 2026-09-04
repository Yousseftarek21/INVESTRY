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

// Matches the identical helper on the server (routes/holdings.ts) exactly —
// the one thing that's allowed to mark a holding "touched today" for the
// anti-gaming stamp fallback. Editing anything else (price, notes, karat,
// dates) is not a gaming risk against an unchanged quantity, so it must
// never bump updatedAt either — see updateHolding's own comment below.
function holdingQuantity(h: Holding): number | null {
  if (h.type === 'gold' || h.type === 'silver') return Number(h.grams) || 0;
  if (h.type === 'stock') return Number(h.shares) || 0;
  return null;
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
    // loaded (an edit is not a new holding). updatedAt only moves to now on
    // a real QUANTITY change (grams/shares) — matches the identical rule on
    // the server (routes/holdings.ts), which is the actual anti-gaming
    // boundary: only a quantity change can fake that day's gain (bump
    // grams right as the market moves, credit the whole day's % to grams
    // that didn't exist that morning). Two earlier, narrower fixes both
    // missed this and are subsumed by it: bumping updatedAt on ANY real
    // edit (not just quantity) froze "Today" at ~0% for the rest of the day
    // on a plain price/notes/date edit — a live user report, the same
    // holding fixed twice before this — while a true no-op save (nothing
    // changed at all) is just the quantityChanged===false case with an
    // otherwise-identical `holding`, so it's covered here too without a
    // separate check.
    let stamped: Holding = holding;
    setHoldings(prev => {
      previous = prev.find(h => h.id === holding.id);
      const quantityChanged = !previous || holdingQuantity(previous) !== holdingQuantity(holding);
      stamped = {
        ...holding,
        updatedAt: quantityChanged ? new Date().toISOString() : previous!.updatedAt,
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
