import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  AdoptResult, Framework, FrameworkDetail, UnadoptImpact, UnadoptResult,
} from '../types/frameworks.types';

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

  /** What removing this framework would cost. Read-only. */
  unadoptImpact(id: string) {
    return apiClient.get<ApiResponse<UnadoptImpact>>(`/frameworks/${id}/adopt/impact`);
  },

  /**
   * Remove an adopted framework. Without `force` the server refuses with a 409
   * when the controls carry real work, and that refusal is what the confirmation
   * dialog turns into a warning — so the second call is a deliberate act, not a
   * retry.
   */
  unadopt(id: string, force = false) {
    return apiClient.delete<ApiResponse<UnadoptResult>>(
      `/frameworks/${id}/adopt${force ? '?force=true' : ''}`,
    );
  },
};
