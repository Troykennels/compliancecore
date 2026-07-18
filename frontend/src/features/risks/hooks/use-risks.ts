import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { risksApi } from '../api/risks.api';
import type { RiskFilters, CreateRiskInput, UpdateRiskInput } from '../types/risks.types';

export const riskKeys = {
  all:    ['risks'] as const,
  list:   (f: RiskFilters) => [...riskKeys.all, 'list', f] as const,
  detail: (id: string) => [...riskKeys.all, id] as const,
  stats:  () => [...riskKeys.all, 'stats'] as const,
};

function errorMessage(fallback: string) {
  return (err: { response?: { data?: { error?: { message: string } } } }) =>
    toast.error(err.response?.data?.error?.message ?? fallback);
}

export function useRisks(filters: RiskFilters = {}) {
  return useQuery({
    queryKey: riskKeys.list(filters),
    queryFn:  () => risksApi.list(filters).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  });
}

export function useRisk(id: string) {
  return useQuery({
    queryKey: riskKeys.detail(id),
    queryFn:  () => risksApi.get(id).then((r) => r.data.data),
    enabled:  Boolean(id),
  });
}

export function useRiskStats() {
  return useQuery({
    queryKey: riskKeys.stats(),
    queryFn:  () => risksApi.stats().then((r) => r.data.data),
  });
}

export function useCreateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRiskInput) => risksApi.create(input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      toast.success('Risk created successfully.');
    },
    onError: errorMessage('Failed to create risk.'),
  });
}

export function useUpdateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRiskInput }) =>
      risksApi.update(id, input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      toast.success('Risk updated successfully.');
    },
    onError: errorMessage('Failed to update risk.'),
  });
}

export function useDeleteRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => risksApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      toast.success('Risk deleted.');
    },
    onError: errorMessage('Failed to delete risk.'),
  });
}
