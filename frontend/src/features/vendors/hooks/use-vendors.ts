import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { vendorsApi } from '../api/vendors.api';
import type {
  VendorFilters,
  CreateVendorInput,
  UpdateVendorInput,
  CreateVendorAssessmentInput,
} from '../types/vendors.types';

export const vendorKeys = {
  all:         ['vendors'] as const,
  list:        (f: VendorFilters) => [...vendorKeys.all, 'list', f] as const,
  detail:      (id: string) => [...vendorKeys.all, id] as const,
  assessments: (id: string) => [...vendorKeys.all, id, 'assessments'] as const,
};

function errorMessage(fallback: string) {
  return (err: { response?: { data?: { error?: { message: string } } } }) =>
    toast.error(err.response?.data?.error?.message ?? fallback);
}

export function useVendors(filters: VendorFilters = {}) {
  return useQuery({
    queryKey: vendorKeys.list(filters),
    queryFn:  () => vendorsApi.list(filters).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  });
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: vendorKeys.detail(id),
    queryFn:  () => vendorsApi.get(id).then((r) => r.data.data),
    enabled:  Boolean(id),
  });
}

export function useVendorAssessments(id: string) {
  return useQuery({
    queryKey: vendorKeys.assessments(id),
    queryFn:  () => vendorsApi.assessments(id).then((r) => r.data.data ?? []),
    enabled:  Boolean(id),
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVendorInput) => vendorsApi.create(input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.all });
      toast.success('Vendor created successfully.');
    },
    onError: errorMessage('Failed to create vendor.'),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVendorInput }) =>
      vendorsApi.update(id, input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.all });
      toast.success('Vendor updated successfully.');
    },
    onError: errorMessage('Failed to update vendor.'),
  });
}

export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vendorsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.all });
      toast.success('Vendor deleted.');
    },
    onError: errorMessage('Failed to delete vendor.'),
  });
}

export function useCreateVendorAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateVendorAssessmentInput }) =>
      vendorsApi.createAssessment(id, input).then((r) => r.data.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: vendorKeys.assessments(variables.id) });
      qc.invalidateQueries({ queryKey: vendorKeys.detail(variables.id) });
      toast.success('Assessment added successfully.');
    },
    onError: errorMessage('Failed to add assessment.'),
  });
}
