import type { CashAccount, MarketPrices } from '@/types';

// Converts each cash account's balance to EGP using live FX rates — USD via
// the dedicated usdToEgp field, everything else via fxRates (EGP-per-unit).
// Unknown currencies fall back to face value so totals are never silently
// dropped. Shared by the Overview Cash card total and the Target Allocation
// rebalancing calculation, both of which need one combined EGP figure
// across accounts that don't all share a currency.
export function computeCashTotalEGP(accounts: CashAccount[], prices: Pick<MarketPrices, 'usdToEgp' | 'fxRates'> | null | undefined): number {
  return accounts.reduce((sum, a) => {
    const bal = Number(a.balance) || 0;
    if (a.currency === 'EGP') return sum + bal;
    if (a.currency === 'USD' && prices?.usdToEgp) return sum + bal * prices.usdToEgp;
    const fxRate = prices?.fxRates?.[a.currency];
    if (fxRate) return sum + bal * fxRate;
    return sum + bal;
  }, 0);
}
