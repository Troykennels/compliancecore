import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { scoreApi } from '../api/score.api';

export const scoreKeys = {
  all:      ['compliance-score'] as const,
  current:  () => [...scoreKeys.all, 'current'] as const,
  trend:    (days: number) => [...scoreKeys.all, 'trend', days] as const,
  snapshot: () => [...scoreKeys.all, 'snapshot'] as const,
};

export function useCurrentScore() {
  return useQuery({
    queryKey: scoreKeys.current(),
    queryFn:  () => scoreApi.getCurrent().then((r) => r.data.data!),
    staleTime: 5 * 60 * 1000,
  });
}

export function useScoreTrend(days = 180) {
  return useQuery({
    queryKey: scoreKeys.trend(days),
    queryFn:  () => scoreApi.getTrend(days).then((r) => r.data.data ?? []),
    staleTime: 10 * 60 * 1000,
  });
}

export function useLatestSnapshot() {
  return useQuery({
    queryKey: scoreKeys.snapshot(),
    queryFn:  () => scoreApi.getLatestSnapshot().then((r) => r.data.data!),
    staleTime: 10 * 60 * 1000,
  });
}

export function useTriggerSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => scoreApi.triggerSnapshot(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scoreKeys.all });
      toast.success('Compliance snapshot taken.');
    },
    onError: () => toast.error('Failed to take snapshot.'),
  });
}
