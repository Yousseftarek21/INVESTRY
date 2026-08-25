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
// GET /api/holdings) tell "touched today" from "untouched": the Home tab's
// Today's Change badge (touchedToday in index.tsx/analytics.tsx) excludes a
// holding's contribution when it was added or edited today, so bumping a
// quantity right as the market moves can't inflate the badge. Optional
// because older cached/local data may not have them yet.
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
