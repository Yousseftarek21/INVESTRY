export type GoldKarat = '24k' | '22k' | '21k' | '18k';
export type MetalForm = 'physical' | 'digital';
export type PropertyType = 'apartment' | 'villa' | 'land' | 'commercial';
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
  propertyType: PropertyType;
  location: string;
  purchasePrice: number;
  currentValue: number;
  purchaseDate: string;
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

export type Holding = GoldHolding | SilverHolding | StockHolding | RealEstateHolding | PersonalAssetHolding;

export type CashAccountType = 'bank' | 'cash_home' | 'foreign_currency';

export interface CashAccount {
  id: string;
  type: CashAccountType;
  accountName: string;
  balance: number;
  currency: string;
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
}

export interface EGXStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}
