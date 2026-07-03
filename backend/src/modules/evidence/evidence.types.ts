export type EvidenceStatus = 'active' | 'archived' | 'expired';
export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'not_applicable';
export type UploadStatus = 'pending' | 'completed' | 'failed';
export type LinkedType = 'control' | 'risk' | 'policy' | 'audit' | 'vendor';
export type ShareType = 'link' | 'email';

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
  createdAt: Date;
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
  retentionDate: Date | null;
  collectedAt: Date | null;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface EvidenceAuditEvent {
  id: string;
  evidenceId: string;
  eventType: string;
  actorId: string | null;
  actorEmail: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Date;
}

export interface EvidenceShare {
  id: string;
  evidenceId: string;
  shareToken: string;
  shareType: ShareType;
  recipientEmail: string | null;
  hasPassword: boolean;
  sharedBy: string | null;
  expiresAt: Date | null;
  accessedCount: number;
  lastAccessedAt: Date | null;
  isRevoked: boolean;
  createdAt: Date;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface InitiateUploadResult {
  evidenceId: string;
  versionId: string;
  uploadUrl: string;
  fileKey: string;
  expiresAt: Date;
}

export interface ConfirmUploadResult {
  evidence: Evidence;
  version: EvidenceVersion;
}

export interface EvidenceListResult {
  evidence: Evidence[];
  total: number;
  page: number;
  limit: number;
}

export interface PreviewUrlResult {
  url: string | null;            // presigned GET URL or null for office docs
  officePreviewUrl: string | null; // Microsoft Office Online URL for DOCX/XLSX etc.
  previewType: 'pdf' | 'image' | 'text' | 'office' | 'none';
  downloadUrl: string;
}

export interface ShareResult {
  share: EvidenceShare;
  shareUrl: string;
}
