import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  Control,
  ControlFilters,
  ControlListResult,
  ControlStatusCount,
  CreateControlInput,
  UpdateControlInput,
} from '../types/controls.types';

export const controlsApi = {
  list(filters: ControlFilters = {}) {
    return apiClient.get<ApiResponse<ControlListResult>>('/controls', { params: filters });
  },

  get(id: string) {
    return apiClient.get<ApiResponse<Control>>(`/controls/${id}`);
  },

  stats() {
    return apiClient.get<ApiResponse<ControlStatusCount[]>>('/controls/stats');
  },

  overdue() {
    return apiClient.get<ApiResponse<Control[]>>('/controls/overdue');
  },

  create(input: CreateControlInput) {
    return apiClient.post<ApiResponse<Control>>('/controls', input);
  },

  update(id: string, input: UpdateControlInput) {
    return apiClient.patch<ApiResponse<Control>>(`/controls/${id}`, input);
  },

  markReviewed(id: string) {
    return apiClient.post<ApiResponse<Control>>(`/controls/${id}/review`);
  },

  remove(id: string) {
    return apiClient.delete(`/controls/${id}`);
  },
};
