import { withTenantSchema } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { controlsRepository } from '../controls/controls.repository';
import { expiryRepository } from '../expiry/expiry.repository';
import { calendarRepository } from '../calendar/calendar.repository';
import { notificationRepository } from '../notifications/notification.repository';
import { scoreRepository } from '../compliance-score/score.repository';
import { scoreService, buildFrameworkScore } from '../compliance-score/score.service';
import type { ExpiryItem } from '../expiry/expiry.types';
import type { CalendarEvent } from '../calendar/calendar.types';

type Tx = Prisma.TransactionClient;

interface RecentActivityEvent {
  id: string;
  eventType: string;
  actorEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

async function getRecentEvidenceActivity(tx: Tx, limit: number): Promise<RecentActivityEvent[]> {
  const rows = await tx.$queryRaw<Record<string, unknown>[]>`
    SELECT id, event_type AS "eventType", actor_email AS "actorEmail",
           metadata, created_at AS "createdAt"
    FROM evidence_events
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id:         r.id as string,
    eventType:  r.eventType as string,
    actorEmail: r.actorEmail as string | null,
    metadata:   r.metadata as Record<string, unknown>,
    createdAt:  new Date(r.createdAt as string),
  }));
}

export interface DashboardSummary {
  complianceScore: {
    overall: number | null;
    trend: { date: string; score: number | null }[];
    snapshotDate: string | null;
  };
  controls: {
    total: number;
    implemented: number;
    partiallyImplemented: number;
    notImplemented: number;
    notApplicable: number;
    planned: number;
  };
  expiry: {
    active: number;
    expiringSoon: number;
    expired: number;
    urgentItems: ExpiryItem[];   // next 30 days, sorted ascending
  };
  calendar: {
    upcomingCount: number;
    overdueCount: number;
    upcomingEvents: CalendarEvent[];  // next 14 days
  };
  notifications: {
    unread: number;
  };
  recentActivity: RecentActivityEvent[];
}

export const dashboardService = {
  async getSummary(schemaName: string, userId: string): Promise<DashboardSummary> {
    return withTenantSchema(schemaName, async (tx) => {
      const [
        latestSnapshot,
        trend,
        controlStats,
        expiryCounts,
        urgentExpiry,
        upcomingEvents,
        unreadCount,
        recentActivity,
      ] = await Promise.all([
        scoreRepository.getLatestSnapshot(tx),
        scoreRepository.getTrend(tx, 180),
        controlsRepository.getStatusCountsByFramework(tx),
        expiryRepository.countByStatus(tx),
        expiryRepository.findExpiringSoon(tx, 30),
        calendarRepository.findUpcoming(tx, 14),
        notificationRepository.countUnread(tx, userId),
        getRecentEvidenceActivity(tx, 8),
      ]);

      // Aggregate control counts
      const controlCounts = {
        total: 0, implemented: 0, partiallyImplemented: 0,
        notImplemented: 0, notApplicable: 0, planned: 0,
      };
      for (const stat of controlStats) {
        const count = stat.count;
        controlCounts.total += count;
        switch (stat.implementationStatus) {
          case 'implemented':           controlCounts.implemented += count; break;
          case 'partially_implemented': controlCounts.partiallyImplemented += count; break;
          case 'not_implemented':       controlCounts.notImplemented += count; break;
          case 'not_applicable':        controlCounts.notApplicable += count; break;
          case 'planned':               controlCounts.planned += count; break;
        }
      }

      // Count overdue events
      const overdueCount = (await tx.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) FROM compliance_calendar_events
        WHERE deleted_at IS NULL AND status = 'overdue'
      `)[0];

      return {
        complianceScore: {
          // Snapshots are written nightly, so a tenant that onboarded and
          // adopted a framework today has none yet. Falling back to a live
          // calculation means the headline number is right from the first
          // minute instead of blank until the job next runs.
          overall:      latestSnapshot?.overallScore ?? buildFrameworkScore(controlStats, null, 'All Frameworks').score,
          trend,
          snapshotDate: latestSnapshot?.snapshotDate?.toISOString().split('T')[0] ?? null,
        },
        controls: controlCounts,
        expiry: {
          active:       expiryCounts.active,
          expiringSoon: expiryCounts.expiringSoon,
          expired:      expiryCounts.expired,
          urgentItems:  urgentExpiry.slice(0, 5),
        },
        calendar: {
          upcomingCount: upcomingEvents.length,
          overdueCount:  Number(overdueCount.count),
          upcomingEvents: upcomingEvents.slice(0, 6),
        },
        notifications: { unread: unreadCount },
        recentActivity,
      };
    });
  },
};
