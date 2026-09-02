import type { CashAccount, Holding, MarketPrices, RecurringIncome } from '@/types';

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

// Sums outstanding loan balances across every fixed_income holding's
// linkedLoan (see types/index.ts) — the fix for a real double-counting bug:
// a certificate keeps showing its own full value, and money borrowed
// against it (spent on other holdings) was never netted back out anywhere,
// so a 100k certificate + a 90k loan spent on gold read as 190k instead of
// the real ~100k net position. No currency conversion, unlike the two
// functions above — LinkedLoan has no `currency` field, and every existing
// loan UI (HoldingCard.tsx's loan row) already treats outstandingBalance as
// plain EGP; don't "fix" this into calling convertToEgp.
export function computeTotalLoanBalanceEGP(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => {
    if (h.type !== 'fixed_income' || !h.linkedLoan) return sum;
    return sum + (Number(h.linkedLoan.outstandingBalance) || 0);
  }, 0);
}
