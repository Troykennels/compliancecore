export interface ReportFilter {
  days?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface ComplianceKpis {
  overallScore: number;
  totalControls: number;
  implementedControls: number;
  partiallyImplementedControls: number;
  notImplementedControls: number;
  plannedControls: number;
  openTasks: number;
  overdueTasks: number;
  totalEvidence: number;
  activeEvidence: number;
  expiringIn30Days: number;
  expiredItems: number;
  pendingApprovals: number;
}

export interface ScoreTrendPoint {
  date: string;
  score: number;
}

export interface ControlsBreakdown {
  implemented: number;
  partiallyImplemented: number;
  notImplemented: number;
  planned: number;
  notApplicable: number;
}

export interface ControlsByCriticality {
  criticality: 'critical' | 'high' | 'medium' | 'low';
  total: number;
  implemented: number;
  notImplemented: number;
}

export interface FrameworkCoverage {
  frameworkId: string;
  frameworkName: string;
  frameworkCode: string;
  totalControls: number;
  implementedControls: number;
  coveragePercent: number;
}

export interface TasksBreakdown {
  todo: number;
  in_progress: number;
  in_review: number;
  completed: number;
  cancelled: number;
  blocked: number;
  overdue: number;
}

export interface EvidenceBreakdown {
  active: number;
  archived: number;
  expired: number;
  byCategory: Array<{ category: string; count: number }>;
}

export interface UpcomingExpiryItem {
  id: string;
  name: string;
  entityType: string;
  expiryDate: string;
  status: string;
  ownerName: string | null;
}

export interface ExpiryOverview {
  expired: number;
  expiringSoon30: number;
  expiringSoon60: number;
  expiringSoon90: number;
  active: number;
  upcoming: UpcomingExpiryItem[];
}

export interface ExecutiveDashboard {
  generatedAt: string;
  filter: ReportFilter;
  kpis: ComplianceKpis;
  scoreTrend: ScoreTrendPoint[];
  controlsBreakdown: ControlsBreakdown;
  controlsByCriticality: ControlsByCriticality[];
  frameworkCoverage: FrameworkCoverage[];
  tasksBreakdown: TasksBreakdown;
  evidenceBreakdown: EvidenceBreakdown;
  expiryOverview: ExpiryOverview;
}

// ── Scheduled Reports ──────────────────────────────────────────────────────────

export type ReportFrequency = 'daily' | 'weekly' | 'monthly';
export type ReportFormat   = 'pdf' | 'excel' | 'both';

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: ReportFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number;
  recipients: string[];
  format: ReportFormat;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failed' | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledReportDto {
  name: string;
  frequency: ReportFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour?: number;
  recipients: string[];
  format?: ReportFormat;
}

export interface UpdateScheduledReportDto {
  name?: string;
  frequency?: ReportFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  hour?: number;
  recipients?: string[];
  format?: ReportFormat;
  isActive?: boolean;
}
