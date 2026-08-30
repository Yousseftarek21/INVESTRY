// Global stocks — real large-cap US tickers across every GICS sector,
// fetched live via TradingView's America scanner (same provider and pattern
// already trusted for EGX's 281-company list — no per-symbol credit cap, so
// this list can be broad instead of squeezed to fit a metered quota).
// The 3 major US indices (S&P 500, Dow Jones, Nasdaq) are a separate real
// index feed — see hooks/useUSIndices.ts — not ETF proxies mixed into this
// company list.

export const GLOBAL_CATEGORIES = [
  'All',
  'Technology',
  'Communication',
  'Consumer Discretionary',
  'Consumer Staples',
  'Financials',
  'Healthcare',
  'Industrials',
  'Energy',
  'Real Estate',
  'Utilities',
  'Materials',
] as const;

export type GlobalCategory = typeof GLOBAL_CATEGORIES[number];

export interface GlobalCompany {
  ticker: string;
  name: string;
  category: Exclude<GlobalCategory, 'All'>;
  fallbackPrice: number;
}

export const GLOBAL_COMPANIES: GlobalCompany[] = [
  // ─── Technology ───────────────────────────────────────────────────────────
  { ticker: 'AAPL',  name: 'Apple Inc.',                category: 'Technology', fallbackPrice: 225.00 },
  { ticker: 'MSFT',  name: 'Microsoft Corp.',           category: 'Technology', fallbackPrice: 420.00 },
  { ticker: 'NVDA',  name: 'NVIDIA Corp.',              category: 'Technology', fallbackPrice: 135.00 },
  { ticker: 'AVGO',  name: 'Broadcom Inc.',             category: 'Technology', fallbackPrice: 175.00 },
  { ticker: 'ORCL',  name: 'Oracle Corp.',               category: 'Technology', fallbackPrice: 170.00 },
  { ticker: 'CRM',   name: 'Salesforce Inc.',           category: 'Technology', fallbackPrice: 330.00 },
  { ticker: 'ADBE',  name: 'Adobe Inc.',                category: 'Technology', fallbackPrice: 520.00 },
  { ticker: 'AMD',   name: 'Advanced Micro Devices',    category: 'Technology', fallbackPrice: 150.00 },
  { ticker: 'CSCO',  name: 'Cisco Systems Inc.',        category: 'Technology', fallbackPrice: 58.00 },
  { ticker: 'ACN',   name: 'Accenture plc',             category: 'Technology', fallbackPrice: 340.00 },
  { ticker: 'INTC',  name: 'Intel Corp.',               category: 'Technology', fallbackPrice: 32.00 },
  { ticker: 'QCOM',  name: 'Qualcomm Inc.',             category: 'Technology', fallbackPrice: 175.00 },
  { ticker: 'TXN',   name: 'Texas Instruments Inc.',    category: 'Technology', fallbackPrice: 200.00 },
  { ticker: 'IBM',   name: 'IBM Corp.',                 category: 'Technology', fallbackPrice: 230.00 },
  { ticker: 'INTU',  name: 'Intuit Inc.',               category: 'Technology', fallbackPrice: 640.00 },
  { ticker: 'NOW',   name: 'ServiceNow Inc.',           category: 'Technology', fallbackPrice: 950.00 },
  { ticker: 'PYPL',  name: 'PayPal Holdings Inc.',      category: 'Technology', fallbackPrice: 80.00 },
  { ticker: 'SHOP',  name: 'Shopify Inc.',              category: 'Technology', fallbackPrice: 90.00 },

  // ─── Communication ────────────────────────────────────────────────────────
  { ticker: 'GOOGL', name: 'Alphabet Inc.',             category: 'Communication', fallbackPrice: 170.00 },
  { ticker: 'META',  name: 'Meta Platforms Inc.',       category: 'Communication', fallbackPrice: 570.00 },
  { ticker: 'NFLX',  name: 'Netflix Inc.',              category: 'Communication', fallbackPrice: 700.00 },
  { ticker: 'DIS',   name: 'Walt Disney Co.',           category: 'Communication', fallbackPrice: 105.00 },
  { ticker: 'CMCSA', name: 'Comcast Corp.',             category: 'Communication', fallbackPrice: 42.00 },
  { ticker: 'T',     name: 'AT&T Inc.',                 category: 'Communication', fallbackPrice: 20.00 },
  { ticker: 'VZ',    name: 'Verizon Communications',    category: 'Communication', fallbackPrice: 42.00 },
  { ticker: 'TMUS',  name: 'T-Mobile US Inc.',          category: 'Communication', fallbackPrice: 195.00 },

  // ─── Consumer Discretionary ───────────────────────────────────────────────
  { ticker: 'AMZN',  name: 'Amazon.com Inc.',           category: 'Consumer Discretionary', fallbackPrice: 185.00 },
  { ticker: 'TSLA',  name: 'Tesla Inc.',                category: 'Consumer Discretionary', fallbackPrice: 250.00 },
  { ticker: 'HD',    name: 'Home Depot Inc.',           category: 'Consumer Discretionary', fallbackPrice: 400.00 },
  { ticker: 'MCD',   name: "McDonald's Corp.",          category: 'Consumer Discretionary', fallbackPrice: 300.00 },
  { ticker: 'NKE',   name: 'Nike Inc.',                 category: 'Consumer Discretionary', fallbackPrice: 78.00 },
  { ticker: 'SBUX',  name: 'Starbucks Corp.',           category: 'Consumer Discretionary', fallbackPrice: 95.00 },
  { ticker: 'LOW',   name: "Lowe's Companies Inc.",     category: 'Consumer Discretionary', fallbackPrice: 260.00 },
  { ticker: 'TJX',   name: 'TJX Companies Inc.',        category: 'Consumer Discretionary', fallbackPrice: 125.00 },
  { ticker: 'BKNG',  name: 'Booking Holdings Inc.',     category: 'Consumer Discretionary', fallbackPrice: 4800.00 },
  { ticker: 'CMG',   name: 'Chipotle Mexican Grill',    category: 'Consumer Discretionary', fallbackPrice: 55.00 },
  { ticker: 'UBER',  name: 'Uber Technologies Inc.',    category: 'Consumer Discretionary', fallbackPrice: 72.00 },

  // ─── Consumer Staples ─────────────────────────────────────────────────────
  { ticker: 'PG',    name: 'Procter & Gamble Co.',      category: 'Consumer Staples', fallbackPrice: 170.00 },
  { ticker: 'KO',    name: 'Coca-Cola Co.',             category: 'Consumer Staples', fallbackPrice: 63.00 },
  { ticker: 'PEP',   name: 'PepsiCo Inc.',              category: 'Consumer Staples', fallbackPrice: 155.00 },
  { ticker: 'WMT',   name: 'Walmart Inc.',              category: 'Consumer Staples', fallbackPrice: 90.00 },
  { ticker: 'COST',  name: 'Costco Wholesale Corp.',    category: 'Consumer Staples', fallbackPrice: 900.00 },
  { ticker: 'PM',    name: 'Philip Morris International', category: 'Consumer Staples', fallbackPrice: 130.00 },
  { ticker: 'MO',    name: 'Altria Group Inc.',         category: 'Consumer Staples', fallbackPrice: 55.00 },
  { ticker: 'CL',    name: 'Colgate-Palmolive Co.',     category: 'Consumer Staples', fallbackPrice: 95.00 },
  { ticker: 'MDLZ',  name: 'Mondelez International',    category: 'Consumer Staples', fallbackPrice: 68.00 },
  { ticker: 'TGT',   name: 'Target Corp.',              category: 'Consumer Staples', fallbackPrice: 145.00 },

  // ─── Financials ───────────────────────────────────────────────────────────
  { ticker: 'JPM',   name: 'JPMorgan Chase & Co.',      category: 'Financials', fallbackPrice: 215.00 },
  { ticker: 'BAC',   name: 'Bank of America Corp.',     category: 'Financials', fallbackPrice: 42.00 },
  { ticker: 'WFC',   name: 'Wells Fargo & Co.',         category: 'Financials', fallbackPrice: 68.00 },
  { ticker: 'GS',    name: 'Goldman Sachs Group Inc.',  category: 'Financials', fallbackPrice: 540.00 },
  { ticker: 'MS',    name: 'Morgan Stanley',            category: 'Financials', fallbackPrice: 120.00 },
  { ticker: 'C',     name: 'Citigroup Inc.',            category: 'Financials', fallbackPrice: 65.00 },
  { ticker: 'BLK',   name: 'BlackRock Inc.',            category: 'Financials', fallbackPrice: 950.00 },
  { ticker: 'SCHW',  name: 'Charles Schwab Corp.',      category: 'Financials', fallbackPrice: 70.00 },
  { ticker: 'AXP',   name: 'American Express Co.',      category: 'Financials', fallbackPrice: 250.00 },
  { ticker: 'V',     name: 'Visa Inc.',                 category: 'Financials', fallbackPrice: 280.00 },
  { ticker: 'MA',    name: 'Mastercard Inc.',           category: 'Financials', fallbackPrice: 500.00 },
  { ticker: 'SPGI',  name: 'S&P Global Inc.',           category: 'Financials', fallbackPrice: 460.00 },

  // ─── Healthcare ───────────────────────────────────────────────────────────
  { ticker: 'UNH',   name: 'UnitedHealth Group Inc.',   category: 'Healthcare', fallbackPrice: 500.00 },
  { ticker: 'JNJ',   name: 'Johnson & Johnson',         category: 'Healthcare', fallbackPrice: 155.00 },
  { ticker: 'LLY',   name: 'Eli Lilly and Co.',         category: 'Healthcare', fallbackPrice: 800.00 },
  { ticker: 'PFE',   name: 'Pfizer Inc.',               category: 'Healthcare', fallbackPrice: 26.00 },
  { ticker: 'ABBV',  name: 'AbbVie Inc.',               category: 'Healthcare', fallbackPrice: 180.00 },
  { ticker: 'MRK',   name: 'Merck & Co. Inc.',          category: 'Healthcare', fallbackPrice: 100.00 },
  { ticker: 'TMO',   name: 'Thermo Fisher Scientific',  category: 'Healthcare', fallbackPrice: 550.00 },
  { ticker: 'ABT',   name: 'Abbott Laboratories',       category: 'Healthcare', fallbackPrice: 115.00 },
  { ticker: 'DHR',   name: 'Danaher Corp.',             category: 'Healthcare', fallbackPrice: 250.00 },
  { ticker: 'BMY',   name: 'Bristol-Myers Squibb Co.',  category: 'Healthcare', fallbackPrice: 55.00 },
  { ticker: 'AMGN',  name: 'Amgen Inc.',                category: 'Healthcare', fallbackPrice: 280.00 },
  { ticker: 'GILD',  name: 'Gilead Sciences Inc.',      category: 'Healthcare', fallbackPrice: 90.00 },
  { ticker: 'CVS',   name: 'CVS Health Corp.',          category: 'Healthcare', fallbackPrice: 65.00 },
  { ticker: 'MDT',   name: 'Medtronic plc',             category: 'Healthcare', fallbackPrice: 90.00 },
  { ticker: 'ISRG',  name: 'Intuitive Surgical Inc.',   category: 'Healthcare', fallbackPrice: 550.00 },

  // ─── Industrials ──────────────────────────────────────────────────────────
  { ticker: 'BA',    name: 'Boeing Co.',                category: 'Industrials', fallbackPrice: 180.00 },
  { ticker: 'CAT',   name: 'Caterpillar Inc.',          category: 'Industrials', fallbackPrice: 380.00 },
  { ticker: 'GE',    name: 'GE Aerospace',              category: 'Industrials', fallbackPrice: 190.00 },
  { ticker: 'HON',   name: 'Honeywell International',   category: 'Industrials', fallbackPrice: 210.00 },
  { ticker: 'UPS',   name: 'United Parcel Service',     category: 'Industrials', fallbackPrice: 130.00 },
  { ticker: 'RTX',   name: 'RTX Corp.',                 category: 'Industrials', fallbackPrice: 130.00 },
  { ticker: 'LMT',   name: 'Lockheed Martin Corp.',     category: 'Industrials', fallbackPrice: 480.00 },
  { ticker: 'DE',    name: 'Deere & Co.',               category: 'Industrials', fallbackPrice: 430.00 },
  { ticker: 'UNP',   name: 'Union Pacific Corp.',       category: 'Industrials', fallbackPrice: 240.00 },
  { ticker: 'MMM',   name: '3M Co.',                    category: 'Industrials', fallbackPrice: 135.00 },

  // ─── Energy ───────────────────────────────────────────────────────────────
  { ticker: 'XOM',   name: 'Exxon Mobil Corp.',         category: 'Energy', fallbackPrice: 115.00 },
  { ticker: 'CVX',   name: 'Chevron Corp.',             category: 'Energy', fallbackPrice: 155.00 },
  { ticker: 'COP',   name: 'ConocoPhillips',            category: 'Energy', fallbackPrice: 100.00 },
  { ticker: 'SLB',   name: 'Schlumberger (SLB) Ltd.',   category: 'Energy', fallbackPrice: 45.00 },
  { ticker: 'EOG',   name: 'EOG Resources Inc.',        category: 'Energy', fallbackPrice: 120.00 },
  { ticker: 'OXY',   name: 'Occidental Petroleum Corp.', category: 'Energy', fallbackPrice: 55.00 },

  // ─── Real Estate ──────────────────────────────────────────────────────────
  { ticker: 'PLD',   name: 'Prologis Inc.',             category: 'Real Estate', fallbackPrice: 115.00 },
  { ticker: 'AMT',   name: 'American Tower Corp.',      category: 'Real Estate', fallbackPrice: 210.00 },
  { ticker: 'EQIX',  name: 'Equinix Inc.',              category: 'Real Estate', fallbackPrice: 850.00 },
  { ticker: 'SPG',   name: 'Simon Property Group Inc.', category: 'Real Estate', fallbackPrice: 165.00 },

  // ─── Utilities ────────────────────────────────────────────────────────────
  { ticker: 'NEE',   name: 'NextEra Energy Inc.',       category: 'Utilities', fallbackPrice: 72.00 },
  { ticker: 'DUK',   name: 'Duke Energy Corp.',         category: 'Utilities', fallbackPrice: 115.00 },
  { ticker: 'SO',    name: 'Southern Co.',               category: 'Utilities', fallbackPrice: 88.00 },

  // ─── Materials ────────────────────────────────────────────────────────────
  { ticker: 'LIN',   name: 'Linde plc',                 category: 'Materials', fallbackPrice: 450.00 },
  { ticker: 'SHW',   name: 'Sherwin-Williams Co.',      category: 'Materials', fallbackPrice: 360.00 },
  { ticker: 'ECL',   name: 'Ecolab Inc.',               category: 'Materials', fallbackPrice: 250.00 },
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

// ─── US Market Session ─────────────────────────────────────────────────────────
// NYSE / NASDAQ hours (America/New_York):
//   Pre-market:  04:00–09:30 ET
//   Regular:     09:30–16:00 ET
//   After-hours: 16:00–20:00 ET
//   Closed:      otherwise and weekends

export type USSession = 'pre' | 'open' | 'post' | 'closed';

export function getUSMarketStatus(): {
  isOpen: boolean;
  session: USSession;
  label: string;
  nextEvent: string;
} {
  // NOT `new Date(new Date().toLocaleString(...))` — re-parsing a
  // locale-formatted string back into a Date is exactly the anti-pattern
  // utils/cairoDate.ts's own top comment warns against: unreliable on
  // Hermes (React Native's JS engine), which is what made this banner's
  // open/closed state and weekend handling read wrong. toLocaleDateString/
  // toLocaleTimeString with an explicit timeZone are the dependable calls;
  // getUTCDay() on a plain "YYYY-MM-DD" string is safe since that string
  // never round-trips through a locale format.
  const dateKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const [etHour, etMinute] = new Date()
    .toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false })
    .split(':')
    .map(Number);
  const day  = new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0=Sun, 6=Sat
  const time = etHour * 60 + etMinute;

  const PRE_START  = 4  * 60;      // 04:00 ET
  const REG_OPEN   = 9  * 60 + 30; // 09:30 ET
  const REG_CLOSE  = 16 * 60;      // 16:00 ET
  const POST_CLOSE = 20 * 60;      // 20:00 ET

  const isWeekday = day >= 1 && day <= 5; // Mon–Fri

  if (isWeekday) {
    if (time >= PRE_START && time < REG_OPEN) {
      return { isOpen: false, session: 'pre',  label: 'Pre-Market',  nextEvent: 'Opens at 9:30 AM ET'  };
    }
    if (time >= REG_OPEN && time < REG_CLOSE) {
      return { isOpen: true,  session: 'open', label: 'Open',        nextEvent: 'Closes at 4:00 PM ET' };
    }
    if (time >= REG_CLOSE && time < POST_CLOSE) {
      return { isOpen: false, session: 'post', label: 'After-Hours', nextEvent: 'Closes at 8:00 PM ET' };
    }
  }

  let nextEvent: string;
  if (day === 5 && time >= POST_CLOSE) nextEvent = 'Opens Monday 9:30 AM ET';
  else if (day === 6)                  nextEvent = 'Opens Monday 9:30 AM ET';
  else if (day === 0)                  nextEvent = 'Opens Tomorrow 9:30 AM ET';
  else if (time < PRE_START)           nextEvent = 'Pre-Market at 4:00 AM ET';
  else                                 nextEvent = 'Opens Tomorrow 9:30 AM ET';

  return { isOpen: false, session: 'closed', label: 'Closed', nextEvent };
}
