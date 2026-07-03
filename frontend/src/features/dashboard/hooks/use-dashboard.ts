import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard.api';

export const dashboardKeys = {
  all:     ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn:  () => dashboardApi.getSummary().then((r) => r.data.data!),
    staleTime:      60_000,
    refetchInterval: 5 * 60_000,
  });
}
