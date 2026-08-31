import type { CashAccount, MarketPrices, RecurringIncome } from '@/types';

// Converts one amount to EGP using live FX rates — USD via the dedicated
// usdToEgp field, everything else via fxRates (EGP-per-unit). Unknown
// currencies fall back to face value so totals are never silently dropped.
function convertToEgp(amount: number, currency: string, prices: Pick<MarketPrices, 'usdToEgp' | 'fxRates'> | null | undefined): number {
  if (currency === 'EGP') return amount;
  if (currency === 'USD' && prices?.usdToEgp) return amount * prices.usdToEgp;
  const fxRate = prices?.fxRates?.[currency];
  if (fxRate) return amount * fxRate;
  return amount;
}

// Converts each cash account's balance to EGP. Shared by the Overview Cash
// card total and the Target Allocation rebalancing calculation, both of
// which need one combined EGP figure across accounts that don't all share
// a currency.
export function computeCashTotalEGP(accounts: CashAccount[], prices: Pick<MarketPrices, 'usdToEgp' | 'fxRates'> | null | undefined): number {
  return accounts.reduce((sum, a) => sum + convertToEgp(Number(a.balance) || 0, a.currency, prices), 0);
}

// Sums every uncollected 'pending' income entry (money owed to the user
// that isn't in any account yet — see IncomeKind), converted to EGP. This
// is what makes a pending receivable count toward net worth immediately,
// instead of only once it's actually deposited.
export function computePendingIncomeEGP(incomes: RecurringIncome[], prices: Pick<MarketPrices, 'usdToEgp' | 'fxRates'> | null | undefined): number {
  return incomes.reduce((sum, inc) => {
    if (inc.kind !== 'pending' || inc.collected) return sum;
    return sum + convertToEgp(Number(inc.amount) || 0, inc.currency, prices);
  }, 0);
}
