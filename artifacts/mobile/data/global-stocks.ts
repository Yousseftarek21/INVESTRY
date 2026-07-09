// Global stocks & indices — 8 key US tickers (fits Twelve Data free tier: 8 credits/min)
// Fetched live via Twelve Data API

export const GLOBAL_CATEGORIES = [
  'All',
  'Indices',
  'Technology',
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

  // ─── Technology / Large Cap ───────────────────────────────────────────────
  { ticker: 'AAPL',  yahoo: 'AAPL',  name: 'Apple Inc.',               category: 'Technology', fallbackPrice: 225.00 },
  { ticker: 'MSFT',  yahoo: 'MSFT',  name: 'Microsoft Corp.',          category: 'Technology', fallbackPrice: 420.00 },
  { ticker: 'NVDA',  yahoo: 'NVDA',  name: 'NVIDIA Corp.',             category: 'Technology', fallbackPrice: 135.00 },
  { ticker: 'GOOGL', yahoo: 'GOOGL', name: 'Alphabet Inc.',            category: 'Technology', fallbackPrice: 170.00 },
  { ticker: 'AMZN',  yahoo: 'AMZN',  name: 'Amazon.com Inc.',          category: 'Technology', fallbackPrice: 185.00 },
  { ticker: 'TSLA',  yahoo: 'TSLA',  name: 'Tesla Inc.',               category: 'Technology', fallbackPrice: 250.00 },
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
  const et   = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day  = et.getDay(); // 0=Sun, 6=Sat
  const time = et.getHours() * 60 + et.getMinutes();

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
