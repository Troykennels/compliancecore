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
  daysUntil: number;
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

export interface RecentActivityEvent {
  id: string;
  eventType: string;
  description: string;
  actorName: string | null;
  evidenceTitle: string | null;
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
