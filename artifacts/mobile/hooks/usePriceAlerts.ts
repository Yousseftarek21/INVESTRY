import { MarketPrices } from '@/types';
import { goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { EGXStockLive } from '@/hooks/useEGXMarket';
import { GlobalStockLive } from '@/hooks/useGlobalStocks';

/**
 * Builds the { assetKey: currentPrice } dict alerts are checked against.
 * Also used server-side (mirrored in api-server's userPriceAlertCron.ts) so
 * the "current price" shown while creating an alert matches what the
 * background push check actually evaluates. EGX and US stocks share the
 * same `stock_<ticker>` key shape — the two ticker sets don't collide in
 * practice, so no market prefix is needed.
 */
export function buildAlertPricesDict(
  prices: MarketPrices | undefined,
  egxStocks: EGXStockLive[] | undefined,
  globalStocks?: GlobalStockLive[] | undefined,
): Record<string, number> {
  if (!prices) return {};
  const dict: Record<string, number> = {
    usd_egp:     prices.usdToEgp,
    gold_24k:    goldPricePerGram(prices, '24k'),
    gold_22k:    goldPricePerGram(prices, '22k'),
    gold_21k:    goldPricePerGram(prices, '21k'),
    gold_18k:    goldPricePerGram(prices, '18k'),
    silver_gram: silverPricePerGram(prices),
  };
  egxStocks?.forEach(s => { dict[`stock_${s.ticker}`] = s.price; });
  globalStocks?.forEach(s => { dict[`stock_${s.ticker}`] = s.price; });
  return dict;
}
