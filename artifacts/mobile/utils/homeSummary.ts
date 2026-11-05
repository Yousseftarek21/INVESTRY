import type { Holding, Loan, RecurringIncome } from '@/types';
import { loanStatus } from '@/utils/loanMath';
import { dayNum, monthOf, monthsBetween, upcomingEvents, type NextEvent, type UnitData } from '@/utils/rentalMath';

/**
 * What's still owed on properties bought in installments, in EGP.
 *
 * The form stores one remaining balance that nobody updates as months are
 * paid, so on its own it overstates the debt more each month. When the
 * monthly amount and end date are known, the months left until the end date
 * give a fresher estimate; the stored balance still caps it.
 */
export function estimateInstallmentDebtEGP(holdings: Holding[], today: string): number {
  let total = 0;
  for (const h of holdings) {
    if (h.type !== 'real_estate' || !h.hasInstallmentPlan) continue;
    const stored = typeof h.remainingBalance === 'number' && Number.isFinite(h.remainingBalance) && h.remainingBalance > 0
      ? h.remainingBalance : 0;
    const monthly = typeof h.monthlyInstallment === 'number' && Number.isFinite(h.monthlyInstallment) && h.monthlyInstallment > 0
      ? h.monthlyInstallment : 0;
    const end = typeof h.installmentEndDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(h.installmentEndDate)
      ? h.installmentEndDate.slice(0, 10) : '';
    let owed = stored;
    if (monthly > 0 && end) {
      // Payments left, counting this month's if its due date (taken as the
      // end date's day) hasn't passed yet.
      let months = monthsBetween(monthOf(today), monthOf(end));
      if (end.slice(8, 10) >= today.slice(8, 10)) months += 1;
      const estimate = monthly * Math.max(0, months);
      owed = stored > 0 ? Math.min(stored, estimate) : estimate;
    }
    total += owed;
  }
  return total;
}

export type ComingUpItem =
  | { kind: 'rental'; date: string; unitId: string; unitName: string; event: NextEvent }
  | { kind: 'maturity'; date: string; holdingId: string; label: string; principal: number }
  | { kind: 'pending_income'; date: string; incomeId: string; name: string; amount: number; currency: string }
  | { kind: 'loan'; date: string; loanId: string; name: string; amount?: number; currency: string; overdue: boolean };

/**
 * The next few dated things across the app, soonest first: rental check-ins,
 * rent due and contract ends, certificates maturing, and expected payments.
 */
export function comingUp(
  rentalUnits: UnitData[],
  holdings: Holding[],
  incomes: RecurringIncome[],
  today: string,
  horizonDays = 14,
  limit = 3,
  loans: Loan[] = [],
): ComingUpItem[] {
  const todayN = dayNum(today);
  const within = (iso: string, days = horizonDays) => {
    const n = dayNum(iso);
    return Number.isFinite(n) && n >= todayN && n <= todayN + days;
  };
  const items: ComingUpItem[] = [];

  for (const d of rentalUnits) {
    for (const event of upcomingEvents(d, today, horizonDays)) {
      items.push({ kind: 'rental', date: event.date, unitId: d.unit.id, unitName: d.unit.name, event });
    }
  }
  for (const h of holdings) {
    if (h.type === 'fixed_income' && h.maturityDate && within(h.maturityDate.slice(0, 10), 30)) {
      items.push({ kind: 'maturity', date: h.maturityDate.slice(0, 10), holdingId: h.id, label: h.label, principal: h.principal });
    }
  }
  for (const inc of incomes) {
    if (inc.kind === 'pending' && !inc.collected && inc.expectedDate && within(inc.expectedDate.slice(0, 10))) {
      items.push({
        kind: 'pending_income', date: inc.expectedDate.slice(0, 10), incomeId: inc.id,
        name: inc.name, amount: Number(inc.amount) || 0, currency: inc.currency,
      });
    }
  }
  for (const l of loans) {
    const { status, nextDue } = loanStatus(l, today);
    if (!nextDue) continue;
    // Overdue payments show first, dated today, so they can't be missed.
    if (status === 'overdue') {
      items.push({ kind: 'loan', date: today, loanId: l.id, name: l.name, amount: l.monthlyPayment, currency: l.currency, overdue: true });
    } else if (within(nextDue)) {
      items.push({ kind: 'loan', date: nextDue, loanId: l.id, name: l.name, amount: l.monthlyPayment, currency: l.currency, overdue: false });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}
