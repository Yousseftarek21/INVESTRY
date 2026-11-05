import type { useT } from '@/hooks/useTranslation';
import type { Holding, Loan } from '@/types';
import { loanPaidShare, loanRemaining } from '@/utils/loanMath';

type T = ReturnType<typeof useT>;

// Push + Notification History copy for the user's own actions (useActivityLog).
// Title names the thing; body says what changed and what it's worth now.

const num = (n: number, digits = 0) => n.toLocaleString('en-EG', { maximumFractionDigits: digits });

export function holdingName(h: Holding, t: T): string {
  switch (h.type) {
    case 'gold': return t.actGoldName(h.karat.toUpperCase());
    case 'silver': return t.silver;
    case 'stock': return h.symbol;
    case 'real_estate': return h.propertyName;
    case 'personal_asset': return h.name;
    case 'fixed_income': return h.label || h.institution;
    default: return t.investmentsLabel;
  }
}

/** "10 g at 4,120 EGP/g · 41,200 EGP", "100 shares at 128.5 · 12,850 EGP", "Bought for 3.5M EGP". */
export function holdingAddedBody(h: Holding, t: T, costEgp: number): string {
  switch (h.type) {
    case 'gold':
    case 'silver':
      return t.actGramsAt(num(h.grams, 3), num(h.purchasePricePerGram, 2), num(costEgp));
    case 'stock':
      return t.actSharesAt(num(h.shares, 4), num(h.purchasePricePerShare, 2), num(costEgp));
    case 'real_estate':
      return t.actBoughtFor(num(h.purchasePrice), 'EGP');
    case 'personal_asset':
      return t.actBoughtFor(num(h.purchasePrice), h.currency);
    case 'fixed_income':
      return t.actInvested(num(h.principal));
    default:
      return `${num(costEgp)} EGP`;
  }
}

/** "100 shares for 14,000 EGP · profit +1,150 EGP (+8.9%)". qty = amount sold for a partial sale. */
export function holdingSoldBody(h: Holding, t: T, qty: number | undefined, proceeds: number, costBasis: number): string {
  const what = h.type === 'gold' || h.type === 'silver' ? t.actGrams(num(qty ?? h.grams, 3))
    : h.type === 'stock' ? t.actShares(num(qty ?? h.shares, 4))
    : '';
  const gain = proceeds - costBasis;
  const pct = costBasis > 0 ? num(Math.abs(gain / costBasis) * 100, 1) : null;
  const pl = gain >= 0
    ? t.actProfit(num(gain), pct ?? '0')
    : t.actLoss(num(Math.abs(gain)), pct ?? '0');
  return `${t.actSoldFor(what, num(proceeds))} · ${pl}`;
}

/** Title + body for a new loan: "CIB car loan added" · "307,500 EGP left · 12,500 EGP a month, due on day 9". */
export function loanAddedText(l: Loan, t: T): { title: string; body: string } {
  const parts = [t.actLoanAddedBody(num(loanRemaining(l)), l.currency)];
  if (l.monthlyPayment) {
    parts.push(t.actLoanMonthly(num(l.monthlyPayment), l.currency) + (l.dueDay ? t.actLoanDueDay(l.dueDay) : ''));
  }
  return { title: t.actAdded(l.name), body: parts.join(' · ') };
}

/** After a payment: "12,500 EGP paid · 295,000 left (34% paid)". `l` already includes the payment. */
export function loanPaymentText(l: Loan, amount: number, t: T): { title: string; body: string } {
  return {
    title: t.actLoanPaymentTitle(l.name),
    body: t.actLoanPaymentBody(num(amount), num(loanRemaining(l)), l.currency, Math.round(loanPaidShare(l) * 100)),
  };
}

export const fmtActivityNum = num;
