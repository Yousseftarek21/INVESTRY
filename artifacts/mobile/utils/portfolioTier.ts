/**
 * Portfolio tiers — a status band derived from net worth (investments +
 * cash), the same figure the Home hero shows as "Net Worth incl. cash".
 *
 * Three bands: Core (100k – 1M), Plus (1M – 10M), Wealth (10M+). Core starts
 * at 100k, not 0, by explicit product decision — tier 1 itself has to be
 * reached, not handed out for having a few thousand pounds tracked. Below
 * 100k there is genuinely no tier (see tierForValue returning null), same
 * honesty policy as everywhere else in this app: no status badge for having
 * basically nothing, rather than a "Core" that means nothing because
 * everyone always has it.
 *
 * Names describe where the *user* is, not what they hold. Deliberately not
 * Gold/Silver/Platinum: this app holds literal gold and silver as asset
 * types, and a "Gold tier" badge beside a "Gold — 1.04M EGP" row is the same
 * word meaning two different things.
 *
 * Thresholds are fixed EGP by explicit product decision. Worth knowing that
 * this means they drift with the pound: as EGP depreciates, a user can
 * cross a tier without their real wealth changing. That's a deliberate
 * trade for numbers users can actually remember — revisit them rather than
 * expecting them to hold forever.
 */

export type TierId = 'core' | 'plus' | 'wealth';

export interface Tier {
  id: TierId;
  /** Net worth (EGP) at or above which this tier is reached. */
  minEgp: number;
  /** Rank, ascending. Used to tell a promotion from a demotion. */
  level: number;
}

export const TIERS: Tier[] = [
  { id: 'core',   minEgp: 100_000,    level: 0 },
  { id: 'plus',   minEgp: 1_000_000,  level: 1 },
  { id: 'wealth', minEgp: 10_000_000, level: 2 },
];

/**
 * How far net worth must fall *below* a tier's entry point before the tier
 * is actually lost. Without this a user sitting near a boundary crosses it
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
 * Null below Core's own floor (100k) — there is nothing to round up to.
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
 * means "no tier" — either net worth has never reached Core's 100k floor,
 * or it fell back under it after a real, sustained drop.
 *
 * Promotions apply immediately. Demotions — including dropping out of Core
 * entirely — only apply once net worth has fallen a clear margin below the
 * held tier's entry point: a dip to 9.9M keeps Wealth, a real slide to 9.4M
 * doesn't; a dip to 96k keeps Core, a real slide to 94k loses it.
 *
 * `held` is null for a user who has never had a tier resolved (first
 * launch, or net worth that has simply never reached 100k), in which case
 * whatever they qualify for now is simply their starting point.
 */
export function resolveTier(netWorthEgp: number, held: TierId | null): Tier | null {
  const earned = tierForValue(netWorthEgp);
  if (!held) return earned;

  const heldTier = tierById(held);
  if (earned && earned.level >= heldTier.level) return earned;

  // Below the held tier (possibly all the way below Core, in which case
  // `earned` is null): only give it up once past the margin. Re-checking
  // `earned` against the margin — rather than just stepping down one level —
  // means a crash straight through several bands still lands on whatever's
  // genuinely qualified for, including "no tier" if it goes that far.
  return netWorthEgp < heldTier.minEgp * DEMOTION_MARGIN ? earned : heldTier;
}

/**
 * EGP still needed to reach the next tier, or null at the top. `current`
 * may be null (no tier reached yet), in which case "next" is Core itself —
 * the first tier is still a tier to work toward.
 */
export function progressToNext(netWorthEgp: number, current: Tier | null): { next: Tier; remainingEgp: number } | null {
  const next = current ? TIERS.find(t => t.level === current.level + 1) : TIERS[0];
  if (!next) return null;
  return { next, remainingEgp: Math.max(0, next.minEgp - netWorthEgp) };
}

/**
 * 0–100: how far net worth has moved through the *current* band, from the
 * tier just entered to the tier just ahead. 100 at the top (Wealth) —
 * there's no ahead left, so full reads as "arrived," not "stuck".
 */
export function bandProgressPct(netWorthEgp: number, current: Tier | null): number {
  const progress = progressToNext(netWorthEgp, current);
  if (!progress) return 100;
  const bandStart = current?.minEgp ?? 0;
  const bandEnd = progress.next.minEgp;
  if (bandEnd <= bandStart) return 100;
  return Math.max(0, Math.min(100, ((netWorthEgp - bandStart) / (bandEnd - bandStart)) * 100));
}
