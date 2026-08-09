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
 * `held` is `null` for two different reasons that both display identically
 * (no badge) but must NOT be conflated when deciding whether to celebrate:
 * "storage hasn't loaded yet" and "confirmed: this user has no tier, net
 * worth is under Core's 100k floor." `seededRef` is what actually separates
 * them — it flips true the first time this hook resolves anything for the
 * current user, seed or not, and only changes observed *after* that are
 * real enough to celebrate. Without it, a user who has genuinely never
 * reached 100k would get "congratulated" into Core the instant they cross
 * it for real, indistinguishable from every prior render that also read as
 * "held is null."
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
  const seededRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setHeld(null);
      setSince(null);
      setLoaded(false);
      setChange(null);
      loadedUserRef.current = null;
      seededRef.current = false;
      return;
    }
    if (loadedUserRef.current === userId) return;
    loadedUserRef.current = userId;
    seededRef.current = false;

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

    if (!seededRef.current) {
      // First resolution this session for this user — seed at whatever
      // they qualify for (which may itself be "no tier"), never celebrate.
      seededRef.current = true;
      if (nextId !== held) persist();
      return;
    }

    if (nextId === held) return;

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
