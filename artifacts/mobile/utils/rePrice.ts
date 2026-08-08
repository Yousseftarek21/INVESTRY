import { RealEstateHolding } from '@/types';

/**
 * Returns the current price per m² for a real estate holding: the value the
 * user recorded for this specific property.
 *
 * Deliberately no longer falls back to the curated per-area dataset. Those
 * figures were rough estimates that measured ~4x below real listing prices
 * (scraped New Cairo 5th Settlement: ~62,000 EGP/m² from 296 listings, vs
 * ~13,000 median across the curated set), and because they were consulted
 * *first* they silently overrode the accurate number the user had entered —
 * understating real-estate holdings, and with them net worth, allocation
 * and P/L. A property's own recorded valuation is the honest figure; an
 * area-wide average was never a substitute for it anyway.
 */
export function getREPricePerM2(h: RealEstateHolding): number {
  return h.currentMarketPricePerM2 ?? 0;
}

/**
 * Returns the current market value of a real estate holding, from the
 * property's own recorded price per m².
 */
export function getRECurrentValue(h: RealEstateHolding): number {
  const pricePerM2 = getREPricePerM2(h);
  // Guard: area may be stored as `areaSqm` in older records
  const area = h.area ?? (h as any).areaSqm ?? 0;
  if (pricePerM2 > 0 && area > 0) return area * pricePerM2;
  return h.currentValue ?? 0;
}
