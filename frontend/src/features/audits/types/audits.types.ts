export type AuditType = 'internal' | 'external' | 'certification' | 'surveillance';

export type AuditStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'observation';

export type FindingStatus = 'open' | 'in_remediation' | 'resolved' | 'accepted';

export interface Audit {
  id:           string;
  title:        string;
  auditType:    AuditType;
  frameworkRef: string | null;
  status:       AuditStatus;
  auditorName:  string | null;
  scope:        string | null;
  summary:      string | null;
  startDate:    string | null;
  endDate:      string | null;
  ownerId:      string | null;
  ownerName:    string | null;
  ownerEmail:   string | null;
  createdBy:    string | null;
  updatedBy:    string | null;
  createdAt:    string;
  updatedAt:    string;
}

export interface AuditFinding {
  id:             string;
  auditId:        string;
  title:          string;
  description:    string | null;
  severity:       FindingSeverity;
  status:         FindingStatus;
  recommendation: string | null;
  ownerId:        string | null;
  ownerName:      string | null;
  ownerEmail:     string | null;
  dueDate:        string | null;
  createdBy:      string | null;
  createdAt:      string;
  updatedAt:      string;
}

export interface CreateAuditInput {
  title:         string;
  auditType?:    AuditType;
  frameworkRef?: string | null;
  status?:       AuditStatus;
  auditorName?:  string | null;
  scope?:        string | null;
  summary?:      string | null;
  startDate?:    string | null;
  endDate?:      string | null;
  ownerId?:      string | null;
}

export type UpdateAuditInput = Partial<CreateAuditInput>;

export interface CreateFindingInput {
  title:           string;
  description?:    string | null;
  severity?:       FindingSeverity;
  status?:         FindingStatus;
  recommendation?: string | null;
  ownerId?:        string | null;
  dueDate?:        string | null;
}

export type UpdateFindingInput = Partial<CreateFindingInput>;

export interface AuditFilters {
  page?:      number;
  limit?:     number;
  status?:    AuditStatus;
  auditType?: AuditType;
  ownerId?:   string;
  q?:         string;
  sortBy?:    string;
  sortDir?:   'asc' | 'desc';
}

export interface AuditListResult {
  audits: Audit[];
  total:  number;
  page:   number;
  limit:  number;
}

export const AUDIT_TYPE_CONFIG: Record<AuditType, { label: string; color: string; bgColor: string }> = {
  internal:     { label: 'Internal',     color: 'text-blue-700',    bgColor: 'bg-blue-100' },
  external:     { label: 'External',     color: 'text-purple-700',  bgColor: 'bg-purple-100' },
  certification:{ label: 'Certification',color: 'text-green-700',   bgColor: 'bg-green-100' },
  surveillance: { label: 'Surveillance', color: 'text-amber-700',   bgColor: 'bg-amber-100' },
};

export const AUDIT_STATUS_CONFIG: Record<AuditStatus, { label: string; color: string; bgColor: string }> = {
  planned:     { label: 'Planned',     color: 'text-slate-600', bgColor: 'bg-slate-100' },
  in_progress: { label: 'In Progress', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  completed:   { label: 'Completed',   color: 'text-green-700', bgColor: 'bg-green-100' },
  cancelled:   { label: 'Cancelled',   color: 'text-red-700',   bgColor: 'bg-red-100' },
};

export const FINDING_SEVERITY_CONFIG: Record<FindingSeverity, { label: string; color: string; bgColor: string }> = {
  critical:    { label: 'Critical',    color: 'text-red-700',    bgColor: 'bg-red-100' },
  high:        { label: 'High',        color: 'text-orange-700', bgColor: 'bg-orange-100' },
  medium:      { label: 'Medium',      color: 'text-blue-700',   bgColor: 'bg-blue-100' },
  low:         { label: 'Low',         color: 'text-slate-600',  bgColor: 'bg-slate-100' },
  observation: { label: 'Observation', color: 'text-slate-500',  bgColor: 'bg-slate-100' },
};

export const FINDING_STATUS_CONFIG: Record<FindingStatus, { label: string; color: string; bgColor: string }> = {
  open:           { label: 'Open',            color: 'text-red-700',    bgColor: 'bg-red-100' },
  in_remediation: { label: 'In Remediation',  color: 'text-amber-700',  bgColor: 'bg-amber-100' },
  resolved:       { label: 'Resolved',        color: 'text-green-700',  bgColor: 'bg-green-100' },
  accepted:       { label: 'Accepted',        color: 'text-slate-600',  bgColor: 'bg-slate-100' },
};
