import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { controlsApi } from '../api/controls.api';
import type { ControlFilters, CreateControlInput, UpdateControlInput } from '../types/controls.types';

export const controlKeys = {
  all:     ['controls'] as const,
  list:    (f: ControlFilters) => [...controlKeys.all, 'list', f] as const,
  detail:  (id: string) => [...controlKeys.all, id] as const,
  stats:   () => [...controlKeys.all, 'stats'] as const,
  overdue: () => [...controlKeys.all, 'overdue'] as const,
};

function errorMessage(fallback: string) {
  return (err: { response?: { data?: { error?: { message: string } } } }) =>
    toast.error(err.response?.data?.error?.message ?? fallback);
}

export function useControls(filters: ControlFilters = {}) {
  return useQuery({
    queryKey: controlKeys.list(filters),
    queryFn:  () => controlsApi.list(filters).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  });
}

export function useControl(id: string) {
  return useQuery({
    queryKey: controlKeys.detail(id),
    queryFn:  () => controlsApi.get(id).then((r) => r.data.data),
    enabled:  Boolean(id),
  });
}

export function useControlStats() {
  return useQuery({
    queryKey: controlKeys.stats(),
    queryFn:  () => controlsApi.stats().then((r) => r.data.data ?? []),
  });
}

export function useOverdueControls() {
  return useQuery({
    queryKey: controlKeys.overdue(),
    queryFn:  () => controlsApi.overdue().then((r) => r.data.data ?? []),
  });
}

export function useCreateControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateControlInput) => controlsApi.create(input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: controlKeys.all });
      toast.success('Control created successfully.');
    },
    onError: errorMessage('Failed to create control.'),
  });
}

export function useUpdateControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateControlInput }) =>
      controlsApi.update(id, input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: controlKeys.all });
      toast.success('Control updated successfully.');
    },
    onError: errorMessage('Failed to update control.'),
  });
}

export function useDeleteControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => controlsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: controlKeys.all });
      toast.success('Control deleted.');
    },
    onError: errorMessage('Failed to delete control.'),
  });
}

export function useMarkReviewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => controlsApi.markReviewed(id).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: controlKeys.all });
      toast.success('Control marked as reviewed.');
    },
    onError: errorMessage('Failed to mark control as reviewed.'),
  });
}
