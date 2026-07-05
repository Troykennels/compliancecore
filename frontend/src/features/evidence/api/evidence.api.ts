import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  Evidence, EvidenceListResult, EvidenceCategory, EvidenceTag, EvidenceVersion,
  EvidenceAuditEvent, EvidenceShare, InitiateUploadResult, PreviewUrlResult,
  ShareResult, EvidenceFilters, InitiateUploadDto, ConfirmUploadDto,
  UpdateEvidenceDto, CreateTagDto, CreateShareDto,
} from '../types/evidence.types';

export const evidenceApi = {
  // ── Categories ──────────────────────────────────────────────────────────────
  listCategories() {
    return apiClient.get<ApiResponse<EvidenceCategory[]>>('/evidence/categories');
  },
  createCategory(dto: { name: string; description?: string; color?: string; icon?: string }) {
    return apiClient.post<ApiResponse<EvidenceCategory>>('/evidence/categories', dto);
  },
  updateCategory(id: string, dto: Partial<{ name: string; description: string; color: string; icon: string }>) {
    return apiClient.patch<ApiResponse<EvidenceCategory>>(`/evidence/categories/${id}`, dto);
  },
  deleteCategory(id: string) {
    return apiClient.delete(`/evidence/categories/${id}`);
  },

  // ── Tags ────────────────────────────────────────────────────────────────────
  listTags() {
    return apiClient.get<ApiResponse<EvidenceTag[]>>('/evidence/tags');
  },
  createTag(dto: CreateTagDto) {
    return apiClient.post<ApiResponse<EvidenceTag>>('/evidence/tags', dto);
  },
  deleteTag(id: string) {
    return apiClient.delete(`/evidence/tags/${id}`);
  },

  // ── Evidence List ───────────────────────────────────────────────────────────
  list(filters: EvidenceFilters = {}) {
    return apiClient.get<ApiResponse<EvidenceListResult>>('/evidence', { params: filters });
  },

  // ── Upload Flow ─────────────────────────────────────────────────────────────
  initiateUpload(dto: InitiateUploadDto) {
    return apiClient.post<ApiResponse<InitiateUploadResult>>('/evidence/upload', dto);
  },
  confirmUpload(evidenceId: string, versionId: string, dto: ConfirmUploadDto) {
    return apiClient.post<ApiResponse<{ evidence: Evidence; version: EvidenceVersion }>>(
      `/evidence/${evidenceId}/versions/${versionId}/confirm`, dto,
    );
  },

  // ── CRUD ────────────────────────────────────────────────────────────────────
  getById(id: string) {
    return apiClient.get<ApiResponse<Evidence>>(`/evidence/${id}`);
  },
  update(id: string, dto: UpdateEvidenceDto) {
    return apiClient.patch<ApiResponse<Evidence>>(`/evidence/${id}`, dto);
  },
  delete(id: string) {
    return apiClient.delete(`/evidence/${id}`);
  },

  // ── Versions ────────────────────────────────────────────────────────────────
  listVersions(evidenceId: string) {
    return apiClient.get<ApiResponse<EvidenceVersion[]>>(`/evidence/${evidenceId}/versions`);
  },
  initiateVersionUpload(evidenceId: string, dto: { fileName: string; fileSize: number; mimeType: string; changeNote?: string }) {
    return apiClient.post<ApiResponse<InitiateUploadResult>>(`/evidence/${evidenceId}/versions`, dto);
  },
  getVersionDownloadUrl(evidenceId: string, versionId: string) {
    return apiClient.get<ApiResponse<{ downloadUrl: string }>>(
      `/evidence/${evidenceId}/versions/${versionId}/download`,
    );
  },

  // ── Preview & Download ──────────────────────────────────────────────────────
  getPreviewUrl(evidenceId: string) {
    return apiClient.get<ApiResponse<PreviewUrlResult>>(`/evidence/${evidenceId}/preview`);
  },
  getDownloadUrl(evidenceId: string) {
    return apiClient.get<ApiResponse<{ downloadUrl: string }>>(`/evidence/${evidenceId}/download`);
  },

  // ── Tags on Evidence ────────────────────────────────────────────────────────
  addTag(evidenceId: string, tagId: string) {
    return apiClient.post(`/evidence/${evidenceId}/tags`, { tagId });
  },
  removeTag(evidenceId: string, tagId: string) {
    return apiClient.delete(`/evidence/${evidenceId}/tags/${tagId}`);
  },

  // ── Links ───────────────────────────────────────────────────────────────────
  addLink(evidenceId: string, dto: { linkedType: string; linkedId: string }) {
    return apiClient.post(`/evidence/${evidenceId}/links`, dto);
  },
  removeLink(evidenceId: string, linkedType: string, linkedId: string) {
    return apiClient.delete(`/evidence/${evidenceId}/links/${linkedType}/${linkedId}`);
  },

  // ── Sharing ─────────────────────────────────────────────────────────────────
  listShares(evidenceId: string) {
    return apiClient.get<ApiResponse<EvidenceShare[]>>(`/evidence/${evidenceId}/shares`);
  },
  createShare(evidenceId: string, dto: CreateShareDto) {
    return apiClient.post<ApiResponse<ShareResult>>(`/evidence/${evidenceId}/shares`, dto);
  },
  revokeShare(evidenceId: string, shareId: string) {
    return apiClient.delete(`/evidence/${evidenceId}/shares/${shareId}`);
  },

  // Public shared access (no auth)
  accessSharedEvidence(token: string, tenantId: string, password?: string) {
    return apiClient.post<ApiResponse<{ share: EvidenceShare; evidence: Evidence; currentVersion: EvidenceVersion | null; downloadUrl: string | null }>>(
      `/evidence/shared/${token}?tenant=tenant_${tenantId.replace(/-/g, '')}`,
      { password },
    );
  },

  // ── OCR ─────────────────────────────────────────────────────────────────────
  getOcrText(evidenceId: string) {
    return apiClient.get<ApiResponse<{ ocrText: string | null; ocrStatus: string }>>(
      `/evidence/${evidenceId}/ocr`,
    );
  },
  retryOcr(evidenceId: string) {
    return apiClient.post<ApiResponse<{ message: string }>>(`/evidence/${evidenceId}/ocr/retry`);
  },

  // ── Audit Trail ─────────────────────────────────────────────────────────────
  getAuditTrail(evidenceId: string, limit?: number) {
    return apiClient.get<ApiResponse<EvidenceAuditEvent[]>>(
      `/evidence/${evidenceId}/audit`, { params: limit ? { limit } : undefined },
    );
  },
};
