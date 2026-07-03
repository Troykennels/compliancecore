import { apiClient } from '@/lib/api-client';
import type { Branch, CreateBranchDto, UpdateBranchDto, BranchListResult } from '../types/branches.types';
import type { ApiResponse } from '@/types/api';

export interface ListBranchesParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export const branchesApi = {
  list(params?: ListBranchesParams) {
    return apiClient.get<ApiResponse<BranchListResult>>('/branches', { params });
  },

  getById(id: string) {
    return apiClient.get<ApiResponse<{ branch: Branch }>>(`/branches/${id}`);
  },

  create(dto: CreateBranchDto) {
    return apiClient.post<ApiResponse<{ branch: Branch }>>('/branches', dto);
  },

  update(id: string, dto: UpdateBranchDto) {
    return apiClient.patch<ApiResponse<{ branch: Branch }>>(`/branches/${id}`, dto);
  },

  delete(id: string) {
    return apiClient.delete(`/branches/${id}`);
  },
};
