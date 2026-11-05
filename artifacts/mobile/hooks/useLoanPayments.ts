import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLoans } from '@/context/LoansContext';
import { useCash } from '@/context/CashContext';
import { useMarketPrices } from '@/hooks/usePrices';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useCashBalanceUpdates } from '@/hooks/useCashBalanceUpdates';
import { applyOptimisticTodayChange } from '@/hooks/useCashAccountsTodayChanges';
import { useT } from '@/hooks/useTranslation';
import { convert, monthOf } from '@/utils/rentalMath';
import { isLoanPaidOff } from '@/utils/loanMath';
import { loanPaymentText } from '@/utils/activityText';
import { generateId } from '@/components/rental/RentalUI';
import type { Loan, LoanPayment } from '@/types';

/**
 * Recording and deleting loan payments, shared by the loan screen and the
 * "Paid" button in Home's Coming up. A payment taken from a cash account
 * moves that account's balance and is logged like any other balance change,
 * so the Cash card's "Today" figure and the account history explain it.
 */
export function useLoanPayments() {
  const t = useT();
  const queryClient = useQueryClient();
  const { updateLoan } = useLoans();
  const { cashAccounts, updateCashAccount } = useCash();
  const { data: prices } = useMarketPrices();
  const { logUpdate } = useCashBalanceUpdates(null);
  const { logActivity } = useActivityLog();

  // amount is in the loan's currency; negative takes money out of the account.
  const moveCash = useCallback((accountId: string | undefined, amount: number, loanCurrency: string) => {
    if (!accountId) return;
    const account = cashAccounts.find(a => a.id === accountId);
    if (!account) return;
    const delta = Math.round(convert(amount, loanCurrency, account.currency || 'EGP', prices) * 100) / 100;
    if (delta === 0) return;
    const resulting = Math.round(((Number(account.balance) || 0) + delta) * 100) / 100;
    updateCashAccount({ ...account, balance: resulting }).catch(() => null);
    applyOptimisticTodayChange(queryClient, account.id, delta);
    void logUpdate(account.id, delta, resulting);
  }, [cashAccounts, updateCashAccount, prices, queryClient, logUpdate]);

  const recordPayment = useCallback(async (loan: Loan, input: { amount: number; date: string; cashAccountId?: string }) => {
    const payment: LoanPayment = {
      id: generateId(),
      date: input.date,
      amount: input.amount,
      // Monthly loans: the payment counts for the month it was made in.
      month: loan.monthlyPayment ? monthOf(input.date) : undefined,
      cashAccountId: input.cashAccountId || undefined,
    };
    const next: Loan = { ...loan, payments: [...loan.payments, payment], updatedAt: new Date().toISOString() };
    await updateLoan(next);
    moveCash(payment.cashAccountId, -input.amount, loan.currency);
    if (!isLoanPaidOff(loan) && isLoanPaidOff(next)) {
      void logActivity('loan_paid_off', t.actLoanPaidOffTitle(loan.name), t.actLoanPaidOffBody, loan.id);
    } else {
      const text = loanPaymentText(next, input.amount, t);
      void logActivity('loan_payment', text.title, text.body, loan.id);
    }
  }, [updateLoan, moveCash, logActivity, t]);

  const deletePayment = useCallback(async (loan: Loan, p: LoanPayment) => {
    await updateLoan({ ...loan, payments: loan.payments.filter(x => x.id !== p.id), updatedAt: new Date().toISOString() });
    moveCash(p.cashAccountId, p.amount, loan.currency);
  }, [updateLoan, moveCash]);

  return { recordPayment, deletePayment };
}
