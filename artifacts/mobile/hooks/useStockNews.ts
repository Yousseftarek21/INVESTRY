import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/utils/api';

export interface StockNewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: number; // unix seconds
  url: string;
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// Public endpoint, no auth — same as useEGXMarket's server fetch. 5-minute
// staleTime matches the server's own cache TTL for this route, so reopening
// a stock's financials sheet within that window is instant, not a refetch.
export function useStockNews(symbol: string | undefined) {
  return useQuery<StockNewsItem[]>({
    queryKey: ['stock-news', symbol],
    queryFn: async () => {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/markets/stock-news?symbol=${symbol}`, { signal: timeoutSignal(8000) });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 5 * 60_000,
  });
}
