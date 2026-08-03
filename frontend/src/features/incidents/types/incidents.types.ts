export type IncidentCategory =
  | 'security' | 'privacy' | 'availability' | 'integrity'
  | 'third_party' | 'physical' | 'fraud' | 'other';

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus   = 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';

export type IncidentEntryType =
  | 'note' | 'status_change' | 'severity_change' | 'containment'
  | 'notification' | 'assignment' | 'evidence';

export interface Incident {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;

  occurredAt: string | null;
  detectedAt: string;
  containedAt: string | null;
  resolvedAt: string | null;

  isDataBreach: boolean;
  affectedDataSubjects: number | null;
  regulatorNotifiedAt: string | null;
  dataSubjectsNotifiedAt: string | null;
  notificationDeadlineHours: number;

  notificationDueAt: string | null;
  notificationOverdue: boolean;
  timeToResolveHours: number | null;

  reportedBy: string | null;
  reportedByName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;

  rootCause: string | null;
  remediation: string | null;
  lessonsLearned: string | null;
  affectedSystems: string[];
  tags: string[];

  createdAt: string;
  updatedAt: string;
}

export interface IncidentUpdate {
  id: string;
  incidentId: string;
  entryType: IncidentEntryType;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface IncidentListResult {
  incidents: Incident[];
  total: number;
  page: number;
  limit: number;
}

export interface IncidentStats {
  total: number;
  open: number;
  investigating: number;
  contained: number;
  resolved: number;
  closed: number;
  critical: number;
  high: number;
  dataBreaches: number;
  overdueNotifications: number;
  meanTimeToResolveHours: number | null;
}

export interface IncidentFilters {
  page?: number;
  limit?: number;
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  category?: IncidentCategory;
  isDataBreach?: boolean;
  overdueNotification?: boolean;
  q?: string;
  sortBy?: 'detected_at' | 'severity' | 'status' | 'reference' | 'updated_at';
  sortDir?: 'asc' | 'desc';
}

export interface CreateIncidentInput {
  title: string;
  description?: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status?: IncidentStatus;
  occurredAt?: string | null;
  detectedAt?: string;
  isDataBreach?: boolean;
  affectedDataSubjects?: number | null;
  notificationDeadlineHours?: number;
  affectedSystems?: string[];
}

export type UpdateIncidentInput = Partial<CreateIncidentInput> & {
  containedAt?: string | null;
  resolvedAt?: string | null;
  regulatorNotifiedAt?: string | null;
  dataSubjectsNotifiedAt?: string | null;
  rootCause?: string | null;
  remediation?: string | null;
  lessonsLearned?: string | null;
};
