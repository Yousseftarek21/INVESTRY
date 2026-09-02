import type { RowIcon } from '@/components/ConceptIcon';

// Single source of truth for every app-wide CONCEPT icon — a glyph that
// represents one named thing (Investments, Bank Account, Loans, ...)
// wherever it shows up across the app, not just a one-off decoration.
//
// The rule going forward: never hardcode one of these icon names inline
// at a call site. Import the constant instead. That's what makes it
// structurally impossible for two different concepts to silently drift
// onto the same icon (or one concept to end up wearing two different
// icons in two different screens) the way it happened twice already —
// once with the old scattered "trending-up" usages for Investments, once
// with the Bank Account / Loans icon collision.
//
// Picking a new icon here? Grep the app for the glyph name first — this
// file only prevents *future* collisions, it doesn't know about icons
// used outside of it (generic, non-concept glyphs like "clock" for
// "time-related" or "trending-up"/"trending-down" for a plain up/down
// value indicator are intentionally NOT concepts and aren't listed here).

/** The app's core "put money into an asset" concept — holdings, portfolio, investments tab. */
export const ICON_INVESTMENTS: RowIcon = { lib: 'mci', name: 'finance' };

/** Money sitting in a linked bank account (Cash Accounts screen's "Bank" type). */
export const ICON_BANK_ACCOUNT: RowIcon = { lib: 'feather', name: 'credit-card' };

/** Outstanding balance on a certificate-backed loan. */
export const ICON_LOANS: RowIcon = { lib: 'mci', name: 'cash-minus' };

/** Recurring income that's accrued but not yet collected. */
export const ICON_PENDING_INCOME: RowIcon = { lib: 'feather', name: 'clock' };

/** Dividend payouts from holdings. */
export const ICON_DIVIDENDS: RowIcon = { lib: 'feather', name: 'pie-chart' };

/** Portfolio rebalancing / drift alerts. */
export const ICON_REBALANCING: RowIcon = { lib: 'feather', name: 'target' };

/** The AI Assistant feature. */
export const ICON_AI_ASSISTANT: RowIcon = { lib: 'feather', name: 'cpu' };

/** The competition / leaderboard ranking feature. */
export const ICON_LEADERBOARD: RowIcon = { lib: 'feather', name: 'award' };

/** The INVESTRY Community Facebook group. */
export const ICON_COMMUNITY: RowIcon = { lib: 'mci', name: 'facebook' };
