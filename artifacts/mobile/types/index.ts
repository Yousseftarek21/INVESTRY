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

  // Valuation — currentValue is derived (area × currentMarketPricePerM2) but
  // stored so downstream consumers can keep reading it directly.
  currentMarketPricePerM2: number;
  currentValue: number;
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
}

export interface MarketPrices {
  goldUsd: number;
  silverUsd: number;
  usdToEgp: number;
  goldChange: number;
  goldChangePercent: number;
  silverChange: number;
  silverChangePercent: number;
  lastUpdated: Date;
  egxPrices?: Record<string, number>;
  fxRates?: Record<string, number>;
}

export interface EGXStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}
