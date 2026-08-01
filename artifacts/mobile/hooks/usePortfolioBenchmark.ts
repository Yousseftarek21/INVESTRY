import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/utils/api';

export interface PortfolioBenchmark {
  available: boolean;
  period?: 'month';
  userPctChange?: number;
  averagePctChange?: number;
  sampleSize?: number;
}

// This user's month-to-date portfolio % change vs. the average of every
// other user with enough snapshot history this month. The server returns
// { available: false } when either side lacks real data (a brand-new
// account, or too few other users this early in the month) — shown as an
// honest "not enough data yet" state, never a made-up number.
export function usePortfolioBenchmark() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<PortfolioBenchmark>({
    queryKey: ['portfolio-benchmark'],
    enabled: !!isSignedIn,
    staleTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return { available: false };
      const res = await apiFetch('/api/portfolio/benchmark', token);
      if (!res.ok) throw new Error(`API ${res.status}`);
      return res.json();
    },
  });
}
