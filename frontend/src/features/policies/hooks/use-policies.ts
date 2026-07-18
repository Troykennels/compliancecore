import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { policiesApi } from '../api/policies.api';
import type { PolicyFilters, CreatePolicyInput, UpdatePolicyInput } from '../types/policies.types';

export const policyKeys = {
  all:    ['policies'] as const,
  list:   (f: PolicyFilters) => [...policyKeys.all, 'list', f] as const,
  detail: (id: string) => [...policyKeys.all, id] as const,
};

function errorMessage(fallback: string) {
  return (err: { response?: { data?: { error?: { message: string } } } }) =>
    toast.error(err.response?.data?.error?.message ?? fallback);
}

export function usePolicies(filters: PolicyFilters = {}) {
  return useQuery({
    queryKey: policyKeys.list(filters),
    queryFn:  () => policiesApi.list(filters).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  });
}

export function usePolicy(id: string) {
  return useQuery({
    queryKey: policyKeys.detail(id),
    queryFn:  () => policiesApi.get(id).then((r) => r.data.data),
    enabled:  Boolean(id),
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePolicyInput) => policiesApi.create(input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      toast.success('Policy created successfully.');
    },
    onError: errorMessage('Failed to create policy.'),
  });
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePolicyInput }) =>
      policiesApi.update(id, input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      toast.success('Policy updated successfully.');
    },
    onError: errorMessage('Failed to update policy.'),
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => policiesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      toast.success('Policy deleted.');
    },
    onError: errorMessage('Failed to delete policy.'),
  });
}

export function usePublishPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => policiesApi.publish(id).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      toast.success('Policy published.');
    },
    onError: errorMessage('Failed to publish policy.'),
  });
}
