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

export interface GoldHolding {
  id: string;
  type: 'gold';
  karat: GoldKarat;
  form: MetalForm;
  grams: number;
  purchasePricePerGram: number;
  purchaseDate: string;
  notes?: string;
}

export interface SilverHolding {
  id: string;
  type: 'silver';
  form: MetalForm;
  grams: number;
  purchasePricePerGram: number;
  purchaseDate: string;
  notes?: string;
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
}

export type FixedIncomeSubtype = 'tbill' | 'saving_cert' | 'deposit' | 'sukuk';
export type PaymentFrequency = 'monthly' | 'quarterly' | 'at_maturity';

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

export interface RecurringIncome {
  id: string;
  name: string;
  amount: number;
  currency: string;
  cashAccountId: string;
  creditDay: number;
  startDate: string;
  endDate?: string;
  active: boolean;
  lastProcessedMonth: string | null;
  createdAt: string;
  transactions?: IncomeTransaction[];
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

export interface EGXStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}
