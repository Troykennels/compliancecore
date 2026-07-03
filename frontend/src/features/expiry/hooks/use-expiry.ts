import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { expiryApi } from '../api/expiry.api';
import type { ExpiryFilters, CreateExpiryItemDto } from '../types/expiry.types';

export const expiryKeys = {
  all: ['expiry'] as const,
  lists: () => [...expiryKeys.all, 'list'] as const,
  list: (f: ExpiryFilters) => [...expiryKeys.lists(), f] as const,
  detail: (id: string) => [...expiryKeys.all, 'detail', id] as const,
  expiringSoon: (days: number) => [...expiryKeys.all, 'expiring-soon', days] as const,
  stats: () => [...expiryKeys.all, 'stats'] as const,
};

export function useExpiryItems(filters: ExpiryFilters = {}) {
  return useQuery({
    queryKey: expiryKeys.list(filters),
    queryFn: () => expiryApi.list(filters).then((r) => r.data.data!),
    placeholderData: (prev) => prev,
  });
}

export function useExpiryItem(id: string) {
  return useQuery({
    queryKey: expiryKeys.detail(id),
    queryFn: () => expiryApi.getById(id).then((r) => r.data.data!),
    enabled: Boolean(id),
  });
}

export function useExpiringSoon(days = 30) {
  return useQuery({
    queryKey: expiryKeys.expiringSoon(days),
    queryFn: () => expiryApi.getExpiringSoon(days).then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });
}

export function useExpiryStats() {
  return useQuery({
    queryKey: expiryKeys.stats(),
    queryFn: () => expiryApi.getStats().then((r) => r.data.data!),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateExpiryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateExpiryItemDto) => expiryApi.create(dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expiryKeys.lists() });
      qc.invalidateQueries({ queryKey: expiryKeys.stats() });
      toast.success('Expiry item created.');
    },
    onError: () => toast.error('Failed to create expiry item.'),
  });
}

export function useUpdateExpiryItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<CreateExpiryItemDto> & { status?: string }) =>
      expiryApi.update(id, dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expiryKeys.lists() });
      qc.invalidateQueries({ queryKey: expiryKeys.detail(id) });
      qc.invalidateQueries({ queryKey: expiryKeys.stats() });
      toast.success('Expiry item updated.');
    },
    onError: () => toast.error('Failed to update expiry item.'),
  });
}

export function useDeleteExpiryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expiryApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expiryKeys.lists() });
      qc.invalidateQueries({ queryKey: expiryKeys.stats() });
      toast.success('Expiry item deleted.');
    },
    onError: () => toast.error('Failed to delete expiry item.'),
  });
}
