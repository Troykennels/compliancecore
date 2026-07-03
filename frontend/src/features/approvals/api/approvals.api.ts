import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  ApprovalWorkflow, ApprovalRequest,
  CreateApprovalRequestDto, DecideApprovalDto, ApprovalFilters,
} from '../types/approvals.types';

export const approvalsApi = {
  // Workflows
  listWorkflows() {
    return apiClient.get<ApiResponse<ApprovalWorkflow[]>>('/approvals/workflows');
  },
  getWorkflow(id: string) {
    return apiClient.get<ApiResponse<ApprovalWorkflow>>(`/approvals/workflows/${id}`);
  },
  createWorkflow(dto: Partial<ApprovalWorkflow> & { steps: any[] }) {
    return apiClient.post<ApiResponse<ApprovalWorkflow>>('/approvals/workflows', dto);
  },
  updateWorkflow(id: string, dto: Partial<ApprovalWorkflow> & { steps?: any[] }) {
    return apiClient.patch<ApiResponse<ApprovalWorkflow>>(`/approvals/workflows/${id}`, dto);
  },
  deleteWorkflow(id: string) {
    return apiClient.delete(`/approvals/workflows/${id}`);
  },

  // Requests
  listRequests(filters: ApprovalFilters = {}) {
    return apiClient.get<ApiResponse<{ requests: ApprovalRequest[]; total: number }>>('/approvals/requests', { params: filters });
  },
  getRequest(id: string) {
    return apiClient.get<ApiResponse<ApprovalRequest>>(`/approvals/requests/${id}`);
  },
  getMyPending() {
    return apiClient.get<ApiResponse<ApprovalRequest[]>>('/approvals/requests/my-pending');
  },
  createRequest(dto: CreateApprovalRequestDto) {
    return apiClient.post<ApiResponse<ApprovalRequest>>('/approvals/requests', dto);
  },
  decide(id: string, dto: DecideApprovalDto) {
    return apiClient.post<ApiResponse<ApprovalRequest>>(`/approvals/requests/${id}/decide`, dto);
  },
  cancel(id: string, reason?: string) {
    return apiClient.post(`/approvals/requests/${id}/cancel`, { reason });
  },
};
