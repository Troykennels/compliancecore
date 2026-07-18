import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics.api';

export const ANALYTICS_KEYS = {
  overview: () => ['analytics', 'overview'] as const,
};

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ANALYTICS_KEYS.overview(),
    queryFn: () => analyticsApi.getOverview().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
