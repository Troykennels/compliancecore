import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { evidenceApi } from '../api/evidence.api';
import type { EvidenceFilters, UpdateEvidenceDto, CreateTagDto, CreateShareDto } from '../types/evidence.types';

// ── Query Keys ─────────────────────────────────────────────────────────────────
export const evidenceKeys = {
  all: ['evidence'] as const,
  lists: () => [...evidenceKeys.all, 'list'] as const,
  list: (filters: EvidenceFilters) => [...evidenceKeys.lists(), filters] as const,
  detail: (id: string) => [...evidenceKeys.all, 'detail', id] as const,
  versions: (id: string) => [...evidenceKeys.all, 'versions', id] as const,
  preview: (id: string) => [...evidenceKeys.all, 'preview', id] as const,
  shares: (id: string) => [...evidenceKeys.all, 'shares', id] as const,
  audit: (id: string) => [...evidenceKeys.all, 'audit', id] as const,
  ocr: (id: string) => [...evidenceKeys.all, 'ocr', id] as const,
  categories: () => ['evidence-categories'] as const,
  tags: () => ['evidence-tags'] as const,
};

// ── Categories ─────────────────────────────────────────────────────────────────
export function useEvidenceCategories() {
  return useQuery({
    queryKey: evidenceKeys.categories(),
    queryFn: () => evidenceApi.listCategories().then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Tags ───────────────────────────────────────────────────────────────────────
export function useEvidenceTags() {
  return useQuery({
    queryKey: evidenceKeys.tags(),
    queryFn: () => evidenceApi.listTags().then((r) => r.data.data ?? []),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTagDto) => evidenceApi.createTag(dto).then((r) => r.data.data!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: evidenceKeys.tags() }); },
    onError: () => { toast.error('Failed to create tag.'); },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => evidenceApi.deleteTag(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: evidenceKeys.tags() }); },
    onError: () => { toast.error('Failed to delete tag.'); },
  });
}

// ── Evidence List ───────────────────────────────────────────────────────────────
export function useEvidence(filters: EvidenceFilters = {}) {
  return useQuery({
    queryKey: evidenceKeys.list(filters),
    queryFn: () => evidenceApi.list(filters).then((r) => r.data.data!),
    placeholderData: (prev) => prev,
  });
}

// ── Evidence Detail ─────────────────────────────────────────────────────────────
export function useEvidenceDetail(id: string) {
  return useQuery({
    queryKey: evidenceKeys.detail(id),
    queryFn: () => evidenceApi.getById(id).then((r) => r.data.data!),
    enabled: Boolean(id),
  });
}

export function useUpdateEvidence(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateEvidenceDto) => evidenceApi.update(id, dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evidenceKeys.detail(id) });
      qc.invalidateQueries({ queryKey: evidenceKeys.lists() });
      toast.success('Evidence updated.');
    },
    onError: () => { toast.error('Failed to update evidence.'); },
  });
}

export function useDeleteEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => evidenceApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evidenceKeys.lists() });
      toast.success('Evidence deleted.');
    },
    onError: () => { toast.error('Failed to delete evidence.'); },
  });
}

// ── Versions ───────────────────────────────────────────────────────────────────
export function useEvidenceVersions(evidenceId: string) {
  return useQuery({
    queryKey: evidenceKeys.versions(evidenceId),
    queryFn: () => evidenceApi.listVersions(evidenceId).then((r) => r.data.data ?? []),
    enabled: Boolean(evidenceId),
  });
}

// ── Preview ────────────────────────────────────────────────────────────────────
export function useEvidencePreviewUrl(evidenceId: string, enabled = true) {
  return useQuery({
    queryKey: evidenceKeys.preview(evidenceId),
    queryFn: () => evidenceApi.getPreviewUrl(evidenceId).then((r) => r.data.data!),
    enabled: Boolean(evidenceId) && enabled,
    staleTime: 30 * 60 * 1000, // 30 min — presigned URL is valid for 60 min
  });
}

// ── Shares ─────────────────────────────────────────────────────────────────────
export function useEvidenceShares(evidenceId: string) {
  return useQuery({
    queryKey: evidenceKeys.shares(evidenceId),
    queryFn: () => evidenceApi.listShares(evidenceId).then((r) => r.data.data ?? []),
    enabled: Boolean(evidenceId),
  });
}

export function useCreateShare(evidenceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateShareDto) =>
      evidenceApi.createShare(evidenceId, dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evidenceKeys.shares(evidenceId) });
    },
    onError: () => { toast.error('Failed to create share link.'); },
  });
}

export function useRevokeShare(evidenceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => evidenceApi.revokeShare(evidenceId, shareId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evidenceKeys.shares(evidenceId) });
      toast.success('Share link revoked.');
    },
    onError: () => { toast.error('Failed to revoke share link.'); },
  });
}

// ── OCR ────────────────────────────────────────────────────────────────────────
export function useEvidenceOcr(evidenceId: string) {
  return useQuery({
    queryKey: evidenceKeys.ocr(evidenceId),
    queryFn: () => evidenceApi.getOcrText(evidenceId).then((r) => r.data.data!),
    enabled: Boolean(evidenceId),
    refetchInterval: (query) => {
      // Poll until OCR is no longer in progress
      const status = query.state.data?.ocrStatus;
      if (status === 'pending' || status === 'processing') return 5000;
      return false;
    },
  });
}

export function useRetryOcr(evidenceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => evidenceApi.retryOcr(evidenceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evidenceKeys.ocr(evidenceId) });
      toast.success('OCR queued. Text will appear shortly.');
    },
    onError: () => { toast.error('Failed to queue OCR.'); },
  });
}

// ── Audit Trail ────────────────────────────────────────────────────────────────
export function useEvidenceAuditTrail(evidenceId: string) {
  return useQuery({
    queryKey: evidenceKeys.audit(evidenceId),
    queryFn: () => evidenceApi.getAuditTrail(evidenceId).then((r) => r.data.data ?? []),
    enabled: Boolean(evidenceId),
  });
}

// ── Tag management on specific evidence ────────────────────────────────────────
export function useEvidenceTagMutation(evidenceId: string) {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: (tagId: string) => evidenceApi.addTag(evidenceId, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evidenceKeys.detail(evidenceId) });
      qc.invalidateQueries({ queryKey: evidenceKeys.lists() });
    },
    onError: () => { toast.error('Failed to add tag.'); },
  });
  const remove = useMutation({
    mutationFn: (tagId: string) => evidenceApi.removeTag(evidenceId, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evidenceKeys.detail(evidenceId) });
      qc.invalidateQueries({ queryKey: evidenceKeys.lists() });
    },
    onError: () => { toast.error('Failed to remove tag.'); },
  });
  return { add, remove };
}
