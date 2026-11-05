import { Feather } from '@expo/vector-icons';
import type { useT } from '@/hooks/useTranslation';
import type { LoanKind } from '@/types';

type T = ReturnType<typeof useT>;

export const LOAN_KINDS: LoanKind[] = ['personal', 'car', 'mortgage', 'credit_card', 'family', 'installment', 'other'];

export const LOAN_ICONS: Record<LoanKind, keyof typeof Feather.glyphMap> = {
  personal: 'user',
  car: 'truck',
  mortgage: 'home',
  credit_card: 'credit-card',
  family: 'users',
  installment: 'calendar',
  other: 'file-text',
};

export function loanKindLabel(k: LoanKind, t: T): string {
  switch (k) {
    case 'personal': return t.loanKindPersonal;
    case 'car': return t.loanKindCar;
    case 'mortgage': return t.loanKindMortgage;
    case 'credit_card': return t.loanKindCreditCard;
    case 'family': return t.loanKindFamily;
    case 'installment': return t.loanKindInstallment;
    default: return t.loanKindOther;
  }
}
