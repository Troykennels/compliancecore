import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { departmentsApi, type ListDepartmentsParams } from '../api/departments.api';
import type { CreateDepartmentDto, UpdateDepartmentDto } from '../types/departments.types';

export const DEPARTMENTS_QUERY_KEY = ['departments'] as const;

export function useDepartments(params?: ListDepartmentsParams) {
  return useQuery({
    queryKey: [...DEPARTMENTS_QUERY_KEY, params],
    queryFn: () => departmentsApi.list(params).then((r) => r.data.data),
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDepartmentDto) =>
      departmentsApi.create(dto).then((r) => r.data.data.department),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
      toast.success('Department created successfully.');
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to create department.');
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDepartmentDto }) =>
      departmentsApi.update(id, dto).then((r) => r.data.data.department),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
      toast.success('Department updated successfully.');
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to update department.');
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => departmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
      toast.success('Department deleted.');
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to delete department.');
    },
  });
}
