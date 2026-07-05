// Global stocks & indices — curated list of well-known international tickers
// Fetched live via Yahoo Finance (free, no API key needed)

export const GLOBAL_CATEGORIES = [
  'All',
  'Indices',
  'Technology',
  'Finance',
  'Consumer',
  'Healthcare',
  'Industrial',
] as const;

export type GlobalCategory = typeof GLOBAL_CATEGORIES[number];

export interface GlobalCompany {
  ticker: string;
  yahoo: string;
  name: string;
  category: Exclude<GlobalCategory, 'All'>;
  fallbackPrice: number;
}

export const GLOBAL_COMPANIES: GlobalCompany[] = [
  // ─── Indices (via tracking ETFs) ─────────────────────────────────────────
  { ticker: 'SPY',   yahoo: 'SPY',   name: 'S&P 500 (SPDR ETF)',       category: 'Indices',    fallbackPrice: 560.00 },
  { ticker: 'QQQ',   yahoo: 'QQQ',   name: 'NASDAQ 100 (Invesco ETF)', category: 'Indices',    fallbackPrice: 480.00 },
  { ticker: 'DIA',   yahoo: 'DIA',   name: 'Dow Jones (SPDR ETF)',     category: 'Indices',    fallbackPrice: 400.00 },

  // ─── Technology ───────────────────────────────────────────────────────────
  { ticker: 'AAPL',  yahoo: 'AAPL',  name: 'Apple Inc.',               category: 'Technology', fallbackPrice: 225.00 },
  { ticker: 'MSFT',  yahoo: 'MSFT',  name: 'Microsoft Corp.',          category: 'Technology', fallbackPrice: 420.00 },
  { ticker: 'GOOGL', yahoo: 'GOOGL', name: 'Alphabet Inc.',            category: 'Technology', fallbackPrice: 170.00 },
  { ticker: 'AMZN',  yahoo: 'AMZN',  name: 'Amazon.com Inc.',          category: 'Technology', fallbackPrice: 185.00 },
  { ticker: 'NVDA',  yahoo: 'NVDA',  name: 'NVIDIA Corp.',             category: 'Technology', fallbackPrice: 135.00 },
  { ticker: 'META',  yahoo: 'META',  name: 'Meta Platforms Inc.',      category: 'Technology', fallbackPrice: 580.00 },
  { ticker: 'TSLA',  yahoo: 'TSLA',  name: 'Tesla Inc.',               category: 'Technology', fallbackPrice: 250.00 },

  // ─── Finance ──────────────────────────────────────────────────────────────
  { ticker: 'JPM',   yahoo: 'JPM',   name: 'JPMorgan Chase & Co.',     category: 'Finance',    fallbackPrice: 220.00 },
  { ticker: 'V',     yahoo: 'V',     name: 'Visa Inc.',                category: 'Finance',    fallbackPrice: 310.00 },
  { ticker: 'MA',    yahoo: 'MA',    name: 'Mastercard Inc.',          category: 'Finance',    fallbackPrice: 500.00 },

  // ─── Consumer ─────────────────────────────────────────────────────────────
  { ticker: 'WMT',   yahoo: 'WMT',   name: 'Walmart Inc.',             category: 'Consumer',   fallbackPrice: 90.00  },
  { ticker: 'KO',    yahoo: 'KO',    name: 'Coca-Cola Co.',            category: 'Consumer',   fallbackPrice: 65.00  },
  { ticker: 'PG',    yahoo: 'PG',    name: 'Procter & Gamble Co.',     category: 'Consumer',   fallbackPrice: 165.00 },
  { ticker: 'DIS',   yahoo: 'DIS',   name: 'Walt Disney Co.',          category: 'Consumer',   fallbackPrice: 110.00 },
  { ticker: 'NKE',   yahoo: 'NKE',   name: 'Nike Inc.',                category: 'Consumer',   fallbackPrice: 75.00  },

  // ─── Healthcare ───────────────────────────────────────────────────────────
  { ticker: 'JNJ',   yahoo: 'JNJ',   name: 'Johnson & Johnson',        category: 'Healthcare', fallbackPrice: 155.00 },
  { ticker: 'PFE',   yahoo: 'PFE',   name: 'Pfizer Inc.',              category: 'Healthcare', fallbackPrice: 27.00  },

  // ─── Industrial ───────────────────────────────────────────────────────────
  { ticker: 'BA',    yahoo: 'BA',    name: 'Boeing Co.',               category: 'Industrial', fallbackPrice: 175.00 },
];

export function getCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of GLOBAL_COMPANIES) counts[c.category] = (counts[c.category] ?? 0) + 1;
  return counts;
}

export function searchGlobalCompanies(companies: GlobalCompany[], query: string): GlobalCompany[] {
  const q = query.trim().toLowerCase();
  if (!q) return companies;
  return companies.filter(c =>
    c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  );
}
