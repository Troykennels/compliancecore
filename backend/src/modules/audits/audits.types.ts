export type AuditType = 'internal' | 'external' | 'certification' | 'surveillance';
export type AuditStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'observation';
export type FindingStatus = 'open' | 'in_remediation' | 'resolved' | 'accepted';

export interface Audit {
  id: string;
  title: string;
  auditType: AuditType;
  frameworkRef: string | null;
  status: AuditStatus;
  auditorName: string | null;
  scope: string | null;
  summary: string | null;
  startDate: Date | null;
  endDate: Date | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditListResult {
  audits: Audit[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditFinding {
  id: string;
  auditId: string;
  title: string;
  description: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  recommendation: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  dueDate: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  observation: 1,
};
