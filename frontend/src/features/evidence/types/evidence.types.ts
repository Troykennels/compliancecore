export type EvidenceStatus = 'active' | 'archived' | 'expired';
export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'not_applicable';
export type UploadStatus = 'pending' | 'completed' | 'failed';
export type LinkedType = 'control' | 'risk' | 'policy' | 'audit' | 'vendor';
export type ShareType = 'link' | 'email';
export type PreviewType = 'pdf' | 'image' | 'text' | 'office' | 'none';

export interface EvidenceCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  isSystem: boolean;
  sortOrder: number;
}

export interface EvidenceTag {
  id: string;
  name: string;
  color: string;
}

export interface EvidenceVersion {
  id: string;
  evidenceId: string;
  versionNumber: number;
  fileName: string;
  fileKey: string;
  fileSizeBytes: number;
  mimeType: string;
  checksumSha256: string | null;
  uploadStatus: UploadStatus;
  changeNote: string | null;
  uploadedBy: string | null;
  uploaderName: string | null;
  uploaderEmail: string | null;
  createdAt: string;
}

export interface Evidence {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  status: EvidenceStatus;
  isConfidential: boolean;
  retentionDate: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  currentVersionId: string | null;
  currentFileName: string | null;
  currentFileSizeBytes: number | null;
  currentMimeType: string | null;
  currentVersionNumber: number | null;
  ocrStatus: OcrStatus;
  tags: EvidenceTag[];
  createdBy: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceAuditEvent {
  id: string;
  evidenceId: string;
  eventType: string;
  actorId: string | null;
  actorEmail: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface EvidenceShare {
  id: string;
  evidenceId: string;
  shareToken: string;
  shareType: ShareType;
  recipientEmail: string | null;
  hasPassword: boolean;
  sharedBy: string | null;
  expiresAt: string | null;
  accessedCount: number;
  lastAccessedAt: string | null;
  isRevoked: boolean;
  createdAt: string;
}

export interface EvidenceListResult {
  evidence: Evidence[];
  total: number;
  page: number;
  limit: number;
}

export interface InitiateUploadResult {
  evidenceId: string;
  versionId: string;
  uploadUrl: string;
  fileKey: string;
  expiresAt: string;
}

export interface PreviewUrlResult {
  url: string | null;
  officePreviewUrl: string | null;
  previewType: PreviewType;
  downloadUrl: string;
}

export interface ShareResult {
  share: EvidenceShare;
  shareUrl: string;
}

export interface EvidenceFilters {
  q?: string;
  categoryId?: string;
  tagIds?: string;
  status?: EvidenceStatus;
  mimeType?: string;
  ocrStatus?: OcrStatus;
  uploadedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'created_at' | 'updated_at' | 'title' | 'file_size';
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface InitiateUploadDto {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  tagIds?: string[];
  isConfidential?: boolean;
  retentionDate?: string | null;
  collectedAt?: string | null;
  collectedBy?: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  changeNote?: string | null;
}

export interface ConfirmUploadDto {
  checksumSha256?: string | null;
  fileSizeBytes?: number;
}

export interface UpdateEvidenceDto {
  title?: string;
  description?: string | null;
  categoryId?: string | null;
  isConfidential?: boolean;
  retentionDate?: string | null;
  collectedAt?: string | null;
  collectedBy?: string | null;
  status?: EvidenceStatus;
}

export interface CreateTagDto {
  name: string;
  color?: string;
}

export interface CreateShareDto {
  shareType?: ShareType;
  recipientEmail?: string | null;
  expiresAt?: string | null;
  password?: string | null;
}
