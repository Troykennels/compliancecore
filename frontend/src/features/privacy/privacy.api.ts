import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';

export type RegisterKey = 'activities' | 'requests' | 'assessments';
export type PrivacyRow = Record<string, unknown> & {
  id: string;
  status: string;
  updatedAt: string;
};
export interface PrivacySummary {
  activeActivities: number;
  openRequests: number;
  overdueRequests: number;
  openAssessments: number;
}

export function usePrivacySummary() {
  return useQuery({
    queryKey: ['privacy', 'summary'],
    queryFn: () =>
      apiClient.get<ApiResponse<PrivacySummary>>('/privacy/summary').then((r) => r.data.data),
  });
}
export function usePrivacyRegister(key: RegisterKey, enabled = true) {
  return useQuery({
    queryKey: ['privacy', key],
    enabled,
    queryFn: () =>
      apiClient.get<ApiResponse<PrivacyRow[]>>(`/privacy/${key}`).then((r) => r.data.data),
  });
}
type ApiError = {
  response?: { data?: { error?: { message?: string; details?: Array<{ message?: string }> } } };
};
export function errorMessage(e: unknown, fallback: string): string {
  const err = (e as ApiError).response?.data?.error;
  return err?.details?.[0]?.message ?? err?.message ?? fallback;
}
export function usePrivacySave(key: RegisterKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: unknown }) =>
      id ? apiClient.put(`/privacy/${key}/${id}`, data) : apiClient.post(`/privacy/${key}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['privacy'] });
      toast.success('Saved.');
    },
    onError: (e) => toast.error(errorMessage(e, 'Could not save. Please retry.')),
  });
}
export function usePrivacyDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: 'submit' | 'approve' | 'reject' | 'return';
      note?: string;
    }) => apiClient.post(`/privacy/assessments/${id}/decision`, { decision, note }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['privacy'] });
      toast.success('Decision recorded.');
    },
    onError: (e) => toast.error(errorMessage(e, 'Could not record the decision.')),
  });
}
