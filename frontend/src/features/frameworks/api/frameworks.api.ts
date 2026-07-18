import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type { AdoptResult, Framework, FrameworkDetail } from '../types/frameworks.types';

export const frameworksApi = {
  list() {
    return apiClient.get<ApiResponse<Framework[]>>('/frameworks');
  },

  get(id: string) {
    return apiClient.get<ApiResponse<FrameworkDetail>>(`/frameworks/${id}`);
  },

  adopt(id: string) {
    return apiClient.post<ApiResponse<AdoptResult>>(`/frameworks/${id}/adopt`);
  },
};
