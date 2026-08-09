/**
 * Portfolio tier — a status marker derived from net worth (investments +
 * cash), the same figure the Home hero shows as "Net Worth incl. cash".
 *
 * Single tier by explicit product decision: Pro, reached at 1,000,000 EGP.
 * Below that there is no tier at all — no badge, nothing shown. The earlier
 * four-band ladder (Core/Plus/Pro/Legacy) was cut back to this one on the
 * same call; TIERS stays an array (of one) rather than a bare constant so
 * resolveTier/tierForValue don't need special-casing if a second tier is
 * ever reintroduced.
 *
 * The threshold is fixed EGP by explicit product decision. Worth knowing
 * that this means it drifts with the pound: as EGP depreciates, a user can
 * cross it without their real wealth changing. That's a deliberate trade
 * for a number users can actually remember — revisit it rather than
 * expecting it to hold forever.
 */

export type TierId = 'pro';

export interface Tier {
  id: TierId;
  /** Net worth (EGP) at or above which this tier is reached. */
  minEgp: number;
  /** Rank, ascending. Used to tell a promotion from a demotion. */
  level: number;
}

export const TIERS: Tier[] = [
  { id: 'pro', minEgp: 1_000_000, level: 0 },
];

/**
 * How far net worth must fall *below* the tier's entry point before it's
 * actually lost. Without this a user sitting near the boundary crosses it
 * back and forth on ordinary market noise, and the tier — plus its
 * celebration — fires over and over. Exactly the flapping that made the
 * ±1% portfolio alerts unusable (see portfolioAlertCron), same shape, same
 * fix.
 *
 * Promotion has no such margin: reaching the number is the achievement, and
 * making someone overshoot it to be recognised would be its own small lie.
 */
const DEMOTION_MARGIN = 0.95;

/**
 * The tier a net worth qualifies for outright, ignoring any current tier.
 * Null below Pro's own floor (1M) — there is nothing to round up to.
 */
export function tierForValue(netWorthEgp: number): Tier | null {
  let match: Tier | null = null;
  for (const t of TIERS) {
    if (netWorthEgp >= t.minEgp) match = t;
  }
  return match;
}

export function tierById(id: TierId): Tier {
  return TIERS.find(t => t.id === id) ?? TIERS[0];
}

/**
 * The tier to actually display, given what the user held last time. Null
 * means "no tier" — either net worth has never reached the 1M floor, or it
 * fell back under it after a real, sustained drop.
 *
 * Promotion applies immediately. Losing it only applies once net worth has
 * fallen a clear margin below 1M: a dip to 990k keeps Pro, a real slide to
 * 940k doesn't.
 *
 * `held` is null for a user who has never had a tier resolved (first
 * launch, or net worth that has simply never reached 1M), in which case
 * whatever they qualify for now is simply their starting point — no
 * celebration, nothing was achieved in this session.
 */
export function resolveTier(netWorthEgp: number, held: TierId | null): Tier | null {
  const earned = tierForValue(netWorthEgp);
  if (!held) return earned;

  const heldTier = tierById(held);
  if (earned && earned.level >= heldTier.level) return earned;

  return netWorthEgp < heldTier.minEgp * DEMOTION_MARGIN ? earned : heldTier;
}

/**
 * EGP still needed to reach Pro, or null once there. `current` may be null
 * (not reached yet), in which case "next" is Pro itself.
 */
export function progressToNext(netWorthEgp: number, current: Tier | null): { next: Tier; remainingEgp: number } | null {
  const next = current ? TIERS.find(t => t.level === current.level + 1) : TIERS[0];
  if (!next) return null;
  return { next, remainingEgp: Math.max(0, next.minEgp - netWorthEgp) };
}

/**
 * 0–100: how far net worth has moved toward Pro (or, once there, always
 * 100 — there's nothing ahead left, so full reads as "arrived," not
 * "stuck"). Shared by every place that draws a fraction of this, so they
 * can never silently disagree.
 */
export function bandProgressPct(netWorthEgp: number, current: Tier | null): number {
  const progress = progressToNext(netWorthEgp, current);
  if (!progress) return 100;
  const bandStart = current?.minEgp ?? 0;
  const bandEnd = progress.next.minEgp;
  if (bandEnd <= bandStart) return 100;
  return Math.max(0, Math.min(100, ((netWorthEgp - bandStart) / (bandEnd - bandStart)) * 100));
}
