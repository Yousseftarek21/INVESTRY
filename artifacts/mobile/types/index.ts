export type GoldKarat = '24k' | '22k' | '21k' | '18k';
export type MetalForm = 'physical' | 'digital';
export type PropertyType =
  | 'apartment' | 'villa' | 'duplex' | 'penthouse' | 'townhouse' | 'chalet'
  | 'land' | 'office' | 'retail_shop' | 'commercial' | 'medical_clinic' | 'warehouse';
export type ValuationSource = 'manual' | 'developer' | 'broker';
export type PropertyStatus = 'owner_occupied' | 'rented' | 'vacant' | 'under_construction';
export type PersonalAssetCategory =
  | 'watches' | 'jewelry' | 'artwork' | 'collectibles'
  | 'luxury' | 'electronics' | 'furniture' | 'instruments' | 'other';
export type PersonalAssetCurrency = 'EGP' | 'USD';

// createdAt/updatedAt (ISO strings, set by the server — see
// GET /api/holdings) tell "touched today" from "untouched." The Home tab
// and Analytics tab's Today's Change no longer read these at all — that
// display is personal and non-competitive, so it always uses live market
// prices regardless of when a holding was last saved. `updatedAt` (bumped
// only on a real quantity change, never a no-op save — see
// HoldingsContext.tsx/routes/holdings.ts) is still read by the competitive
// Performance Leaderboard's own anti-gaming gate
// (computeTodayEligiblePerformance, api-server), which is why it's still
// stamped and still gated on quantity specifically. Optional because older
// cached/local data may not have them yet.
//
// priceAtCreationEgp/priceAtLastEditEgp (EGP per gram/share, gold/silver/
// stock only) are stamped server-side the instant a lot is created/edited —
// never client-supplied, see POST/PUT /holdings in the API. These are
// leaderboard-period baselines only now — the unfakeable reference price
// computeTodayEligiblePerformance/computePeriodPerformance measure a lot's
// movement from, for a period that started today. No longer used for the
// personal Today's Change display.
export interface GoldHolding {
  id: string;
  type: 'gold';
  karat: GoldKarat;
  form: MetalForm;
  grams: number;
  purchasePricePerGram: number;
  purchaseDate: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  priceAtCreationEgp?: number;
  priceAtLastEditEgp?: number;
}

export interface SilverHolding {
  id: string;
  type: 'silver';
  form: MetalForm;
  grams: number;
  purchasePricePerGram: number;
  purchaseDate: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  priceAtCreationEgp?: number;
  priceAtLastEditEgp?: number;
}

export interface StockHolding {
  id: string;
  type: 'stock';
  symbol: string;
  companyName: string;
  shares: number;
  purchasePricePerShare: number;
  purchaseDate: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  priceAtCreationEgp?: number;
  priceAtLastEditEgp?: number;
}

export interface RealEstateHolding {
  id: string;
  type: 'real_estate';
  propertyName: string;
  propertyType: PropertyType;

  // Location
  governorate: string;
  city: string;
  district: string;

  area: number;

  // Valuation — currentValue is derived (area × currentMarketPricePerM2).
  // reAreaId links to RE_PRICES for live price updates via OTA; takes priority.
  reAreaId?: string;
  // Links to RE_COMPOUNDS (lib/shared-data) when the user picked a specific
  // development from the curated compound list instead of just an area —
  // purely a reference for display; currentMarketPricePerM2 is what actually
  // drives valuation, captured from live compound data at add/edit time.
  reCompoundId?: string;
  currentMarketPricePerM2?: number;
  currentValue?: number;
  lastValuationDate?: string;
  valuationSource?: ValuationSource;

  // Purchase info
  purchasePrice: number;
  purchaseDate: string;
  developer?: string;
  compoundName?: string;
  unitNumber?: string;

  // Installment plan (optional)
  hasInstallmentPlan?: boolean;
  downPayment?: number;
  remainingBalance?: number;
  monthlyInstallment?: number;
  installmentEndDate?: string;

  // Rental info (optional)
  monthlyRent?: number;
  propertyStatus?: PropertyStatus;

  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonalAssetHolding {
  id: string;
  type: 'personal_asset';
  name: string;
  category: PersonalAssetCategory;
  icon: string;
  purchasePrice: number;
  currentValue: number;
  currency: PersonalAssetCurrency;
  purchaseDate: string;
  notes?: string;
  photos?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type FixedIncomeSubtype = 'tbill' | 'saving_cert' | 'deposit' | 'sukuk';
export type PaymentFrequency = 'monthly' | 'quarterly' | 'at_maturity';

// A loan taken out against a certificate, using it as collateral —
// informational only, deliberately: does NOT feed into this holding's own
// accrued value (fixedIncomeAccruedValue keeps computing purely off
// principal/annualRate/time, unchanged) and is NOT subtracted from net
// worth anywhere. Same restraint RealEstateHolding's own installment-plan
// fields already use (hasInstallmentPlan/remainingBalance/monthlyInstallment
// below) — this app has no liabilities concept anywhere yet, and folding
// one in properly means touching net-worth math in at least two
// independently-maintained places (app/(tabs)/index.tsx and the AI
// assistant's own calc in api-server/src/routes/chat.ts); that's real,
// separate scope, not attempted here. Unlike the real estate fields (purely
// descriptive, no history), this keeps a payments[] log — each month's
// installment is genuinely split-funded from two different sources (the
// certificate's own interest payout, and a separate cash account), which
// there's no automated way to reconcile correctly yet (nothing in this app
// tracks a certificate's interest payouts as real transactions), so
// payments are confirmed manually rather than auto-processed the way
// RecurringIncome's monthly credits are.
export interface LinkedLoan {
  outstandingBalance: number;
  monthlyInstallment: number;
  /** Which cash account covers the part of the installment not paid by
      the certificate's own interest. */
  fundingCashAccountId?: string;
  startDate: string;
  notes?: string;
  payments: { month: string; amount: number; confirmedAt: string }[];
}

export interface FixedIncomeHolding {
  id: string;
  type: 'fixed_income';
  subtype: FixedIncomeSubtype;
  label: string;
  institution: string;
  principal: number;
  annualRate: number;
  purchaseDate: string;
  maturityDate: string;
  paymentFrequency: PaymentFrequency;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  /** A loan taken against this certificate, if any — see LinkedLoan. */
  linkedLoan?: LinkedLoan;
}

export type Holding = GoldHolding | SilverHolding | StockHolding | RealEstateHolding | PersonalAssetHolding | FixedIncomeHolding;

export type CashAccountType = 'bank' | 'cash_home' | 'foreign_currency';

export interface CashAccount {
  id: string;
  type: CashAccountType;
  accountName: string;
  balance: number;
  currency: string;
  dateAdded?: string;
  notes?: string;
  /** ISO timestamp of the last manual balance edit — not touched by
   * recurring-income auto-credits, only by the user changing the number
   * themselves. Drives the "Updated X days ago" hint on the account card. */
  lastBalanceUpdateAt?: string;
}

export interface IncomeTransaction {
  month: string;       // "2026-07"
  amount: number;
  creditedAt: string;  // ISO timestamp
}

// A manually logged cash distribution received on a stock holding — dividends,
// not the recurring/salary-style income above. holdingId links it to a stock
// holding when the user picked one from their portfolio; symbol/companyName
// are captured alongside it (not just looked up via holdingId) so the record
// still reads correctly after that holding is later sold and removed.
export interface Dividend {
  id: string;
  holdingId?: string;
  symbol: string;
  companyName?: string;
  amount: number;
  currency: string;
  date: string;        // "2026-07-15"
  note?: string;
  /** Cash account the amount was added to, if the user chose to (one-time bump, not tracked ongoing). */
  cashAccountId?: string;
  createdAt: string;
}

// 'recurring' (default, and the only kind that existed before this field was
// added — missing `kind` on an old stored record means 'recurring') is a
// fixed monthly auto-deposit into a cash account, unchanged from before.
// 'pending' is a one-off amount someone owes the user (e.g. an unpaid
// freelance invoice) that isn't in any account yet: no cashAccountId/
// creditDay required up front, it's excluded from the auto-credit
// processor entirely, and it counts toward net worth directly (as its own
// line, not folded into cash) until markIncomeCollected deposits it into a
// chosen account and flips `collected`.
export type IncomeKind = 'recurring' | 'pending';

export interface RecurringIncome {
  id: string;
  name: string;
  amount: number;
  currency: string;
  kind?: IncomeKind;
  cashAccountId?: string;
  /** Required for 'recurring', unused for 'pending'. */
  creditDay?: number;
  startDate: string;
  endDate?: string;
  active: boolean;
  lastProcessedMonth: string | null;
  createdAt: string;
  transactions?: IncomeTransaction[];
  /** 'pending' entries only — informational, no cron/processor depends on it. */
  expectedDate?: string;
  /** 'pending' entries only — true once markIncomeCollected has deposited it. */
  collected?: boolean;
  /** 'pending' entries only — server-managed, set by pendingIncomeReminderCron
      once its one-time "did this arrive?" push has been sent for this entry,
      so it never sends twice. Not read or written by the client. */
  reminderSentAt?: string;
}

export interface MarketPrices {
  goldUsd: number;
  silverUsd: number;
  usdToEgp: number;
  usdToEgpChangePercent?: number;
  goldChange: number;
  goldChangePercent: number;
  /** Gold's real EGP-denominated change (USD move compounded with today's FX
   * move) — use this, not goldChangePercent (raw USD), for any calculation
   * against an EGP-valued holding. */
  goldChangePercentEgp?: number;
  silverChange: number;
  silverChangePercent: number;
  /** Silver's equivalent of goldChangePercentEgp. */
  silverChangePercentEgp?: number;
  lastUpdated: Date;
  egxPrices?: Record<string, number>;
  fxRates?: Record<string, number>;
  /** Set whenever the *Change fields above are placeholders rather than a
   * real measurement of today's move.
   *
   * Spot values (goldUsd, usdToEgp, fxRates) stay meaningful indefinitely —
   * the last real price is still the best price we know. Every *Change field
   * above does not: those measure the move since today's open, so a cached
   * copy describes some earlier moment and is simply wrong later.
   *
   * Three paths produce zeroed deltas and all of them set this:
   *   - prices rehydrated from the on-disk launch cache
   *   - the direct TradingView fallback, which has no historical FX rate to
   *     put a change on an EGP basis and so deliberately reports none
   *   - a server response that omits the fields entirely
   *
   * Without the flag a plain 0 reads as "flat today" and renders a confident
   * green +0.00%. This lets the UI say "not known yet" instead. */
  changesUnknown?: boolean;
}
