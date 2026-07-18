import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  Risk,
  RiskFilters,
  RiskListResult,
  RiskStats,
  CreateRiskInput,
  UpdateRiskInput,
} from '../types/risks.types';

export const risksApi = {
  list(filters: RiskFilters = {}) {
    return apiClient.get<ApiResponse<RiskListResult>>('/risks', { params: filters });
  },

  get(id: string) {
    return apiClient.get<ApiResponse<Risk>>(`/risks/${id}`);
  },

  stats() {
    return apiClient.get<ApiResponse<RiskStats>>('/risks/stats');
  },

  create(input: CreateRiskInput) {
    return apiClient.post<ApiResponse<Risk>>('/risks', input);
  },

  update(id: string, input: UpdateRiskInput) {
    return apiClient.patch<ApiResponse<Risk>>(`/risks/${id}`, input);
  },

  remove(id: string) {
    return apiClient.delete(`/risks/${id}`);
  },
};
