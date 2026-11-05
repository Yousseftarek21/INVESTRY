import { useCallback } from 'react';
import { useLoans } from '@/context/LoansContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useT } from '@/hooks/useTranslation';
import { monthOf } from '@/utils/rentalMath';
import { useCashMove } from '@/hooks/useCashMove';
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
  const { updateLoan } = useLoans();
  const { logActivity } = useActivityLog();

  // Amounts are in the loan's currency; negative takes money out of the account.
  const moveCash = useCashMove();

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
