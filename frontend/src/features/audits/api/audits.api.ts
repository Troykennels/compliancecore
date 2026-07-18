import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  Audit,
  AuditFilters,
  AuditListResult,
  AuditFinding,
  CreateAuditInput,
  UpdateAuditInput,
  CreateFindingInput,
  UpdateFindingInput,
} from '../types/audits.types';

export const auditsApi = {
  list(filters: AuditFilters = {}) {
    return apiClient.get<ApiResponse<AuditListResult>>('/audits', { params: filters });
  },

  get(id: string) {
    return apiClient.get<ApiResponse<Audit>>(`/audits/${id}`);
  },

  create(input: CreateAuditInput) {
    return apiClient.post<ApiResponse<Audit>>('/audits', input);
  },

  update(id: string, input: UpdateAuditInput) {
    return apiClient.patch<ApiResponse<Audit>>(`/audits/${id}`, input);
  },

  remove(id: string) {
    return apiClient.delete(`/audits/${id}`);
  },

  findings(id: string) {
    return apiClient.get<ApiResponse<AuditFinding[]>>(`/audits/${id}/findings`);
  },

  createFinding(id: string, input: CreateFindingInput) {
    return apiClient.post<ApiResponse<AuditFinding>>(`/audits/${id}/findings`, input);
  },

  updateFinding(findingId: string, input: UpdateFindingInput) {
    return apiClient.patch<ApiResponse<AuditFinding>>(`/audits/findings/${findingId}`, input);
  },

  removeFinding(findingId: string) {
    return apiClient.delete(`/audits/findings/${findingId}`);
  },
};
