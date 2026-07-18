import { Prisma } from '@prisma/client';
import type { Audit, AuditListResult, AuditFinding } from './audits.types';
import type {
  CreateAuditInput,
  UpdateAuditInput,
  ListAuditsInput,
  CreateFindingInput,
  UpdateFindingInput,
} from './audits.schema';

type Tx = Prisma.TransactionClient;

function mapRow(row: Record<string, unknown>): Audit {
  return {
    id:           row.id as string,
    title:        row.title as string,
    auditType:    row.auditType as Audit['auditType'],
    frameworkRef: row.frameworkRef as string | null,
    status:       row.status as Audit['status'],
    auditorName:  row.auditorName as string | null,
    scope:        row.scope as string | null,
    summary:      row.summary as string | null,
    startDate:    row.startDate ? new Date(row.startDate as string) : null,
    endDate:      row.endDate ? new Date(row.endDate as string) : null,
    ownerId:      row.ownerId as string | null,
    ownerName:    row.ownerName as string | null,
    ownerEmail:   row.ownerEmail as string | null,
    createdBy:    row.createdBy as string | null,
    updatedBy:    row.updatedBy as string | null,
    createdAt:    new Date(row.createdAt as string),
    updatedAt:    new Date(row.updatedAt as string),
  };
}

function mapFindingRow(row: Record<string, unknown>): AuditFinding {
  return {
    id:             row.id as string,
    auditId:        row.auditId as string,
    title:          row.title as string,
    description:    row.description as string | null,
    severity:       row.severity as AuditFinding['severity'],
    status:         row.status as AuditFinding['status'],
    recommendation: row.recommendation as string | null,
    ownerId:        row.ownerId as string | null,
    ownerName:      row.ownerName as string | null,
    ownerEmail:     row.ownerEmail as string | null,
    dueDate:        row.dueDate ? new Date(row.dueDate as string) : null,
    createdBy:      row.createdBy as string | null,
    createdAt:      new Date(row.createdAt as string),
    updatedAt:      new Date(row.updatedAt as string),
  };
}

export const auditsRepository = {
  async findAll(tx: Tx, filters: ListAuditsInput): Promise<AuditListResult> {
    const { page, limit, status, auditType, ownerId, q, sortBy, sortDir } = filters;

    const conditions: string[] = ['a.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (status) { conditions.push(`a.status = $${idx++}`); params.push(status); }
    if (auditType) { conditions.push(`a.audit_type = $${idx++}`); params.push(auditType); }
    if (ownerId) { conditions.push(`a.owner_id = $${idx++}::uuid`); params.push(ownerId); }
    if (q) {
      conditions.push(`(a.title ILIKE $${idx} OR a.framework_ref ILIKE $${idx} OR a.auditor_name ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const allowedSortCols: Record<string, string> = {
      title: 'a.title', audit_type: 'a.audit_type', status: 'a.status',
      start_date: 'a.start_date', end_date: 'a.end_date', updated_at: 'a.updated_at',
    };
    const orderCol = allowedSortCols[sortBy ?? 'updated_at'] ?? 'a.updated_at';
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

    const where = conditions.join(' AND ');
    const offset = ((page ?? 1) - 1) * (limit ?? 50);

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT
          a.id, a.title, a.audit_type AS "auditType", a.framework_ref AS "frameworkRef",
          a.status, a.auditor_name AS "auditorName", a.scope, a.summary,
          a.start_date AS "startDate", a.end_date AS "endDate",
          a.owner_id AS "ownerId",
          u.first_name || ' ' || u.last_name AS "ownerName",
          u.email AS "ownerEmail",
          a.created_by AS "createdBy", a.updated_by AS "updatedBy",
          a.created_at AS "createdAt", a.updated_at AS "updatedAt"
        FROM audits a
        LEFT JOIN global.users u ON u.id = a.owner_id
        WHERE ${where}
        ORDER BY ${orderCol} ${dir} NULLS LAST
        LIMIT ${limit ?? 50} OFFSET ${offset}
      `, ...params),
      tx.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) FROM audits a WHERE ${where}
      `, ...params),
    ]);

    return {
      audits: rows.map(mapRow),
      total:  Number(countRows[0].count),
      page:   page ?? 1,
      limit:  limit ?? 50,
    };
  },

  async findById(tx: Tx, id: string): Promise<Audit | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        a.id, a.title, a.audit_type AS "auditType", a.framework_ref AS "frameworkRef",
        a.status, a.auditor_name AS "auditorName", a.scope, a.summary,
        a.start_date AS "startDate", a.end_date AS "endDate",
        a.owner_id AS "ownerId",
        u.first_name || ' ' || u.last_name AS "ownerName",
        u.email AS "ownerEmail",
        a.created_by AS "createdBy", a.updated_by AS "updatedBy",
        a.created_at AS "createdAt", a.updated_at AS "updatedAt"
      FROM audits a
      LEFT JOIN global.users u ON u.id = a.owner_id
      WHERE a.id = ${id}::uuid AND a.deleted_at IS NULL
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async create(tx: Tx, input: CreateAuditInput & { createdBy: string }): Promise<{ id: string }> {
    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO audits (
        title, audit_type, framework_ref, status, auditor_name, scope, summary,
        start_date, end_date, owner_id, created_by, updated_by
      ) VALUES (
        ${input.title},
        ${input.auditType},
        ${input.frameworkRef ?? null},
        ${input.status},
        ${input.auditorName ?? null},
        ${input.scope ?? null},
        ${input.summary ?? null},
        ${input.startDate ?? null}::date,
        ${input.endDate ?? null}::date,
        ${input.ownerId ?? null}::uuid,
        ${input.createdBy}::uuid,
        ${input.createdBy}::uuid
      )
      RETURNING id
    `;
    return rows[0];
  },

  async update(tx: Tx, id: string, input: UpdateAuditInput & { updatedBy: string }): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE audits SET
        title         = COALESCE(${input.title ?? null}, title),
        audit_type    = COALESCE(${input.auditType ?? null}, audit_type),
        framework_ref = CASE WHEN ${input.frameworkRef !== undefined} THEN ${input.frameworkRef ?? null} ELSE framework_ref END,
        status        = COALESCE(${input.status ?? null}, status),
        auditor_name  = CASE WHEN ${input.auditorName !== undefined} THEN ${input.auditorName ?? null} ELSE auditor_name END,
        scope         = CASE WHEN ${input.scope !== undefined} THEN ${input.scope ?? null} ELSE scope END,
        summary       = CASE WHEN ${input.summary !== undefined} THEN ${input.summary ?? null} ELSE summary END,
        start_date    = CASE WHEN ${input.startDate !== undefined} THEN ${input.startDate ?? null}::date ELSE start_date END,
        end_date      = CASE WHEN ${input.endDate !== undefined} THEN ${input.endDate ?? null}::date ELSE end_date END,
        owner_id      = CASE WHEN ${input.ownerId !== undefined} THEN ${input.ownerId ?? null}::uuid ELSE owner_id END,
        updated_by    = ${input.updatedBy}::uuid,
        updated_at    = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async softDelete(tx: Tx, id: string, deletedBy: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE audits SET deleted_at = NOW(), updated_by = ${deletedBy}::uuid
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async findFindings(tx: Tx, auditId: string): Promise<AuditFinding[]> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        f.id, f.audit_id AS "auditId", f.title, f.description, f.severity, f.status,
        f.recommendation, f.owner_id AS "ownerId",
        u.first_name || ' ' || u.last_name AS "ownerName",
        u.email AS "ownerEmail",
        f.due_date AS "dueDate", f.created_by AS "createdBy",
        f.created_at AS "createdAt", f.updated_at AS "updatedAt"
      FROM audit_findings f
      LEFT JOIN global.users u ON u.id = f.owner_id
      WHERE f.audit_id = ${auditId}::uuid
      ORDER BY f.created_at DESC
    `;
    return rows.map(mapFindingRow);
  },

  async findFindingById(tx: Tx, id: string): Promise<AuditFinding | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        f.id, f.audit_id AS "auditId", f.title, f.description, f.severity, f.status,
        f.recommendation, f.owner_id AS "ownerId",
        u.first_name || ' ' || u.last_name AS "ownerName",
        u.email AS "ownerEmail",
        f.due_date AS "dueDate", f.created_by AS "createdBy",
        f.created_at AS "createdAt", f.updated_at AS "updatedAt"
      FROM audit_findings f
      LEFT JOIN global.users u ON u.id = f.owner_id
      WHERE f.id = ${id}::uuid
    `;
    return rows[0] ? mapFindingRow(rows[0]) : null;
  },

  async createFinding(
    tx: Tx,
    auditId: string,
    input: CreateFindingInput & { createdBy: string },
  ): Promise<{ id: string }> {
    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO audit_findings (
        audit_id, title, description, severity, status, recommendation, owner_id, due_date, created_by
      ) VALUES (
        ${auditId}::uuid,
        ${input.title},
        ${input.description ?? null},
        ${input.severity},
        ${input.status},
        ${input.recommendation ?? null},
        ${input.ownerId ?? null}::uuid,
        ${input.dueDate ?? null}::date,
        ${input.createdBy}::uuid
      )
      RETURNING id
    `;
    return rows[0];
  },

  async updateFinding(tx: Tx, id: string, input: UpdateFindingInput): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE audit_findings SET
        title          = COALESCE(${input.title ?? null}, title),
        description    = CASE WHEN ${input.description !== undefined} THEN ${input.description ?? null} ELSE description END,
        severity       = COALESCE(${input.severity ?? null}, severity),
        status         = COALESCE(${input.status ?? null}, status),
        recommendation = CASE WHEN ${input.recommendation !== undefined} THEN ${input.recommendation ?? null} ELSE recommendation END,
        owner_id       = CASE WHEN ${input.ownerId !== undefined} THEN ${input.ownerId ?? null}::uuid ELSE owner_id END,
        due_date       = CASE WHEN ${input.dueDate !== undefined} THEN ${input.dueDate ?? null}::date ELSE due_date END,
        updated_at     = NOW()
      WHERE id = ${id}::uuid
    `;
    return result > 0;
  },

  async deleteFinding(tx: Tx, id: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      DELETE FROM audit_findings WHERE id = ${id}::uuid
    `;
    return result > 0;
  },
};
