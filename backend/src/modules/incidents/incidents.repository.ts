import { Prisma } from '@prisma/client';
import type {
  Incident, IncidentListResult, IncidentUpdate, IncidentStats,
} from './incidents.types';
import type {
  CreateIncidentInput, UpdateIncidentInput, ListIncidentsInput,
} from './incidents.schema';

type Tx = Prisma.TransactionClient;

// Postgres text[] literal, with quotes/backslashes escaped so a system name
// containing them cannot break out of the array literal.
function toPgArray(arr: string[]): string {
  return `{${arr
    .map((v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',')}}`;
}

const d = (v: unknown): Date | null => (v ? new Date(v as string) : null);

function mapRow(row: Record<string, unknown>): Incident {
  const detectedAt = new Date(row.detectedAt as string);
  const deadlineHours = Number(row.notificationDeadlineHours ?? 72);
  const isDataBreach = Boolean(row.isDataBreach);
  const regulatorNotifiedAt = d(row.regulatorNotifiedAt);
  const resolvedAt = d(row.resolvedAt);

  // Only a reportable breach has a notification clock at all.
  const notificationDueAt = isDataBreach
    ? new Date(detectedAt.getTime() + deadlineHours * 3600_000)
    : null;

  return {
    id:          row.id as string,
    reference:   row.reference as string,
    title:       row.title as string,
    description: row.description as string | null,
    category:    row.category as Incident['category'],
    severity:    row.severity as Incident['severity'],
    status:      row.status as Incident['status'],

    occurredAt:  d(row.occurredAt),
    detectedAt,
    containedAt: d(row.containedAt),
    resolvedAt,

    isDataBreach,
    affectedDataSubjects: row.affectedDataSubjects === null || row.affectedDataSubjects === undefined
      ? null : Number(row.affectedDataSubjects),
    regulatorNotifiedAt,
    dataSubjectsNotifiedAt: d(row.dataSubjectsNotifiedAt),
    notificationDeadlineHours: deadlineHours,

    notificationDueAt,
    notificationOverdue: Boolean(
      notificationDueAt && !regulatorNotifiedAt && notificationDueAt.getTime() < Date.now(),
    ),
    timeToResolveHours: resolvedAt
      ? Math.round(((resolvedAt.getTime() - detectedAt.getTime()) / 3600_000) * 10) / 10
      : null,

    reportedBy:     row.reportedBy as string | null,
    reportedByName: (row.reportedByName as string | null) ?? null,
    assignedTo:     row.assignedTo as string | null,
    assignedToName: (row.assignedToName as string | null) ?? null,

    rootCause:       row.rootCause as string | null,
    remediation:     row.remediation as string | null,
    lessonsLearned:  row.lessonsLearned as string | null,
    affectedSystems: (row.affectedSystems as string[] | null) ?? [],
    tags:            (row.tags as string[] | null) ?? [],

    createdBy: row.createdBy as string | null,
    updatedBy: row.updatedBy as string | null,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  };
}

const SELECT_COLUMNS = `
  i.id, i.reference, i.title, i.description, i.category, i.severity, i.status,
  i.occurred_at  AS "occurredAt",
  i.detected_at  AS "detectedAt",
  i.contained_at AS "containedAt",
  i.resolved_at  AS "resolvedAt",
  i.is_data_breach AS "isDataBreach",
  i.affected_data_subjects AS "affectedDataSubjects",
  i.regulator_notified_at AS "regulatorNotifiedAt",
  i.data_subjects_notified_at AS "dataSubjectsNotifiedAt",
  i.notification_deadline_hours AS "notificationDeadlineHours",
  i.reported_by AS "reportedBy",
  rb.first_name || ' ' || rb.last_name AS "reportedByName",
  i.assigned_to AS "assignedTo",
  au.first_name || ' ' || au.last_name AS "assignedToName",
  i.root_cause AS "rootCause", i.remediation, i.lessons_learned AS "lessonsLearned",
  i.affected_systems AS "affectedSystems", i.tags,
  i.created_by AS "createdBy", i.updated_by AS "updatedBy",
  i.created_at AS "createdAt", i.updated_at AS "updatedAt"
`;

const JOINS = `
  LEFT JOIN global.users rb ON rb.id = i.reported_by
  LEFT JOIN global.users au ON au.id = i.assigned_to
`;

export const incidentsRepository = {
  async findAll(tx: Tx, filters: ListIncidentsInput): Promise<IncidentListResult> {
    const { page, limit, status, severity, category, assignedTo, isDataBreach, overdueNotification, q, sortBy, sortDir } = filters;

    const conditions: string[] = ['i.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (status)     { conditions.push(`i.status = $${idx++}`);     params.push(status); }
    if (severity)   { conditions.push(`i.severity = $${idx++}`);   params.push(severity); }
    if (category)   { conditions.push(`i.category = $${idx++}`);   params.push(category); }
    if (assignedTo) { conditions.push(`i.assigned_to = $${idx++}::uuid`); params.push(assignedTo); }
    if (isDataBreach !== undefined) { conditions.push(`i.is_data_breach = $${idx++}`); params.push(isDataBreach); }
    if (overdueNotification) {
      conditions.push(`i.is_data_breach = TRUE
        AND i.regulator_notified_at IS NULL
        AND i.detected_at + (i.notification_deadline_hours * INTERVAL '1 hour') < NOW()`);
    }
    if (q) {
      conditions.push(`(i.title ILIKE $${idx} OR i.description ILIKE $${idx} OR i.reference ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    // Severity sorts by real order, not alphabetically — "critical, high, medium,
    // low" is the only ordering that is useful on an incident queue.
    const allowedSortCols: Record<string, string> = {
      detected_at: 'i.detected_at',
      severity: `CASE i.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
      status: 'i.status',
      reference: 'i.reference',
      updated_at: 'i.updated_at',
    };
    const orderCol = allowedSortCols[sortBy ?? 'detected_at'] ?? 'i.detected_at';
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

    const where = conditions.join(' AND ');
    const offset = ((page ?? 1) - 1) * (limit ?? 50);

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT ${SELECT_COLUMNS}
        FROM incidents i ${JOINS}
        WHERE ${where}
        ORDER BY ${orderCol} ${dir} NULLS LAST
        LIMIT ${limit ?? 50} OFFSET ${offset}
      `, ...params),
      tx.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) FROM incidents i WHERE ${where}`, ...params,
      ),
    ]);

    return {
      incidents: rows.map(mapRow),
      total: Number(countRows[0].count),
      page: page ?? 1,
      limit: limit ?? 50,
    };
  },

  async findById(tx: Tx, id: string): Promise<Incident | null> {
    const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${SELECT_COLUMNS} FROM incidents i ${JOINS}
        WHERE i.id = $1::uuid AND i.deleted_at IS NULL`,
      id,
    );
    return rows[0] ? mapRow(rows[0]) : null;
  },

  /**
   * Allocates the next INC-<year>-NNNN reference.
   *
   * Runs inside the caller's transaction and takes an advisory lock keyed on the
   * year, so two people filing an incident at the same moment cannot be handed
   * the same number. The partial unique index is the backstop.
   */
  async nextReference(tx: Tx): Promise<string> {
    const year = new Date().getUTCFullYear();
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, year);
    const rows = await tx.$queryRawUnsafe<[{ next: number }]>(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(reference, '^INC-\\d{4}-', ''), '')::int), 0) + 1 AS next
         FROM incidents
        WHERE reference LIKE $1`,
      `INC-${year}-%`,
    );
    return `INC-${year}-${String(rows[0].next).padStart(4, '0')}`;
  },

  async create(tx: Tx, input: CreateIncidentInput & { createdBy: string }): Promise<{ id: string }> {
    const reference = await incidentsRepository.nextReference(tx);
    const rows = await tx.$queryRawUnsafe<[{ id: string }]>(`
      INSERT INTO incidents (
        reference, title, description, category, severity, status,
        occurred_at, detected_at, is_data_breach, affected_data_subjects,
        notification_deadline_hours, assigned_to, root_cause, remediation,
        lessons_learned, affected_systems, tags, reported_by, created_by, updated_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7::timestamptz, COALESCE($8::timestamptz, NOW()), $9, $10,
        $11, $12::uuid, $13, $14,
        $15, $16::text[], $17::text[], $18::uuid, $18::uuid, $18::uuid
      ) RETURNING id
    `,
      reference, input.title, input.description ?? null, input.category, input.severity, input.status,
      input.occurredAt ?? null, input.detectedAt ?? null,
      input.isDataBreach ?? false, input.affectedDataSubjects ?? null,
      input.notificationDeadlineHours ?? 72, input.assignedTo ?? null,
      input.rootCause ?? null, input.remediation ?? null, input.lessonsLearned ?? null,
      toPgArray(input.affectedSystems ?? []), toPgArray(input.tags ?? []),
      input.createdBy,
    );
    return { id: rows[0].id };
  },

  async update(tx: Tx, id: string, input: UpdateIncidentInput & { updatedBy: string }): Promise<boolean> {
    // Only touch the columns actually supplied: an incident is edited by several
    // people over its life and a blanket COALESCE write would let a stale form
    // silently revert someone else's field.
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const set = (col: string, value: unknown, cast = '') => {
      sets.push(`${col} = $${idx++}${cast}`);
      params.push(value);
    };

    if (input.title !== undefined)        set('title', input.title);
    if (input.description !== undefined)  set('description', input.description);
    if (input.category !== undefined)     set('category', input.category);
    if (input.severity !== undefined)     set('severity', input.severity);
    if (input.status !== undefined)       set('status', input.status);
    if (input.occurredAt !== undefined)   set('occurred_at', input.occurredAt, '::timestamptz');
    if (input.detectedAt !== undefined)   set('detected_at', input.detectedAt, '::timestamptz');
    if (input.containedAt !== undefined)  set('contained_at', input.containedAt, '::timestamptz');
    if (input.resolvedAt !== undefined)   set('resolved_at', input.resolvedAt, '::timestamptz');
    if (input.isDataBreach !== undefined) set('is_data_breach', input.isDataBreach);
    if (input.affectedDataSubjects !== undefined) set('affected_data_subjects', input.affectedDataSubjects);
    if (input.regulatorNotifiedAt !== undefined)   set('regulator_notified_at', input.regulatorNotifiedAt, '::timestamptz');
    if (input.dataSubjectsNotifiedAt !== undefined) set('data_subjects_notified_at', input.dataSubjectsNotifiedAt, '::timestamptz');
    if (input.notificationDeadlineHours !== undefined) set('notification_deadline_hours', input.notificationDeadlineHours);
    if (input.assignedTo !== undefined)     set('assigned_to', input.assignedTo, '::uuid');
    if (input.rootCause !== undefined)      set('root_cause', input.rootCause);
    if (input.remediation !== undefined)    set('remediation', input.remediation);
    if (input.lessonsLearned !== undefined) set('lessons_learned', input.lessonsLearned);
    if (input.affectedSystems !== undefined) set('affected_systems', toPgArray(input.affectedSystems), '::text[]');
    if (input.tags !== undefined)            set('tags', toPgArray(input.tags), '::text[]');

    // Reaching a terminal state stamps the timestamp the reports key off, unless
    // the caller set it explicitly.
    if (input.status === 'resolved' && input.resolvedAt === undefined) {
      sets.push('resolved_at = COALESCE(resolved_at, NOW())');
    }
    if (input.status === 'contained' && input.containedAt === undefined) {
      sets.push('contained_at = COALESCE(contained_at, NOW())');
    }

    set('updated_by', input.updatedBy, '::uuid');
    sets.push('updated_at = NOW()');

    const affected = await tx.$executeRawUnsafe(
      `UPDATE incidents SET ${sets.join(', ')} WHERE id = $${idx}::uuid AND deleted_at IS NULL`,
      ...params, id,
    );
    return affected > 0;
  },

  async softDelete(tx: Tx, id: string, userId: string): Promise<boolean> {
    const affected = await tx.$executeRawUnsafe(
      `UPDATE incidents SET deleted_at = NOW(), updated_by = $2::uuid, updated_at = NOW()
        WHERE id = $1::uuid AND deleted_at IS NULL`,
      id, userId,
    );
    return affected > 0;
  },

  // ── Timeline ───────────────────────────────────────────────────────────────

  async findUpdates(tx: Tx, incidentId: string): Promise<IncidentUpdate[]> {
    const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT iu.id, iu.incident_id AS "incidentId", iu.entry_type AS "entryType",
             iu.body, iu.metadata, iu.author_id AS "authorId",
             u.first_name || ' ' || u.last_name AS "authorName",
             iu.created_at AS "createdAt"
      FROM incident_updates iu
      LEFT JOIN global.users u ON u.id = iu.author_id
      WHERE iu.incident_id = $1::uuid
      ORDER BY iu.created_at DESC
    `, incidentId);

    return rows.map((r) => ({
      id: r.id as string,
      incidentId: r.incidentId as string,
      entryType: r.entryType as IncidentUpdate['entryType'],
      body: r.body as string,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      authorId: r.authorId as string | null,
      authorName: (r.authorName as string | null) ?? null,
      createdAt: new Date(r.createdAt as string),
    }));
  },

  async addUpdate(
    tx: Tx,
    incidentId: string,
    input: { body: string; entryType: string; authorId: string; metadata?: Record<string, unknown> },
  ): Promise<{ id: string }> {
    const rows = await tx.$queryRawUnsafe<[{ id: string }]>(`
      INSERT INTO incident_updates (incident_id, entry_type, body, metadata, author_id)
      VALUES ($1::uuid, $2, $3, $4::jsonb, $5::uuid) RETURNING id
    `, incidentId, input.entryType, input.body, JSON.stringify(input.metadata ?? {}), input.authorId);
    return { id: rows[0].id };
  },

  // ── Stats ──────────────────────────────────────────────────────────────────

  async stats(tx: Tx): Promise<IncidentStats> {
    const [row] = await tx.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int          AS open,
        COUNT(*) FILTER (WHERE status = 'investigating')::int AS investigating,
        COUNT(*) FILTER (WHERE status = 'contained')::int     AS contained,
        COUNT(*) FILTER (WHERE status = 'resolved')::int      AS resolved,
        COUNT(*) FILTER (WHERE status = 'closed')::int        AS closed,
        COUNT(*) FILTER (WHERE severity = 'critical')::int    AS critical,
        COUNT(*) FILTER (WHERE severity = 'high')::int        AS high,
        COUNT(*) FILTER (WHERE is_data_breach)::int           AS "dataBreaches",
        COUNT(*) FILTER (
          WHERE is_data_breach AND regulator_notified_at IS NULL
            AND detected_at + (notification_deadline_hours * INTERVAL '1 hour') < NOW()
        )::int AS "overdueNotifications",
        AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600)
          FILTER (WHERE resolved_at IS NOT NULL) AS "mttr"
      FROM incidents
      WHERE deleted_at IS NULL
    `);

    return {
      total:         Number(row.total ?? 0),
      open:          Number(row.open ?? 0),
      investigating: Number(row.investigating ?? 0),
      contained:     Number(row.contained ?? 0),
      resolved:      Number(row.resolved ?? 0),
      closed:        Number(row.closed ?? 0),
      critical:      Number(row.critical ?? 0),
      high:          Number(row.high ?? 0),
      dataBreaches:  Number(row.dataBreaches ?? 0),
      overdueNotifications: Number(row.overdueNotifications ?? 0),
      meanTimeToResolveHours: row.mttr === null || row.mttr === undefined
        ? null : Math.round(Number(row.mttr) * 10) / 10,
    };
  },
};
