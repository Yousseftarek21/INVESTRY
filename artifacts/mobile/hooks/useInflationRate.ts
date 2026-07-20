import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/utils/api';

const API_BASE = `${getApiBaseUrl()}/api`;

// Last known good value, shown while loading or if the fetch ever fails.
const FALLBACK = { rate: 14.1, year: 2025 };

async function fetchInflationRate(): Promise<{ rate: number; year: number }> {
  try {
    const res = await fetch(`${API_BASE}/inflation`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    if (typeof data?.rate !== 'number' || typeof data?.year !== 'number') throw new Error('Unexpected response shape');
    return data;
  } catch {
    return FALLBACK;
  }
}

// Egypt's latest annual inflation rate (World Bank/CAPMAS CPI data), used as
// the real benchmark line in the portfolio performance chart.
export function useInflationRate() {
  return useQuery({
    queryKey: ['inflation-rate'],
    queryFn: fetchInflationRate,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    placeholderData: FALLBACK,
  });
}
