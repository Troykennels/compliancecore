import { apiClient } from '@/lib/api-client';
import type {
  DepartmentWithRelations,
  DepartmentTreeNode,
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from '../types/departments.types';
import type { ApiResponse } from '@/types/api';

export interface ListDepartmentsParams {
  page?: number;
  limit?: number;
  search?: string;
  branchId?: string;
  isActive?: boolean;
  tree?: boolean;
}

export interface DepartmentListResult {
  departments?: DepartmentWithRelations[];
  tree?: DepartmentTreeNode[];
  total: number;
}

export const departmentsApi = {
  list(params?: ListDepartmentsParams) {
    return apiClient.get<ApiResponse<DepartmentListResult>>('/departments', { params });
  },

  getById(id: string) {
    return apiClient.get<ApiResponse<{ department: DepartmentWithRelations }>>(`/departments/${id}`);
  },

  create(dto: CreateDepartmentDto) {
    return apiClient.post<ApiResponse<{ department: DepartmentWithRelations }>>('/departments', dto);
  },

  update(id: string, dto: UpdateDepartmentDto) {
    return apiClient.patch<ApiResponse<{ department: DepartmentWithRelations }>>(`/departments/${id}`, dto);
  },

  delete(id: string) {
    return apiClient.delete(`/departments/${id}`);
  },
};
