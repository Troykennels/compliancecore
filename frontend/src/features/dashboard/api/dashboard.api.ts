import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';

export interface ControlCounts {
  total: number;
  implemented: number;
  partiallyImplemented: number;
  notImplemented: number;
  notApplicable: number;
  planned: number;
}

export interface ExpiryUrgentItem {
  id: string;
  name: string;
  entityType: string;
  expiryDate: string;
  status: string;
  // Named to match what the API actually sends. It was `daysUntil` here, which
  // no endpoint has ever returned, so the dashboard rendered "undefined left"
  // and every urgency band silently failed to fire.
  daysUntilExpiry: number;
}

export interface ExpirySummary {
  active: number;
  expiringSoon: number;
  expired: number;
  urgentItems: ExpiryUrgentItem[];
}

export interface CalendarUpcomingEvent {
  id: string;
  title: string;
  eventType: string;
  startDate: string;
  priority: string;
  color: string;
  status: string;
}

export interface CalendarSummary {
  upcomingCount: number;
  overdueCount: number;
  upcomingEvents: CalendarUpcomingEvent[];
}

// Mirrors getRecentEvidenceActivity in backend/src/modules/dashboard.
// This previously declared `description`, `actorName` and `evidenceTitle` —
// none of which the endpoint sends — so every row of the dashboard's audit
// trail rendered as a bare "System" with no text.
export interface RecentActivityEvent {
  id: string;
  eventType: string;
  actorEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardSummary {
  complianceScore: {
    overall: number | null;
    trend: { date: string; score: number | null }[];
    snapshotDate: string | null;
  };
  controls: ControlCounts;
  expiry: ExpirySummary;
  calendar: CalendarSummary;
  notifications: { unread: number };
  recentActivity: RecentActivityEvent[];
}

export const dashboardApi = {
  getSummary() {
    return apiClient.get<ApiResponse<DashboardSummary>>('/dashboard');
  },
};
