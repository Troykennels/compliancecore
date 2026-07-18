import { Prisma } from '@prisma/client';
import type { Policy, PolicyListResult } from './policies.types';
import type { CreatePolicyInput, UpdatePolicyInput, ListPoliciesInput } from './policies.schema';

type Tx = Prisma.TransactionClient;

// Build a Postgres text[] array literal (e.g. {"a","b"}) for safe binding.
function toPgArray(arr: string[]): string {
  return `{${arr
    .map((v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',')}}`;
}

function mapRow(row: Record<string, unknown>): Policy {
  return {
    id:                  row.id as string,
    title:               row.title as string,
    description:         row.description as string | null,
    documentType:        row.documentType as Policy['documentType'],
    status:              row.status as Policy['status'],
    content:             row.content as string | null,
    currentVersion:      Number(row.currentVersion),
    ownerId:             row.ownerId as string | null,
    ownerName:           row.ownerName as string | null,
    ownerEmail:          row.ownerEmail as string | null,
    reviewDueDate:       row.reviewDueDate ? new Date(row.reviewDueDate as string) : null,
    reviewFrequencyDays: Number(row.reviewFrequencyDays),
    frameworkIds:        (row.frameworkIds as string[] | null) ?? [],
    tags:                (row.tags as string[] | null) ?? [],
    approvedAt:          row.approvedAt ? new Date(row.approvedAt as string) : null,
    approvedBy:          row.approvedBy as string | null,
    createdBy:           row.createdBy as string | null,
    updatedBy:           row.updatedBy as string | null,
    createdAt:           new Date(row.createdAt as string),
    updatedAt:           new Date(row.updatedAt as string),
  };
}

export const policiesRepository = {
  async findAll(tx: Tx, filters: ListPoliciesInput): Promise<PolicyListResult> {
    const { page, limit, status, documentType, ownerId, q, sortBy, sortDir } = filters;

    const conditions: string[] = ['p.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (status) { conditions.push(`p.status = $${idx++}`); params.push(status); }
    if (documentType) { conditions.push(`p.document_type = $${idx++}`); params.push(documentType); }
    if (ownerId) { conditions.push(`p.owner_id = $${idx++}::uuid`); params.push(ownerId); }
    if (q) {
      conditions.push(`(p.title ILIKE $${idx} OR p.description ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const allowedSortCols: Record<string, string> = {
      title: 'p.title', status: 'p.status', document_type: 'p.document_type',
      review_due_date: 'p.review_due_date', updated_at: 'p.updated_at',
    };
    const orderCol = allowedSortCols[sortBy ?? 'title'] ?? 'p.title';
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';

    const where = conditions.join(' AND ');
    const offset = ((page ?? 1) - 1) * (limit ?? 50);

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT
          p.id, p.title, p.description,
          p.document_type AS "documentType", p.status, p.content,
          p.current_version AS "currentVersion",
          p.owner_id AS "ownerId",
          u.first_name || ' ' || u.last_name AS "ownerName",
          u.email AS "ownerEmail",
          p.review_due_date AS "reviewDueDate",
          p.review_frequency_days AS "reviewFrequencyDays",
          p.framework_ids AS "frameworkIds", p.tags,
          p.approved_at AS "approvedAt", p.approved_by AS "approvedBy",
          p.created_by AS "createdBy", p.updated_by AS "updatedBy",
          p.created_at AS "createdAt", p.updated_at AS "updatedAt"
        FROM policies p
        LEFT JOIN global.users u ON u.id = p.owner_id
        WHERE ${where}
        ORDER BY ${orderCol} ${dir} NULLS LAST
        LIMIT ${limit ?? 50} OFFSET ${offset}
      `, ...params),
      tx.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) FROM policies p WHERE ${where}
      `, ...params),
    ]);

    return {
      policies: rows.map(mapRow),
      total:    Number(countRows[0].count),
      page:     page ?? 1,
      limit:    limit ?? 50,
    };
  },

  async findById(tx: Tx, id: string): Promise<Policy | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        p.id, p.title, p.description,
        p.document_type AS "documentType", p.status, p.content,
        p.current_version AS "currentVersion",
        p.owner_id AS "ownerId",
        u.first_name || ' ' || u.last_name AS "ownerName",
        u.email AS "ownerEmail",
        p.review_due_date AS "reviewDueDate",
        p.review_frequency_days AS "reviewFrequencyDays",
        p.framework_ids AS "frameworkIds", p.tags,
        p.approved_at AS "approvedAt", p.approved_by AS "approvedBy",
        p.created_by AS "createdBy", p.updated_by AS "updatedBy",
        p.created_at AS "createdAt", p.updated_at AS "updatedAt"
      FROM policies p
      LEFT JOIN global.users u ON u.id = p.owner_id
      WHERE p.id = ${id}::uuid AND p.deleted_at IS NULL
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async create(tx: Tx, input: CreatePolicyInput & { createdBy: string }): Promise<{ id: string }> {
    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO policies (
        title, description, document_type, status, content,
        owner_id, review_due_date, review_frequency_days,
        framework_ids, tags, created_by, updated_by
      ) VALUES (
        ${input.title},
        ${input.description ?? null},
        ${input.documentType},
        ${input.status},
        ${input.content ?? null},
        ${input.ownerId ?? null}::uuid,
        ${input.reviewDueDate ?? null}::date,
        ${input.reviewFrequencyDays ?? 365},
        ${toPgArray(input.frameworkIds ?? [])}::text[],
        ${toPgArray(input.tags ?? [])}::text[],
        ${input.createdBy}::uuid,
        ${input.createdBy}::uuid
      )
      RETURNING id
    `;
    return rows[0];
  },

  async update(tx: Tx, id: string, input: UpdatePolicyInput & { updatedBy: string }): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE policies SET
        title                 = COALESCE(${input.title ?? null}, title),
        description           = CASE WHEN ${input.description !== undefined} THEN ${input.description ?? null} ELSE description END,
        document_type         = COALESCE(${input.documentType ?? null}, document_type),
        status                = COALESCE(${input.status ?? null}, status),
        content               = CASE WHEN ${input.content !== undefined} THEN ${input.content ?? null} ELSE content END,
        owner_id              = CASE WHEN ${input.ownerId !== undefined} THEN ${input.ownerId ?? null}::uuid ELSE owner_id END,
        review_due_date       = CASE WHEN ${input.reviewDueDate !== undefined} THEN ${input.reviewDueDate ?? null}::date ELSE review_due_date END,
        review_frequency_days = COALESCE(${input.reviewFrequencyDays ?? null}, review_frequency_days),
        framework_ids         = CASE WHEN ${input.frameworkIds !== undefined} THEN ${toPgArray(input.frameworkIds ?? [])}::text[] ELSE framework_ids END,
        tags                  = CASE WHEN ${input.tags !== undefined} THEN ${toPgArray(input.tags ?? [])}::text[] ELSE tags END,
        updated_by            = ${input.updatedBy}::uuid,
        updated_at            = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async publish(tx: Tx, id: string, actorId: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE policies SET
        status      = 'published',
        approved_at = NOW(),
        approved_by = ${actorId}::uuid,
        updated_by  = ${actorId}::uuid,
        updated_at  = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async softDelete(tx: Tx, id: string, deletedBy: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE policies SET deleted_at = NOW(), updated_by = ${deletedBy}::uuid
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },
};
