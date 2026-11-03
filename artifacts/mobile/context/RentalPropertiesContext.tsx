import { devGuestRentals } from '@/utils/devGuest';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import type { RentalBooking, RentalExpense, RentalLease, RentalUnit } from '@/types';
import { apiFetch } from '@/utils/api';

interface RentalData {
  units: RentalUnit[];
  bookings: RentalBooking[];
  leases: RentalLease[];
  expenses: RentalExpense[];
}

type Collection = keyof RentalData;
type ChildCollection = Exclude<Collection, 'units'>;
type ItemOf<C extends Collection> = RentalData[C][number];

const EMPTY: RentalData = { units: [], bookings: [], leases: [], expenses: [] };

function storageKey(userId: string) {
  return `@investry_rental_properties_${userId}`;
}

interface RentalPropertiesContextValue extends RentalData {
  isLoading: boolean;
  /** True once the server has answered at least once this session. */
  loaded: boolean;
  reload: () => Promise<void>;
  add: <C extends Collection>(collection: C, item: ItemOf<C>) => Promise<void>;
  update: <C extends Collection>(collection: C, item: ItemOf<C>) => Promise<void>;
  remove: (collection: Collection, id: string) => Promise<void>;
}

const RentalPropertiesContext = createContext<RentalPropertiesContextValue | null>(null);

export function useRentalProperties() {
  const ctx = useContext(RentalPropertiesContext);
  if (!ctx) throw new Error('useRentalProperties must be used inside RentalPropertiesProvider');
  return ctx;
}

// The server is the source of truth (it also migrates the old flat rental
// list on first load), so there's no local-upload path here: the cache only
// paints the last known state instantly, and every write goes to the server
// first-class with an optimistic update that rolls back on failure.
export function RentalPropertiesProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const [data, setData] = useState<RentalData>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef<string | null>(null);

  const persist = useCallback((next: RentalData, uid: string) => {
    AsyncStorage.setItem(storageKey(uid), JSON.stringify(next)).catch(() => null);
  }, []);

  const token = useCallback(async (): Promise<string | null> => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  const fetchAll = useCallback(async (uid: string) => {
    const t = await token();
    if (!t) return;
    const res = await apiFetch('/api/rental-properties', t);
    if (!res.ok) return;
    const json = (await res.json()) as Partial<RentalData>;
    if (loadedRef.current !== uid) return;
    const next: RentalData = {
      units: json.units ?? [],
      bookings: json.bookings ?? [],
      leases: (json.leases ?? []).map(l => ({ ...l, payments: l.payments ?? [] })),
      expenses: json.expenses ?? [],
    };
    setData(next);
    setLoaded(true);
    persist(next, uid);
  }, [token, persist]);
  // The load effect below must run only when the signed-in user changes.
  // Clerk's getToken (and so fetchAll) is a new function on most renders;
  // with fetchAll in the effect's deps every load re-rendered, re-ran the
  // effect and fetched again — an endless request loop.
  const fetchAllRef = useRef(fetchAll);
  fetchAllRef.current = fetchAll;

  useEffect(() => {
    if (!isSignedIn || !userId) {
      const prev = loadedRef.current;
      setData(devGuestRentals());
      setLoaded(false);
      loadedRef.current = null;
      if (prev) AsyncStorage.removeItem(storageKey(prev)).catch(() => null);
      return;
    }
    if (loadedRef.current && loadedRef.current !== userId) {
      AsyncStorage.removeItem(storageKey(loadedRef.current)).catch(() => null);
      setData(EMPTY);
      setLoaded(false);
    }
    loadedRef.current = userId;
    const uid = userId;
    let active = true;
    (async () => {
      setIsLoading(true);
      try {
        const raw = await AsyncStorage.getItem(storageKey(uid));
        if (active && raw && loadedRef.current === uid) setData({ ...EMPTY, ...JSON.parse(raw) });
      } catch { /* ignore a corrupt cache */ }
      try { await fetchAllRef.current(uid); } catch { /* offline — keep the cache */ }
      if (active && loadedRef.current === uid) setIsLoading(false);
    })();
    return () => { active = false; };
  }, [isSignedIn, userId]);

  const reload = useCallback(async () => {
    if (loadedRef.current) {
      try { await fetchAll(loadedRef.current); } catch { /* keep current state */ }
    }
  }, [fetchAll]);

  // Optimistic write. On failure only this write's own change is undone
  // (computed against the state at apply time), never a whole-state
  // snapshot — a snapshot would also erase any other write that succeeded
  // while this one was in flight. Rethrows so the screen can tell the user.
  const write = useCallback(async (
    apply: (d: RentalData) => { next: RentalData; undo: (d: RentalData) => RentalData },
    request: (t: string) => Promise<Response>,
  ) => {
    if (!userId) throw new Error('Not signed in');
    let undo: ((d: RentalData) => RentalData) | null = null;
    setData(prev => { const r = apply(prev); undo = r.undo; persist(r.next, userId); return r.next; });
    try {
      const t = await token();
      if (!t) throw new Error('Not signed in');
      const res = await request(t);
      if (!res.ok) throw new Error(`${res.status}`);
    } catch (err) {
      setData(prev => { if (!undo) return prev; const next = undo(prev); persist(next, userId); return next; });
      throw err;
    }
  }, [userId, token, persist]);

  const add = useCallback(<C extends Collection>(collection: C, item: ItemOf<C>) =>
    write(
      d => ({
        next: { ...d, [collection]: [...d[collection], item] },
        undo: d2 => ({ ...d2, [collection]: (d2[collection] as Array<{ id: string }>).filter(x => x.id !== item.id) }),
      }),
      t => apiFetch(`/api/rental-properties/${collection}`, t, { method: 'POST', body: JSON.stringify(item) }),
    ), [write]);

  const update = useCallback(<C extends Collection>(collection: C, item: ItemOf<C>) =>
    write(
      d => {
        const previous = (d[collection] as Array<{ id: string }>).find(x => x.id === item.id);
        return {
          next: { ...d, [collection]: (d[collection] as Array<{ id: string }>).map(x => (x.id === item.id ? item : x)) },
          undo: d2 => previous
            ? { ...d2, [collection]: (d2[collection] as Array<{ id: string }>).map(x => (x.id === item.id ? previous : x)) }
            : d2,
        };
      },
      t => apiFetch(`/api/rental-properties/${collection}/${item.id}`, t, { method: 'PUT', body: JSON.stringify(item) }),
    ), [write]);

  const remove = useCallback((collection: Collection, id: string) =>
    write(
      d => {
        // A unit takes everything recorded against it with it (the server does the same).
        const taken = (c: Collection) => (d[c] as Array<{ id: string; unitId?: string }>).filter(x =>
          collection === 'units' ? (c === 'units' ? x.id === id : x.unitId === id) : c === collection && x.id === id);
        const removed = { units: taken('units'), bookings: taken('bookings'), leases: taken('leases'), expenses: taken('expenses') };
        const without = (c: Collection) => (d[c] as Array<{ id: string }>).filter(x => !removed[c].some(r => r.id === x.id));
        return {
          next: { units: without('units'), bookings: without('bookings'), leases: without('leases'), expenses: without('expenses') } as RentalData,
          undo: d2 => {
            const restore = (c: Collection) => {
              const current = d2[c] as Array<{ id: string }>;
              return [...current, ...removed[c].filter(r => !current.some(x => x.id === r.id))];
            };
            return { units: restore('units'), bookings: restore('bookings'), leases: restore('leases'), expenses: restore('expenses') } as RentalData;
          },
        };
      },
      t => apiFetch(`/api/rental-properties/${collection}/${id}`, t, { method: 'DELETE' }),
    ), [write]);

  const value = useMemo<RentalPropertiesContextValue>(
    () => ({ ...data, isLoading, loaded, reload, add, update, remove }),
    [data, isLoading, loaded, reload, add, update, remove],
  );

  return <RentalPropertiesContext.Provider value={value}>{children}</RentalPropertiesContext.Provider>;
}

/** Everything belonging to one unit. */
export function useUnitData(unitId: string | undefined) {
  const { units, bookings, leases, expenses } = useRentalProperties();
  return useMemo(() => {
    const unit = units.find(u => u.id === unitId);
    if (!unit) return null;
    return {
      unit,
      bookings: bookings.filter(b => b.unitId === unitId),
      leases: leases.filter(l => l.unitId === unitId),
      expenses: expenses.filter(e => e.unitId === unitId),
    };
  }, [units, bookings, leases, expenses, unitId]);
}

export type { ChildCollection };
