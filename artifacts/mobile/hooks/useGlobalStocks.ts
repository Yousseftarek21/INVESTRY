import { useQuery } from '@tanstack/react-query';
import { GLOBAL_COMPANIES, GlobalCompany } from '@/data/global-stocks';
import { getApiBaseUrl } from '@/utils/api';

export interface GlobalStockLive extends GlobalCompany {
  price: number;
  change: number;
  changePercent: number;
  isLive: boolean;
  volume?: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
  pe?: number;
  dividendYield?: number;
}

const API_BASE = `${getApiBaseUrl()}/api`;

interface ApiStock {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

function placeholderStocks(): GlobalStockLive[] {
  return GLOBAL_COMPANIES.map(c => ({
    ...c,
    price: c.fallbackPrice,
    change: 0,
    changePercent: 0,
    isLive: false,
  }));
}

async function fetchGlobalStocksViaApi(): Promise<GlobalStockLive[]> {
  const res = await fetch(`${API_BASE}/markets/global-stocks`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data: ApiStock[] = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('empty');

  const byTicker = new Map(data.map(s => [s.symbol, s]));

  return GLOBAL_COMPANIES.map(company => {
    const s = byTicker.get(company.ticker);
    if (!s || !s.price) return { ...company, price: company.fallbackPrice, change: 0, changePercent: 0, isLive: false };
    return {
      ...company,
      price: s.price,
      change: s.change,
      changePercent: s.changePercent,
      isLive: true,
    };
  });
}

async function fetchAllGlobalStocks(): Promise<GlobalStockLive[]> {
  try {
    return await fetchGlobalStocksViaApi();
  } catch {
    return placeholderStocks();
  }
}

export function useGlobalStocks() {
  return useQuery<GlobalStockLive[]>({
    queryKey: ['global-stocks'],
    queryFn: fetchAllGlobalStocks,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
    placeholderData: placeholderStocks(),
  });
}
