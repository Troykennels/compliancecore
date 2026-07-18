import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  Policy,
  PolicyFilters,
  PolicyListResult,
  CreatePolicyInput,
  UpdatePolicyInput,
} from '../types/policies.types';

export const policiesApi = {
  list(filters: PolicyFilters = {}) {
    return apiClient.get<ApiResponse<PolicyListResult>>('/policies', { params: filters });
  },

  get(id: string) {
    return apiClient.get<ApiResponse<Policy>>(`/policies/${id}`);
  },

  create(input: CreatePolicyInput) {
    return apiClient.post<ApiResponse<Policy>>('/policies', input);
  },

  update(id: string, input: UpdatePolicyInput) {
    return apiClient.patch<ApiResponse<Policy>>(`/policies/${id}`, input);
  },

  publish(id: string) {
    return apiClient.post<ApiResponse<Policy>>(`/policies/${id}/publish`);
  },

  remove(id: string) {
    return apiClient.delete(`/policies/${id}`);
  },
};
