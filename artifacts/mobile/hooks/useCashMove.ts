import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCash } from '@/context/CashContext';
import { useMarketPrices } from '@/hooks/usePrices';
import { useCashBalanceUpdates } from '@/hooks/useCashBalanceUpdates';
import { applyOptimisticTodayChange } from '@/hooks/useCashAccountsTodayChanges';
import { convert } from '@/utils/rentalMath';

/**
 * Moves money into (positive) or out of (negative) one of the user's cash
 * accounts, converting from `currency` into the account's own, and logs it
 * like any manual balance change — so the Cash card's "Today" figure and the
 * account history explain where it came from (a sale, a loan payment).
 */
export function useCashMove() {
  const queryClient = useQueryClient();
  const { cashAccounts, updateCashAccount } = useCash();
  const { data: prices } = useMarketPrices();
  const { logUpdate } = useCashBalanceUpdates(null);

  return useCallback((accountId: string | undefined, amount: number, currency: string) => {
    if (!accountId) return;
    const account = cashAccounts.find(a => a.id === accountId);
    if (!account) return;
    const delta = Math.round(convert(amount, currency, account.currency || 'EGP', prices) * 100) / 100;
    if (delta === 0) return;
    const resulting = Math.round(((Number(account.balance) || 0) + delta) * 100) / 100;
    updateCashAccount({ ...account, balance: resulting }).catch(() => null);
    applyOptimisticTodayChange(queryClient, account.id, delta);
    void logUpdate(account.id, delta, resulting);
  }, [cashAccounts, updateCashAccount, prices, queryClient, logUpdate]);
}
