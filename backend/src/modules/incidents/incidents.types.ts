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

  occurredAt: Date | null;
  detectedAt: Date;
  containedAt: Date | null;
  resolvedAt: Date | null;

  isDataBreach: boolean;
  affectedDataSubjects: number | null;
  regulatorNotifiedAt: Date | null;
  dataSubjectsNotifiedAt: Date | null;
  notificationDeadlineHours: number;

  /** Derived: when the regulator must be told by (detectedAt + deadline). */
  notificationDueAt: Date | null;
  /** Derived: a reportable breach past its deadline with no notification logged. */
  notificationOverdue: boolean;
  /** Derived: hours from detection to resolution, for MTTR reporting. */
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

  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidentUpdate {
  id: string;
  incidentId: string;
  entryType: IncidentEntryType;
  body: string;
  metadata: Record<string, unknown>;
  authorId: string | null;
  authorName: string | null;
  createdAt: Date;
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
