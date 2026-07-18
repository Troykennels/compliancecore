import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { auditsApi } from '../api/audits.api';
import type {
  AuditFilters,
  CreateAuditInput,
  UpdateAuditInput,
  CreateFindingInput,
  UpdateFindingInput,
} from '../types/audits.types';

export const auditKeys = {
  all:      ['audits'] as const,
  list:     (f: AuditFilters) => [...auditKeys.all, 'list', f] as const,
  detail:   (id: string) => [...auditKeys.all, id] as const,
  findings: (id: string) => [...auditKeys.all, id, 'findings'] as const,
};

function errorMessage(fallback: string) {
  return (err: { response?: { data?: { error?: { message: string } } } }) =>
    toast.error(err.response?.data?.error?.message ?? fallback);
}

export function useAudits(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn:  () => auditsApi.list(filters).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  });
}

export function useAudit(id: string) {
  return useQuery({
    queryKey: auditKeys.detail(id),
    queryFn:  () => auditsApi.get(id).then((r) => r.data.data),
    enabled:  Boolean(id),
  });
}

export function useAuditFindings(id: string) {
  return useQuery({
    queryKey: auditKeys.findings(id),
    queryFn:  () => auditsApi.findings(id).then((r) => r.data.data ?? []),
    enabled:  Boolean(id),
  });
}

export function useCreateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAuditInput) => auditsApi.create(input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: auditKeys.all });
      toast.success('Audit created successfully.');
    },
    onError: errorMessage('Failed to create audit.'),
  });
}

export function useUpdateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAuditInput }) =>
      auditsApi.update(id, input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: auditKeys.all });
      toast.success('Audit updated successfully.');
    },
    onError: errorMessage('Failed to update audit.'),
  });
}

export function useDeleteAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => auditsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: auditKeys.all });
      toast.success('Audit deleted.');
    },
    onError: errorMessage('Failed to delete audit.'),
  });
}

export function useCreateFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateFindingInput }) =>
      auditsApi.createFinding(id, input).then((r) => r.data.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: auditKeys.findings(variables.id) });
      qc.invalidateQueries({ queryKey: auditKeys.detail(variables.id) });
      toast.success('Finding added successfully.');
    },
    onError: errorMessage('Failed to add finding.'),
  });
}

export function useUpdateFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId, input }: { auditId: string; findingId: string; input: UpdateFindingInput }) =>
      auditsApi.updateFinding(findingId, input).then((r) => r.data.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: auditKeys.findings(variables.auditId) });
      qc.invalidateQueries({ queryKey: auditKeys.detail(variables.auditId) });
      toast.success('Finding updated successfully.');
    },
    onError: errorMessage('Failed to update finding.'),
  });
}

export function useDeleteFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId }: { auditId: string; findingId: string }) =>
      auditsApi.removeFinding(findingId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: auditKeys.findings(variables.auditId) });
      qc.invalidateQueries({ queryKey: auditKeys.detail(variables.auditId) });
      toast.success('Finding deleted.');
    },
    onError: errorMessage('Failed to delete finding.'),
  });
}
