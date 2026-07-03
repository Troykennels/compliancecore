import { withTenantSchema } from '../../lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import type {
  ComplianceKpis, ScoreTrendPoint, ControlsBreakdown, ControlsByCriticality,
  FrameworkCoverage, TasksBreakdown, EvidenceBreakdown, ExpiryOverview,
  ScheduledReport, CreateScheduledReportDto, UpdateScheduledReportDto,
} from './reports.types';

// ── Dashboard data ─────────────────────────────────────────────────────────────

export async function getKpis(schemaName: string): Promise<ComplianceKpis> {
  return withTenantSchema(schemaName, async (p) => {
    const [cRow] = await p.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(*)::int                                                                              AS total,
        SUM(CASE WHEN implementation_status = 'implemented'            THEN 1 ELSE 0 END)::int    AS implemented,
        SUM(CASE WHEN implementation_status = 'partially_implemented'  THEN 1 ELSE 0 END)::int    AS partial,
        SUM(CASE WHEN implementation_status = 'not_implemented'        THEN 1 ELSE 0 END)::int    AS not_impl,
        SUM(CASE WHEN implementation_status = 'planned'                THEN 1 ELSE 0 END)::int    AS planned
      FROM controls WHERE deleted_at IS NULL
    `);

    const [tRow] = await p.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(CASE WHEN status NOT IN ('completed','cancelled') THEN 1 END)::int            AS open_tasks,
        COUNT(CASE WHEN status NOT IN ('completed','cancelled') AND due_date < NOW() THEN 1 END)::int AS overdue
      FROM tasks WHERE deleted_at IS NULL
    `);

    const [eRow] = await p.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(*)::int                                            AS total,
        SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END)::int AS active
      FROM evidence WHERE deleted_at IS NULL
    `);

    const [xRow] = await p.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(CASE WHEN status = 'expired'                                          THEN 1 END)::int AS expired,
        COUNT(CASE WHEN expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
                    AND status NOT IN ('expired','cancelled','renewed')             THEN 1 END)::int AS expiring_30
      FROM expiry_items WHERE deleted_at IS NULL
    `);

    const [sRow] = await p.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(overall_score, 0) AS score
      FROM compliance_score_snapshots ORDER BY snapshot_date DESC LIMIT 1
    `).catch(() => [{ score: 0 }]);

    const [aRow] = await p.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::int AS pending FROM approval_requests
      WHERE status = 'pending' AND deleted_at IS NULL
    `).catch(() => [{ pending: 0 }]);

    return {
      overallScore:                  Number(sRow?.score ?? 0),
      totalControls:                 cRow?.total ?? 0,
      implementedControls:           cRow?.implemented ?? 0,
      partiallyImplementedControls:  cRow?.partial ?? 0,
      notImplementedControls:        cRow?.not_impl ?? 0,
      plannedControls:               cRow?.planned ?? 0,
      openTasks:                     tRow?.open_tasks ?? 0,
      overdueTasks:                  tRow?.overdue ?? 0,
      totalEvidence:                 eRow?.total ?? 0,
      activeEvidence:                eRow?.active ?? 0,
      expiringIn30Days:              xRow?.expiring_30 ?? 0,
      expiredItems:                  xRow?.expired ?? 0,
      pendingApprovals:              aRow?.pending ?? 0,
    };
  });
}

export async function getScoreTrend(
  schemaName: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<ScoreTrendPoint[]> {
  return withTenantSchema(schemaName, async (p) => {
    const rows = await p.$queryRawUnsafe<any[]>(`
      SELECT TO_CHAR(snapshot_date, 'YYYY-MM-DD') AS date,
             ROUND(overall_score::numeric, 1)      AS score
      FROM compliance_score_snapshots
      WHERE snapshot_date BETWEEN $1 AND $2
      ORDER BY snapshot_date ASC
    `, dateFrom.toISOString(), dateTo.toISOString());
    return rows.map((r) => ({ date: r.date, score: Number(r.score ?? 0) }));
  });
}

export async function getControlsBreakdown(schemaName: string): Promise<ControlsBreakdown> {
  return withTenantSchema(schemaName, async (p) => {
    const [r] = await p.$queryRawUnsafe<any[]>(`
      SELECT
        SUM(CASE WHEN implementation_status = 'implemented'           THEN 1 ELSE 0 END)::int AS implemented,
        SUM(CASE WHEN implementation_status = 'partially_implemented' THEN 1 ELSE 0 END)::int AS partially_implemented,
        SUM(CASE WHEN implementation_status = 'not_implemented'       THEN 1 ELSE 0 END)::int AS not_implemented,
        SUM(CASE WHEN implementation_status = 'planned'               THEN 1 ELSE 0 END)::int AS planned,
        SUM(CASE WHEN implementation_status = 'not_applicable'        THEN 1 ELSE 0 END)::int AS not_applicable
      FROM controls WHERE deleted_at IS NULL
    `);
    return {
      implemented:          r?.implemented ?? 0,
      partiallyImplemented: r?.partially_implemented ?? 0,
      notImplemented:       r?.not_implemented ?? 0,
      planned:              r?.planned ?? 0,
      notApplicable:        r?.not_applicable ?? 0,
    };
  });
}

export async function getControlsByCriticality(schemaName: string): Promise<ControlsByCriticality[]> {
  return withTenantSchema(schemaName, async (p) => {
    const rows = await p.$queryRawUnsafe<any[]>(`
      SELECT
        criticality,
        COUNT(*)::int                                                                       AS total,
        SUM(CASE WHEN implementation_status = 'implemented'    THEN 1 ELSE 0 END)::int    AS implemented,
        SUM(CASE WHEN implementation_status = 'not_implemented' THEN 1 ELSE 0 END)::int   AS not_implemented
      FROM controls WHERE deleted_at IS NULL
      GROUP BY criticality
      ORDER BY CASE criticality WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
    `);
    return rows.map((r) => ({
      criticality:     r.criticality,
      total:           r.total ?? 0,
      implemented:     r.implemented ?? 0,
      notImplemented:  r.not_implemented ?? 0,
    }));
  });
}

export async function getFrameworkCoverage(schemaName: string): Promise<FrameworkCoverage[]> {
  return withTenantSchema(schemaName, async (p) => {
    const rows = await p.$queryRawUnsafe<any[]>(`
      SELECT
        f.id                                                                                AS framework_id,
        f.name                                                                              AS framework_name,
        COALESCE(f.short_name, f.code, f.name)                                             AS framework_code,
        COUNT(c.id)::int                                                                    AS total_controls,
        SUM(CASE WHEN c.implementation_status = 'implemented' THEN 1 ELSE 0 END)::int      AS implemented_controls,
        CASE WHEN COUNT(c.id) = 0 THEN 0
             ELSE ROUND(
               SUM(CASE WHEN c.implementation_status = 'implemented' THEN 1 ELSE 0 END)::numeric
               / COUNT(c.id) * 100, 1)
        END                                                                                 AS coverage_percent
      FROM frameworks f
      LEFT JOIN controls c ON c.framework_id = f.id AND c.deleted_at IS NULL
      WHERE f.deleted_at IS NULL
      GROUP BY f.id, f.name, f.short_name, f.code
      ORDER BY coverage_percent DESC
      LIMIT 10
    `).catch(() => [] as any[]);
    return rows.map((r) => ({
      frameworkId:         r.framework_id,
      frameworkName:       r.framework_name,
      frameworkCode:       r.framework_code ?? r.framework_name,
      totalControls:       r.total_controls ?? 0,
      implementedControls: r.implemented_controls ?? 0,
      coveragePercent:     Number(r.coverage_percent ?? 0),
    }));
  });
}

export async function getTasksBreakdown(schemaName: string): Promise<TasksBreakdown> {
  return withTenantSchema(schemaName, async (p) => {
    const [r] = await p.$queryRawUnsafe<any[]>(`
      SELECT
        SUM(CASE WHEN status = 'todo'        THEN 1 ELSE 0 END)::int AS todo,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END)::int AS in_progress,
        SUM(CASE WHEN status = 'in_review'   THEN 1 ELSE 0 END)::int AS in_review,
        SUM(CASE WHEN status = 'completed'   THEN 1 ELSE 0 END)::int AS completed,
        SUM(CASE WHEN status = 'cancelled'   THEN 1 ELSE 0 END)::int AS cancelled,
        SUM(CASE WHEN status = 'blocked'     THEN 1 ELSE 0 END)::int AS blocked,
        SUM(CASE WHEN status NOT IN ('completed','cancelled') AND due_date < NOW() THEN 1 ELSE 0 END)::int AS overdue
      FROM tasks WHERE deleted_at IS NULL
    `);
    return {
      todo:        r?.todo ?? 0,
      in_progress: r?.in_progress ?? 0,
      in_review:   r?.in_review ?? 0,
      completed:   r?.completed ?? 0,
      cancelled:   r?.cancelled ?? 0,
      blocked:     r?.blocked ?? 0,
      overdue:     r?.overdue ?? 0,
    };
  });
}

export async function getEvidenceBreakdown(schemaName: string): Promise<EvidenceBreakdown> {
  return withTenantSchema(schemaName, async (p) => {
    const [r] = await p.$queryRawUnsafe<any[]>(`
      SELECT
        SUM(CASE WHEN e.status = 'active'   THEN 1 ELSE 0 END)::int AS active,
        SUM(CASE WHEN e.status = 'archived' THEN 1 ELSE 0 END)::int AS archived,
        SUM(CASE WHEN e.status = 'expired'  THEN 1 ELSE 0 END)::int AS expired
      FROM evidence e WHERE e.deleted_at IS NULL
    `);
    const cats = await p.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(ec.name, 'Uncategorised') AS category, COUNT(e.id)::int AS count
      FROM evidence e
      LEFT JOIN evidence_categories ec ON ec.id = e.category_id AND ec.deleted_at IS NULL
      WHERE e.deleted_at IS NULL
      GROUP BY ec.name ORDER BY count DESC LIMIT 8
    `).catch(() => [] as any[]);
    return {
      active:      r?.active ?? 0,
      archived:    r?.archived ?? 0,
      expired:     r?.expired ?? 0,
      byCategory:  cats.map((c) => ({ category: c.category, count: c.count })),
    };
  });
}

export async function getExpiryOverview(schemaName: string): Promise<ExpiryOverview> {
  return withTenantSchema(schemaName, async (p) => {
    const [r] = await p.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(CASE WHEN status = 'expired'                                                     THEN 1 END)::int AS expired,
        COUNT(CASE WHEN expiry_date BETWEEN NOW() AND NOW() + INTERVAL  '30 days'
                    AND status NOT IN ('expired','cancelled','renewed')                        THEN 1 END)::int AS s30,
        COUNT(CASE WHEN expiry_date BETWEEN NOW() AND NOW() + INTERVAL  '60 days'
                    AND status NOT IN ('expired','cancelled','renewed')                        THEN 1 END)::int AS s60,
        COUNT(CASE WHEN expiry_date BETWEEN NOW() AND NOW() + INTERVAL  '90 days'
                    AND status NOT IN ('expired','cancelled','renewed')                        THEN 1 END)::int AS s90,
        COUNT(CASE WHEN status = 'active'                                                     THEN 1 END)::int AS active
      FROM expiry_items WHERE deleted_at IS NULL
    `);
    const upcoming = await p.$queryRawUnsafe<any[]>(`
      SELECT
        ei.id, ei.name, ei.entity_type,
        TO_CHAR(ei.expiry_date, 'YYYY-MM-DD') AS expiry_date,
        ei.status,
        CASE WHEN u.first_name IS NOT NULL THEN u.first_name || ' ' || u.last_name ELSE NULL END AS owner_name
      FROM expiry_items ei
      LEFT JOIN global.users u ON u.id = ei.owner_id
      WHERE ei.deleted_at IS NULL
        AND ei.expiry_date >= CURRENT_DATE
        AND ei.status NOT IN ('cancelled','renewed')
      ORDER BY ei.expiry_date ASC
      LIMIT 10
    `);
    return {
      expired:        r?.expired ?? 0,
      expiringSoon30: r?.s30 ?? 0,
      expiringSoon60: r?.s60 ?? 0,
      expiringSoon90: r?.s90 ?? 0,
      active:         r?.active ?? 0,
      upcoming: upcoming.map((u) => ({
        id:          u.id,
        name:        u.name,
        entityType:  u.entity_type,
        expiryDate:  u.expiry_date,
        status:      u.status,
        ownerName:   u.owner_name ?? null,
      })),
    };
  });
}

// ── Scheduled Reports CRUD ────────────────────────────────────────────────────

async function ensureTable(schemaName: string): Promise<void> {
  await withTenantSchema(schemaName, async (p) => {
    await p.$queryRawUnsafe(`
      CREATE TABLE IF NOT EXISTS scheduled_reports (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(255) NOT NULL,
        frequency       VARCHAR(20)  NOT NULL,
        day_of_week     INTEGER,
        day_of_month    INTEGER,
        hour            INTEGER      NOT NULL DEFAULT 6,
        recipients      TEXT[]       NOT NULL DEFAULT '{}',
        format          VARCHAR(10)  NOT NULL DEFAULT 'pdf',
        is_active       BOOLEAN      NOT NULL DEFAULT true,
        next_run_at     TIMESTAMPTZ,
        last_run_at     TIMESTAMPTZ,
        last_run_status VARCHAR(20),
        created_by      UUID,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
  });
}

function computeNextRun(
  frequency: string,
  hour: number,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
): Date {
  const now = new Date();
  const next = new Date(now);

  if (frequency === 'daily') {
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    const dow = dayOfWeek ?? 1;
    next.setHours(hour, 0, 0, 0);
    const diff = (dow - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + (diff === 0 && next <= now ? 7 : diff));
  } else {
    const dom = dayOfMonth ?? 1;
    next.setHours(hour, 0, 0, 0);
    next.setDate(dom);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(dom);
    }
  }

  return next;
}

function mapRow(r: any): ScheduledReport {
  return {
    id:             r.id,
    name:           r.name,
    frequency:      r.frequency,
    dayOfWeek:      r.day_of_week ?? null,
    dayOfMonth:     r.day_of_month ?? null,
    hour:           r.hour ?? 6,
    recipients:     Array.isArray(r.recipients) ? r.recipients : [],
    format:         r.format,
    isActive:       r.is_active,
    nextRunAt:      r.next_run_at ? new Date(r.next_run_at).toISOString() : null,
    lastRunAt:      r.last_run_at ? new Date(r.last_run_at).toISOString() : null,
    lastRunStatus:  r.last_run_status ?? null,
    createdAt:      new Date(r.created_at).toISOString(),
    updatedAt:      new Date(r.updated_at).toISOString(),
  };
}

export async function findScheduledReports(schemaName: string): Promise<ScheduledReport[]> {
  await ensureTable(schemaName);
  return withTenantSchema(schemaName, async (p) => {
    const rows = await p.$queryRawUnsafe<any[]>(
      `SELECT * FROM scheduled_reports ORDER BY created_at DESC`,
    );
    return rows.map(mapRow);
  });
}

export async function createScheduledReport(
  schemaName: string,
  dto: CreateScheduledReportDto,
  createdBy: string,
): Promise<ScheduledReport> {
  await ensureTable(schemaName);
  const id = uuidv4();
  const hour = dto.hour ?? 6;
  const freq = dto.frequency;
  const dow = dto.dayOfWeek ?? null;
  const dom = dto.dayOfMonth ?? null;
  const nextRun = computeNextRun(freq, hour, dow, dom);
  const format = dto.format ?? 'pdf';

  return withTenantSchema(schemaName, async (p) => {
    const [row] = await p.$queryRawUnsafe<any[]>(`
      INSERT INTO scheduled_reports
        (id, name, frequency, day_of_week, day_of_month, hour, recipients, format, is_active, next_run_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8,true,$9,$10)
      RETURNING *
    `, id, dto.name, freq, dow, dom, hour,
      `{${dto.recipients.map((r) => `"${r}"`).join(',')}}`,
      format, nextRun.toISOString(), createdBy);
    return mapRow(row);
  });
}

export async function updateScheduledReport(
  schemaName: string,
  id: string,
  dto: UpdateScheduledReportDto,
): Promise<ScheduledReport> {
  await ensureTable(schemaName);
  return withTenantSchema(schemaName, async (p) => {
    const [current] = await p.$queryRawUnsafe<any[]>(
      `SELECT * FROM scheduled_reports WHERE id = $1`, id,
    );
    if (!current) throw Object.assign(new Error('Scheduled report not found'), { statusCode: 404 });

    const freq      = dto.frequency  ?? current.frequency;
    const hour      = dto.hour       ?? current.hour;
    const dow       = 'dayOfWeek'   in dto ? dto.dayOfWeek   : current.day_of_week;
    const dom       = 'dayOfMonth'  in dto ? dto.dayOfMonth  : current.day_of_month;
    const isActive  = 'isActive'    in dto ? dto.isActive    : current.is_active;
    const name      = dto.name       ?? current.name;
    const format    = dto.format     ?? current.format;
    const recips    = dto.recipients ?? (Array.isArray(current.recipients) ? current.recipients : []);
    const nextRun   = computeNextRun(freq, hour, dow ?? null, dom ?? null);

    const [row] = await p.$queryRawUnsafe<any[]>(`
      UPDATE scheduled_reports SET
        name = $2, frequency = $3, day_of_week = $4, day_of_month = $5, hour = $6,
        recipients = $7::text[], format = $8, is_active = $9, next_run_at = $10, updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, id, name, freq, dow ?? null, dom ?? null, hour,
      `{${recips.map((r: string) => `"${r}"`).join(',')}}`,
      format, isActive, nextRun.toISOString());
    return mapRow(row);
  });
}

export async function deleteScheduledReport(schemaName: string, id: string): Promise<void> {
  await ensureTable(schemaName);
  await withTenantSchema(schemaName, async (p) => {
    await p.$queryRawUnsafe(`DELETE FROM scheduled_reports WHERE id = $1`, id);
  });
}
