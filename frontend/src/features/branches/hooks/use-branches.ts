import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { branchesApi, type ListBranchesParams } from '../api/branches.api';
import type { CreateBranchDto, UpdateBranchDto } from '../types/branches.types';

export const BRANCHES_QUERY_KEY = ['branches'] as const;

export function useBranches(params?: ListBranchesParams) {
  return useQuery({
    queryKey: [...BRANCHES_QUERY_KEY, params],
    queryFn: () => branchesApi.list(params).then((r) => r.data.data),
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateBranchDto) =>
      branchesApi.create(dto).then((r) => r.data.data.branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCHES_QUERY_KEY });
      toast.success('Branch created successfully.');
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to create branch.');
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateBranchDto }) =>
      branchesApi.update(id, dto).then((r) => r.data.data.branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCHES_QUERY_KEY });
      toast.success('Branch updated successfully.');
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to update branch.');
    },
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => branchesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCHES_QUERY_KEY });
      toast.success('Branch deleted.');
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to delete branch.');
    },
  });
}
