import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { resolveTier, tierById, TIERS, Tier, TierId } from '@/utils/portfolioTier';

function heldKey(userId: string) {
  return `@investry_portfolio_tier_${userId}`;
}

function sinceKey(userId: string) {
  return `@investry_portfolio_tier_since_${userId}`;
}

export interface TierChange {
  /** Null when the user had no tier before this change (their first-ever Core). */
  from: Tier | null;
  /** Null when this change drops them out of Core entirely (net worth back under 100k). */
  to: Tier | null;
  /** True when `to` outranks `from`. Drives which copy the celebration shows. */
  promoted: boolean;
}

/**
 * Resolves the user's current tier from net worth and reports the moment it
 * changes, so the change can be celebrated once and then not again.
 *
 * By explicit product decision, *every* resolved tier is celebration-
 * worthy the first time this hook notices it for a given stored value —
 * including someone who already qualified for a tier before ever opening
 * the app on this build. Reaching Plus overnight, or already sitting above
 * a tier the moment this feature (or a new tier) ships, still shows the
 * unlock the next time the app opens. The only thing that produces no
 * celebration is `nextId === held`: the currently-resolved tier matching
 * what's already on record, i.e. genuinely nothing changed.
 *
 * This is a deliberate reversal of an earlier version of this hook, which
 * suppressed the celebration on the first resolution of every session —
 * meant to avoid congratulating someone for a tier they'd had for a while,
 * but it also meant a real overnight crossing (or a tier reached just
 * before this code ever ran) was never celebrated at all, only silently
 * reflected. Product call: show it.
 *
 * The held tier is persisted per user (AsyncStorage, same convention as the
 * snapshot/intraday hooks) so the celebration survives relaunches instead
 * of re-firing on every cold start.
 *
 * netWorthEgp of 0 is treated as "not loaded yet" rather than a real value:
 * prices and holdings arrive asynchronously, and a transient 0 would
 * otherwise read as a crash out of every tier.
 */
export function usePortfolioTier(netWorthEgp: number) {
  const { userId } = useAuth();
  const [held, setHeld] = useState<TierId | null>(null);
  // ISO date the *current* held tier was entered — real, not fabricated:
  // set only at the moment `held` actually changes (or is first seeded), so
  // it's an honest record rather than "today" dressed up as history.
  const [since, setSince] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [change, setChange] = useState<TierChange | null>(null);
  const loadedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setHeld(null);
      setSince(null);
      setLoaded(false);
      setChange(null);
      loadedUserRef.current = null;
      return;
    }
    if (loadedUserRef.current === userId) return;
    loadedUserRef.current = userId;

    Promise.all([AsyncStorage.getItem(heldKey(userId)), AsyncStorage.getItem(sinceKey(userId))])
      .then(([raw, sinceRaw]) => {
        // Anything not currently a known tier id — including a genuinely
        // absent key for a no-tier user — is treated as "nothing held".
        // Renaming or removing a tier id therefore also re-seeds silently
        // instead of firing a bogus celebration for every existing user on
        // the update that ships the rename.
        const valid = TIERS.some(t => t.id === raw);
        setHeld(valid ? (raw as TierId) : null);
        setSince(valid ? sinceRaw : null);
      })
      .catch(() => { setHeld(null); setSince(null); })
      .finally(() => setLoaded(true));
  }, [userId]);

  useEffect(() => {
    if (!userId || !loaded) return;
    if (!Number.isFinite(netWorthEgp) || netWorthEgp <= 0) return;

    const next = resolveTier(netWorthEgp, held);
    const nextId = next?.id ?? null;
    if (nextId === held) return;

    const persist = () => {
      const nowIso = new Date().toISOString();
      setHeld(nextId);
      setSince(nextId ? nowIso : null);
      if (nextId) {
        AsyncStorage.multiSet([[heldKey(userId), nextId], [sinceKey(userId), nowIso]]).catch(() => null);
      } else {
        AsyncStorage.multiRemove([heldKey(userId), sinceKey(userId)]).catch(() => null);
      }
    };

    // Any change from what's on record celebrates — including from `null`
    // (nothing recorded yet, whether a fresh user or a tier id invalidated
    // by a rename). `from` stays null in that case; TierCelebration reads
    // that as "no previous tier to name," not "nothing happened."
    const from = held ? tierById(held) : null;
    setChange({ from, to: next, promoted: (next?.level ?? -1) > (from?.level ?? -1) });
    persist();
  }, [userId, loaded, netWorthEgp, held]);

  const clearChange = useCallback(() => setChange(null), []);

  return {
    /** Null: net worth hasn't reached Core's 100k floor. */
    tier: held ? tierById(held) : null,
    /** ISO date the current tier was entered, or null alongside a null tier. */
    since,
    /** Non-null only for the render right after a real change; call clearChange once shown. */
    change,
    clearChange,
    ready: loaded,
  };
}
