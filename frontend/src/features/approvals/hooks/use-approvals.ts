import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { approvalsApi } from '../api/approvals.api';
import type { ApprovalFilters, CreateApprovalRequestDto, DecideApprovalDto } from '../types/approvals.types';

export const approvalKeys = {
  all:        ['approvals'] as const,
  workflows:  () => [...approvalKeys.all, 'workflows'] as const,
  workflow:   (id: string) => [...approvalKeys.workflows(), id] as const,
  requests:   (f: ApprovalFilters) => [...approvalKeys.all, 'requests', f] as const,
  request:    (id: string) => [...approvalKeys.all, 'request', id] as const,
  myPending:  () => [...approvalKeys.all, 'my-pending'] as const,
};

export function useWorkflows() {
  return useQuery({
    queryKey: approvalKeys.workflows(),
    queryFn:  () => approvalsApi.listWorkflows().then((r) => r.data.data ?? []),
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: approvalKeys.workflow(id),
    queryFn:  () => approvalsApi.getWorkflow(id).then((r) => r.data.data!),
    enabled:  Boolean(id),
  });
}

export function useApprovalRequests(filters: ApprovalFilters = {}) {
  return useQuery({
    queryKey: approvalKeys.requests(filters),
    queryFn:  () => approvalsApi.listRequests(filters).then((r) => {
      const d = r.data.data!;
      return { items: (d as any).requests ?? [], total: (d as any).total ?? 0 };
    }),
    placeholderData: (prev) => prev,
  });
}

export function useApprovalRequest(id: string) {
  return useQuery({
    queryKey: approvalKeys.request(id),
    queryFn:  () => approvalsApi.getRequest(id).then((r) => r.data.data!),
    enabled:  Boolean(id),
  });
}

export function useMyPendingApprovals() {
  return useQuery({
    queryKey: approvalKeys.myPending(),
    queryFn:  () => approvalsApi.getMyPending().then((r) => r.data.data ?? []),
    refetchInterval: 2 * 60_000,
  });
}

export function useCreateApprovalRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateApprovalRequestDto) =>
      approvalsApi.createRequest(dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: approvalKeys.all });
      toast.success('Approval request submitted.');
    },
    onError: () => toast.error('Failed to submit approval request.'),
  });
}

export function useDecideApproval(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: DecideApprovalDto) =>
      approvalsApi.decide(requestId, dto).then((r) => r.data.data!),
    onSuccess: (_, dto) => {
      qc.invalidateQueries({ queryKey: approvalKeys.all });
      const msgs: Record<string, string> = {
        approved:          'Request approved.',
        rejected:          'Request rejected.',
        changes_requested: 'Changes requested.',
        abstained:         'Abstained from decision.',
      };
      toast.success(msgs[dto.decision] ?? 'Decision recorded.');
    },
    onError: () => toast.error('Failed to record decision.'),
  });
}

export function useCancelApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      approvalsApi.cancel(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: approvalKeys.all });
      toast.success('Request cancelled.');
    },
    onError: () => toast.error('Failed to cancel request.'),
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => approvalsApi.createWorkflow(dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: approvalKeys.workflows() });
      toast.success('Workflow created.');
    },
    onError: () => toast.error('Failed to create workflow.'),
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approvalsApi.deleteWorkflow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: approvalKeys.workflows() });
      toast.success('Workflow deleted.');
    },
    onError: () => toast.error('Failed to delete workflow.'),
  });
}
