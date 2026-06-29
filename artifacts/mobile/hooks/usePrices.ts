import { useQuery } from '@tanstack/react-query';
import { EGXStock, MarketPrices } from '@/types';

const TROY_OZ_TO_GRAMS = 31.1035;

const FALLBACK_PRICES: MarketPrices = {
  goldUsd: 2350,
  silverUsd: 29.5,
  usdToEgp: 50.9,
  lastUpdated: new Date(),
};

const EGX_STOCKS: EGXStock[] = [
  { symbol: 'COMI', name: 'Commercial Intl Bank', price: 95.80, change: 1.20, changePercent: 1.27 },
  { symbol: 'HRHO', name: 'EFG Hermes Holding', price: 35.50, change: -0.30, changePercent: -0.84 },
  { symbol: 'TMGH', name: 'Talaat Moustafa Group', price: 28.40, change: 0.55, changePercent: 1.98 },
  { symbol: 'ORWE', name: 'Oriental Weavers', price: 14.90, change: -0.10, changePercent: -0.67 },
  { symbol: 'EAST', name: 'Eastern Company', price: 32.20, change: 0.80, changePercent: 2.55 },
  { symbol: 'ORAS', name: 'Orascom Construction', price: 52.60, change: -1.40, changePercent: -2.59 },
  { symbol: 'CLHO', name: 'Cleopatra Hospital', price: 11.30, change: 0.20, changePercent: 1.80 },
  { symbol: 'EKHO', name: 'EK Holding', price: 18.75, change: 0.45, changePercent: 2.46 },
];

async function fetchMarketPrices(): Promise<MarketPrices> {
  const [forexRes, metalRes] = await Promise.allSettled([
    fetch('https://api.exchangerate-api.com/v4/latest/USD', { headers: { Accept: 'application/json' } }),
    fetch('https://forex-data-feed.swissquote.com/public-rest/v3/quotes?pairs=XAU/USD,XAG/USD', {
      headers: { Accept: 'application/json' },
    }),
  ]);

  let usdToEgp = FALLBACK_PRICES.usdToEgp;
  if (forexRes.status === 'fulfilled' && forexRes.value.ok) {
    try {
      const data = await forexRes.value.json();
      if (data?.rates?.EGP) usdToEgp = data.rates.EGP;
    } catch {
      // use fallback
    }
  }

  let goldUsd = FALLBACK_PRICES.goldUsd;
  let silverUsd = FALLBACK_PRICES.silverUsd;
  if (metalRes.status === 'fulfilled' && metalRes.value.ok) {
    try {
      const data = await metalRes.value.json();
      if (Array.isArray(data)) {
        for (const q of data) {
          if (q.pair === 'XAU/USD' && q.bid) goldUsd = Number(q.bid);
          if (q.pair === 'XAG/USD' && q.bid) silverUsd = Number(q.bid);
        }
      }
    } catch {
      // use fallback
    }
  }

  return { goldUsd, silverUsd, usdToEgp, lastUpdated: new Date() };
}

export function useMarketPrices() {
  return useQuery({
    queryKey: ['market-prices'],
    queryFn: fetchMarketPrices,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: FALLBACK_PRICES,
  });
}

export function useEGXStocks() {
  return useQuery({
    queryKey: ['egx-stocks'],
    queryFn: async (): Promise<EGXStock[]> => {
      // Simulate realistic live variation ±0.5% from base
      return EGX_STOCKS.map(s => {
        const variation = (Math.random() - 0.5) * 0.01 * s.price;
        const newPrice = parseFloat((s.price + variation).toFixed(2));
        const delta = parseFloat((newPrice - (s.price - s.change)).toFixed(2));
        const pct = parseFloat(((delta / (s.price - s.change)) * 100).toFixed(2));
        return { ...s, price: newPrice, change: delta, changePercent: pct };
      });
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: EGX_STOCKS,
  });
}

// Derived helpers
export function goldPricePerGram(prices: MarketPrices, karat: '24k' | '21k' | '18k') {
  const perGramUsd = prices.goldUsd / TROY_OZ_TO_GRAMS;
  const purity = karat === '24k' ? 1 : karat === '21k' ? 0.875 : 0.75;
  return perGramUsd * purity * prices.usdToEgp;
}

export function silverPricePerGram(prices: MarketPrices) {
  return (prices.silverUsd / TROY_OZ_TO_GRAMS) * prices.usdToEgp;
}
