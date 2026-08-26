import { Holding } from '@/types';

// Same fungibility rules the old auto-merge used (see add-investment.tsx's
// git history) — gold by karat+form, silver by form, stock by ticker are
// genuinely "more of the same thing" and group into one card. Real estate,
// personal assets, and fixed income are each a distinct, non-fungible item
// (a second property isn't "more of" the first one), so every one of those
// is always its own group of exactly one lot.
function groupKey(h: Holding): string {
  if (h.type === 'gold') return `gold:${h.karat}:${h.form}`;
  if (h.type === 'silver') return `silver:${h.form}`;
  if (h.type === 'stock') return `stock:${h.symbol.toUpperCase()}`;
  return `${h.type}:${h.id}`;
}

export interface LotGroup {
  key: string;
  /** Synthetic, display-only aggregate — never persisted, never sent to the server. Same shape the Holdings list already renders via HoldingCard. */
  displayHolding: Holding;
  /** The real, individually-stored lots this card represents — 1 for anything non-fungible or never split, 2+ once someone's added to a position more than once. */
  lots: Holding[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function aggregate(lots: Holding[]): Holding {
  const first = lots[0];
  if (lots.length === 1) return first;

  if (first.type === 'gold' || first.type === 'silver') {
    const grams = lots.reduce((sum, l) => sum + (l as typeof first).grams, 0);
    const purchasePricePerGram = round2(
      lots.reduce((sum, l) => sum + (l as typeof first).grams * (l as typeof first).purchasePricePerGram, 0) / grams,
    );
    // Earliest purchaseDate reads as "since you first held this," matching
    // what a combined card should imply about how long it's been tracked.
    const purchaseDate = lots.reduce((earliest, l) => (l.purchaseDate < earliest ? l.purchaseDate : earliest), first.purchaseDate);
    return { ...first, grams, purchasePricePerGram, purchaseDate } as Holding;
  }
  if (first.type === 'stock') {
    const shares = lots.reduce((sum, l) => sum + (l as typeof first).shares, 0);
    const purchasePricePerShare = round2(
      lots.reduce((sum, l) => sum + (l as typeof first).shares * (l as typeof first).purchasePricePerShare, 0) / shares,
    );
    const purchaseDate = lots.reduce((earliest, l) => (l.purchaseDate < earliest ? l.purchaseDate : earliest), first.purchaseDate);
    return { ...first, shares, purchasePricePerShare, purchaseDate } as Holding;
  }
  return first;
}

export function groupLots(holdings: Holding[]): LotGroup[] {
  const byKey = new Map<string, Holding[]>();
  for (const h of holdings) {
    const key = groupKey(h);
    const existing = byKey.get(key);
    if (existing) existing.push(h);
    else byKey.set(key, [h]);
  }
  return [...byKey.entries()].map(([key, lots]) => ({ key, displayHolding: aggregate(lots), lots }));
}
