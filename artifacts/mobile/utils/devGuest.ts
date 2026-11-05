import type { CashAccount, Holding, Loan, RecurringIncome, RentalBooking, RentalExpense, RentalLease, RentalUnit } from '@/types';
import type { SoldHolding } from '@/hooks/useSoldHoldings';

/**
 * Simulator guest mode: opens the app without signing in, with Pro unlocked
 * and optional demo data, so screens can be tested on a dev build.
 *
 * Needs BOTH a development bundle (__DEV__) AND EXPO_PUBLIC_DEV_GUEST set when
 * the dev server starts (see the "investry-sim" entry in .claude/launch.json).
 * `eas update` and store builds are production bundles where __DEV__ is false
 * and the variable is unset, so none of this can reach users.
 *
 * EXPO_PUBLIC_DEV_GUEST: full | invest | rentals | empty
 */
type Scenario = 'full' | 'invest' | 'rentals' | 'empty';

const raw = process.env.EXPO_PUBLIC_DEV_GUEST;
const scenario: Scenario | null = __DEV__ && (raw === 'full' || raw === 'invest' || raw === 'rentals' || raw === 'empty')
  ? raw
  : null;

export const DEV_GUEST = scenario !== null;

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

export function devGuestHoldings(): Holding[] {
  if (scenario !== 'full' && scenario !== 'invest') return [];
  const base: Holding[] = [
    { id: 'dev-gold', type: 'gold', karat: '21k', form: 'physical', grams: 100, purchasePricePerGram: 4000, purchaseDate: '2025-01-01', notes: '' },
    { id: 'dev-comi', type: 'stock', symbol: 'COMI', companyName: 'Commercial International Bank', shares: 200, purchasePricePerShare: 80, purchaseDate: '2025-01-01', notes: '' },
  ] as Holding[];
  if (scenario === 'invest') return base;
  return [
    ...base,
    {
      id: 'dev-flat', type: 'real_estate', propertyName: 'New Cairo flat', propertyType: 'apartment',
      governorate: 'Cairo', city: 'New Cairo', district: '5th Settlement', area: 150,
      currentMarketPricePerM2: 33000, currentValue: 4_950_000, purchasePrice: 3_500_000, purchaseDate: '2024-01-01',
      hasInstallmentPlan: true, remainingBalance: 2_000_000, monthlyInstallment: 25_000, installmentEndDate: day(365 * 3), notes: '',
    },
    {
      id: 'dev-cert', type: 'fixed_income', subtype: 'saving_cert', label: 'NBE 3-year certificate', institution: 'NBE',
      principal: 100_000, annualRate: 27, purchaseDate: '2023-11-20', maturityDate: day(12), paymentFrequency: 'monthly', notes: '',
    },
  ] as Holding[];
}

export function devGuestCash(): CashAccount[] {
  return scenario === 'full'
    ? [{ id: 'dev-cib', type: 'bank', accountName: 'CIB', balance: 150_000, currency: 'EGP' } as CashAccount]
    : [];
}

export function devGuestIncomes(): RecurringIncome[] {
  return scenario === 'full'
    ? [{
        id: 'dev-pending', name: 'Ahmed (loan back)', amount: 20_000, currency: 'EGP', kind: 'pending',
        startDate: day(-5), active: true, lastProcessedMonth: null, createdAt: day(-5), expectedDate: day(3),
      }]
    : [];
}

export function devGuestRentals(): { units: RentalUnit[]; bookings: RentalBooking[]; leases: RentalLease[]; expenses: RentalExpense[] } {
  if (scenario !== 'full' && scenario !== 'rentals') return { units: [], bookings: [], leases: [], expenses: [] };
  return {
    units: [{ id: 'dev-unit', name: 'Sahel chalet', mode: 'short_stay', currency: 'EGP', createdAt: '2026-01-01' }],
    bookings: [
      { id: 'dev-b1', unitId: 'dev-unit', guestName: 'Mona', checkIn: day(1), checkOut: day(4), platform: 'airbnb', totalAmount: 9000, platformFee: 900, currency: 'EGP', status: 'confirmed', received: false, createdAt: day(-10) },
      { id: 'dev-b2', unitId: 'dev-unit', guestName: 'Karim', checkIn: day(-6), checkOut: day(-2), platform: 'direct', totalAmount: 12000, currency: 'EGP', status: 'confirmed', received: true, createdAt: day(-20) },
    ],
    leases: [],
    expenses: [{ id: 'dev-e1', unitId: 'dev-unit', date: day(-3), amount: 1500, category: 'cleaning', currency: 'EGP', createdAt: day(-3) }],
  };
}

export function devGuestLoans(): Loan[] {
  if (scenario !== 'full') return [];
  const ym = day(0).slice(0, 7);
  return [{
    id: 'dev-car-loan', kind: 'car', name: 'CIB car loan', currency: 'EGP',
    startBalance: 320_000, originalAmount: 450_000, monthlyPayment: 12_500, dueDay: Number(day(4).slice(8, 10)) > 28 ? 28 : Number(day(4).slice(8, 10)),
    annualRate: 18, startDate: '2025-06-01', endDate: '2028-06-01',
    payments: [{ id: 'dev-p1', date: day(-30), amount: 12_500, month: day(-30).slice(0, 7) }].filter(p => p.month !== ym),
    createdAt: '2025-06-01',
  }];
}

/** Two past sales, so Sold investments isn't empty in the demo. */
export function devGuestSold(): SoldHolding[] {
  if (scenario !== 'full' && scenario !== 'invest') return [];
  return [
    { id: 'dev-sold-1', originalHoldingId: 'dev-old-swdy', type: 'stock', label: 'SWDY', quantity: 300, purchaseDate: '2025-03-10', amountInvested: 21_000, saleProceeds: 27_600, saleDate: day(-20), realizedGainLoss: 6_600, notes: null },
    { id: 'dev-sold-3', originalHoldingId: 'dev-old-swdy', type: 'stock', label: 'SWDY', quantity: 200, purchaseDate: '2025-03-10', amountInvested: 14_000, saleProceeds: 16_900, saleDate: day(-120), realizedGainLoss: 2_900, notes: 'Took some profit before results' },
    { id: 'dev-sold-2', originalHoldingId: 'dev-old-gold', type: 'gold', label: '24K Gold', quantity: 20, purchaseDate: '2025-08-01', amountInvested: 96_000, saleProceeds: 91_400, saleDate: day(-75), realizedGainLoss: -4_600, notes: null },
  ];
}
