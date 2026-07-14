import { RE_PRICES } from '@/data/egypt-real-estate-prices';
import { RealEstateHolding } from '@/types';

/**
 * Returns the current price per m² for a real estate holding.
 * If the holding has a reAreaId, looks it up from the curated RE_PRICES dataset
 * (updated via OTA). Falls back to the stored currentMarketPricePerM2 for old holdings.
 */
export function getREPricePerM2(h: RealEstateHolding): number {
  if (h.reAreaId) {
    const entry = RE_PRICES.find(p => p.id === h.reAreaId);
    if (entry) return entry.avgPricePerM2;
  }
  return h.currentMarketPricePerM2 ?? 0;
}

/**
 * Returns the current market value of a real estate holding.
 * Uses live RE_PRICES data when available, matching like gold/stocks track market prices.
 */
export function getRECurrentValue(h: RealEstateHolding): number {
  const pricePerM2 = getREPricePerM2(h);
  if (pricePerM2 > 0) return h.area * pricePerM2;
  return h.currentValue ?? 0;
}
