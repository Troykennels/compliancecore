import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  Vendor,
  VendorFilters,
  VendorListResult,
  VendorAssessment,
  CreateVendorInput,
  UpdateVendorInput,
  CreateVendorAssessmentInput,
} from '../types/vendors.types';

export const vendorsApi = {
  list(filters: VendorFilters = {}) {
    return apiClient.get<ApiResponse<VendorListResult>>('/vendors', { params: filters });
  },

  get(id: string) {
    return apiClient.get<ApiResponse<Vendor>>(`/vendors/${id}`);
  },

  create(input: CreateVendorInput) {
    return apiClient.post<ApiResponse<Vendor>>('/vendors', input);
  },

  update(id: string, input: UpdateVendorInput) {
    return apiClient.patch<ApiResponse<Vendor>>(`/vendors/${id}`, input);
  },

  remove(id: string) {
    return apiClient.delete(`/vendors/${id}`);
  },

  assessments(id: string) {
    return apiClient.get<ApiResponse<VendorAssessment[]>>(`/vendors/${id}/assessments`);
  },

  createAssessment(id: string, input: CreateVendorAssessmentInput) {
    return apiClient.post<ApiResponse<VendorAssessment>>(`/vendors/${id}/assessments`, input);
  },
};
