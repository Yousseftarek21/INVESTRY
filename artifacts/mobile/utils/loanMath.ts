import type { Loan, MarketPrices } from '@/types';
import { convert, dayNum, monthOf } from '@/utils/rentalMath';

/** What's still owed: the starting balance minus every payment recorded. */
export function loanRemaining(l: Loan): number {
  const paid = l.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return Math.max(0, (Number(l.startBalance) || 0) - paid);
}

/** Share of the original amount already repaid, 0-1. */
export function loanPaidShare(l: Loan): number {
  const total = l.originalAmount && l.originalAmount > 0 ? l.originalAmount : l.startBalance;
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, 1 - loanRemaining(l) / total));
}

export const isLoanPaidOff = (l: Loan) => loanRemaining(l) <= 0.5;

/** Due date (YYYY-MM-DD) for a month, or null when the loan has no due day. */
export function loanDueDate(l: Loan, ym: string): string | null {
  if (!l.dueDay) return null;
  return `${ym}-${String(Math.min(Math.max(l.dueDay, 1), 28)).padStart(2, '0')}`;
}

export const isMonthPaid = (l: Loan, ym: string) => l.payments.some(p => p.month === ym);

export type LoanStatus = 'paid_off' | 'overdue' | 'due_soon' | 'paid_this_month' | 'ok';

/**
 * Where a monthly loan stands today: overdue once this month's due date has
 * passed unpaid, due soon within 5 days.
 */
export function loanStatus(l: Loan, today: string): { status: LoanStatus; nextDue: string | null } {
  if (isLoanPaidOff(l)) return { status: 'paid_off', nextDue: null };
  const ym = monthOf(today);
  const due = loanDueDate(l, ym);
  if (!due) return { status: 'ok', nextDue: null };
  const started = l.startDate <= due;
  const ended = l.endDate ? l.endDate < due : false;
  if (started && !ended && !isMonthPaid(l, ym)) {
    if (due < today) return { status: 'overdue', nextDue: due };
    return { status: dayNum(due) - dayNum(today) <= 5 ? 'due_soon' : 'ok', nextDue: due };
  }
  // This month done (or not due yet in its term) — next month's date.
  const [y, m] = ym.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const nextDue = loanDueDate(l, next);
  if (l.endDate && nextDue && l.endDate < nextDue) return { status: isMonthPaid(l, ym) ? 'paid_this_month' : 'ok', nextDue: null };
  return { status: isMonthPaid(l, ym) ? 'paid_this_month' : 'ok', nextDue };
}

/** Months of payments left at the current monthly amount. */
export function loanMonthsLeft(l: Loan): number | null {
  if (!l.monthlyPayment || !(l.monthlyPayment > 0)) return null;
  return Math.ceil(loanRemaining(l) / l.monthlyPayment);
}

/** Total still owed across all loans, in EGP. */
export function totalLoansEGP(loans: Loan[], prices: MarketPrices | undefined): number {
  return loans.reduce((s, l) => s + convert(loanRemaining(l), l.currency, 'EGP', prices), 0);
}

/** Total of monthly payments across unpaid loans, in EGP. */
export function monthlyLoanPaymentsEGP(loans: Loan[], prices: MarketPrices | undefined): number {
  return loans
    .filter(l => !isLoanPaidOff(l) && l.monthlyPayment)
    .reduce((s, l) => s + convert(l.monthlyPayment!, l.currency, 'EGP', prices), 0);
}
