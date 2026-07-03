import { Prisma } from '@prisma/client';
import type { Control, ControlListResult, ControlStatusCount } from './controls.types';
import type { CreateControlInput, UpdateControlInput, ListControlsInput } from './controls.schema';

type Tx = Prisma.TransactionClient;

function mapRow(row: Record<string, unknown>): Control {
  return {
    id:                   row.id as string,
    frameworkId:          row.frameworkId as string | null,
    frameworkName:        row.frameworkName as string | null,
    controlRef:           row.controlRef as string,
    title:                row.title as string,
    description:          row.description as string | null,
    category:             row.category as string | null,
    guidance:             row.guidance as string | null,
    criticality:          row.criticality as Control['criticality'],
    implementationStatus: row.implementationStatus as Control['implementationStatus'],
    implementationNotes:  row.implementationNotes as string | null,
    testingNotes:         row.testingNotes as string | null,
    ownerId:              row.ownerId as string | null,
    ownerName:            row.ownerName as string | null,
    ownerEmail:           row.ownerEmail as string | null,
    dueDate:              row.dueDate ? new Date(row.dueDate as string) : null,
    reviewFrequencyDays:  Number(row.reviewFrequencyDays),
    lastReviewedAt:       row.lastReviewedAt ? new Date(row.lastReviewedAt as string) : null,
    reviewedBy:           row.reviewedBy as string | null,
    createdBy:            row.createdBy as string | null,
    createdAt:            new Date(row.createdAt as string),
    updatedAt:            new Date(row.updatedAt as string),
  };
}

export const controlsRepository = {
  async findAll(tx: Tx, filters: ListControlsInput): Promise<ControlListResult> {
    const {
      page, limit, frameworkId, status, criticality, ownerId, q,
      category, dueBefore, sortBy, sortDir,
    } = filters;

    const conditions: string[] = ['c.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (frameworkId) { conditions.push(`c.framework_id = $${idx++}::uuid`); params.push(frameworkId); }
    if (status) { conditions.push(`c.implementation_status = $${idx++}`); params.push(status); }
    if (criticality) { conditions.push(`c.criticality = $${idx++}`); params.push(criticality); }
    if (ownerId) { conditions.push(`c.owner_id = $${idx++}::uuid`); params.push(ownerId); }
    if (category) { conditions.push(`c.category ILIKE $${idx++}`); params.push(`%${category}%`); }
    if (dueBefore) { conditions.push(`c.due_date <= $${idx++}::date`); params.push(dueBefore); }
    if (q) {
      conditions.push(`(c.title ILIKE $${idx} OR c.control_ref ILIKE $${idx} OR c.description ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const allowedSortCols: Record<string, string> = {
      control_ref: 'c.control_ref', title: 'c.title',
      criticality: 'c.criticality', due_date: 'c.due_date', updated_at: 'c.updated_at',
    };
    const orderCol = allowedSortCols[sortBy ?? 'control_ref'] ?? 'c.control_ref';
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';

    const where = conditions.join(' AND ');
    const offset = ((page ?? 1) - 1) * (limit ?? 50);

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT
          c.id, c.framework_id AS "frameworkId", c.control_ref AS "controlRef",
          c.title, c.description, c.category, c.guidance, c.criticality,
          c.implementation_status AS "implementationStatus",
          c.implementation_notes AS "implementationNotes",
          c.testing_notes AS "testingNotes",
          c.owner_id AS "ownerId",
          u.first_name || ' ' || u.last_name AS "ownerName",
          u.email AS "ownerEmail",
          c.due_date AS "dueDate", c.review_frequency_days AS "reviewFrequencyDays",
          c.last_reviewed_at AS "lastReviewedAt", c.reviewed_by AS "reviewedBy",
          c.created_by AS "createdBy", c.created_at AS "createdAt", c.updated_at AS "updatedAt",
          NULL AS "frameworkName"
        FROM controls c
        LEFT JOIN global.users u ON u.id = c.owner_id
        WHERE ${where}
        ORDER BY ${orderCol} ${dir} NULLS LAST
        LIMIT ${limit ?? 50} OFFSET ${offset}
      `, ...params),
      tx.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) FROM controls c WHERE ${where}
      `, ...params),
    ]);

    return {
      controls: rows.map(mapRow),
      total:    Number(countRows[0].count),
      page:     page ?? 1,
      limit:    limit ?? 50,
    };
  },

  async findById(tx: Tx, id: string): Promise<Control | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        c.id, c.framework_id AS "frameworkId", c.control_ref AS "controlRef",
        c.title, c.description, c.category, c.guidance, c.criticality,
        c.implementation_status AS "implementationStatus",
        c.implementation_notes AS "implementationNotes",
        c.testing_notes AS "testingNotes",
        c.owner_id AS "ownerId",
        u.first_name || ' ' || u.last_name AS "ownerName",
        u.email AS "ownerEmail",
        c.due_date AS "dueDate", c.review_frequency_days AS "reviewFrequencyDays",
        c.last_reviewed_at AS "lastReviewedAt", c.reviewed_by AS "reviewedBy",
        c.created_by AS "createdBy", c.created_at AS "createdAt", c.updated_at AS "updatedAt",
        NULL AS "frameworkName"
      FROM controls c
      LEFT JOIN global.users u ON u.id = c.owner_id
      WHERE c.id = ${id}::uuid AND c.deleted_at IS NULL
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async create(tx: Tx, input: CreateControlInput & { createdBy: string }): Promise<{ id: string }> {
    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO controls (
        framework_id, control_ref, title, description, category, guidance,
        criticality, implementation_status, implementation_notes, testing_notes,
        owner_id, due_date, review_frequency_days, created_by, updated_by
      ) VALUES (
        ${input.frameworkId ?? null}::uuid,
        ${input.controlRef},
        ${input.title},
        ${input.description ?? null},
        ${input.category ?? null},
        ${input.guidance ?? null},
        ${input.criticality},
        ${input.implementationStatus},
        ${input.implementationNotes ?? null},
        ${input.testingNotes ?? null},
        ${input.ownerId ?? null}::uuid,
        ${input.dueDate ?? null}::date,
        ${input.reviewFrequencyDays ?? 365},
        ${input.createdBy}::uuid,
        ${input.createdBy}::uuid
      )
      RETURNING id
    `;
    return rows[0];
  },

  async update(tx: Tx, id: string, input: UpdateControlInput & { updatedBy: string }): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE controls SET
        framework_id          = COALESCE(${input.frameworkId ?? null}::uuid, framework_id),
        control_ref           = COALESCE(${input.controlRef ?? null}, control_ref),
        title                 = COALESCE(${input.title ?? null}, title),
        description           = CASE WHEN ${input.description !== undefined} THEN ${input.description ?? null} ELSE description END,
        category              = CASE WHEN ${input.category !== undefined} THEN ${input.category ?? null} ELSE category END,
        guidance              = CASE WHEN ${input.guidance !== undefined} THEN ${input.guidance ?? null} ELSE guidance END,
        criticality           = COALESCE(${input.criticality ?? null}, criticality),
        implementation_status = COALESCE(${input.implementationStatus ?? null}, implementation_status),
        implementation_notes  = CASE WHEN ${input.implementationNotes !== undefined} THEN ${input.implementationNotes ?? null} ELSE implementation_notes END,
        testing_notes         = CASE WHEN ${input.testingNotes !== undefined} THEN ${input.testingNotes ?? null} ELSE testing_notes END,
        owner_id              = CASE WHEN ${input.ownerId !== undefined} THEN ${input.ownerId ?? null}::uuid ELSE owner_id END,
        due_date              = CASE WHEN ${input.dueDate !== undefined} THEN ${input.dueDate ?? null}::date ELSE due_date END,
        review_frequency_days = COALESCE(${input.reviewFrequencyDays ?? null}, review_frequency_days),
        last_reviewed_at      = CASE WHEN ${input.lastReviewedAt !== undefined} THEN ${input.lastReviewedAt ?? null}::timestamptz ELSE last_reviewed_at END,
        updated_by            = ${input.updatedBy}::uuid,
        updated_at            = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async softDelete(tx: Tx, id: string, deletedBy: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE controls SET deleted_at = NOW(), updated_by = ${deletedBy}::uuid
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  // Aggregate counts needed for score calculation
  async getStatusCounts(tx: Tx): Promise<ControlStatusCount[]> {
    const rows = await tx.$queryRaw<ControlStatusCount[]>`
      SELECT
        implementation_status AS "implementationStatus",
        criticality,
        COUNT(*)::int AS count
      FROM controls
      WHERE deleted_at IS NULL
      GROUP BY implementation_status, criticality
    `;
    return rows;
  },

  // Per-framework aggregate — used by score service
  async getStatusCountsByFramework(tx: Tx): Promise<
    (ControlStatusCount & { frameworkId: string | null })[]
  > {
    const rows = await tx.$queryRaw<(ControlStatusCount & { frameworkId: string | null })[]>`
      SELECT
        framework_id AS "frameworkId",
        implementation_status AS "implementationStatus",
        criticality,
        COUNT(*)::int AS count
      FROM controls
      WHERE deleted_at IS NULL
      GROUP BY framework_id, implementation_status, criticality
    `;
    return rows;
  },

  // Controls overdue (due_date < now, status not implemented/not_applicable)
  async findOverdue(tx: Tx): Promise<Control[]> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        c.id, c.framework_id AS "frameworkId", c.control_ref AS "controlRef",
        c.title, c.description, c.category, c.criticality,
        c.implementation_status AS "implementationStatus",
        c.owner_id AS "ownerId",
        u.first_name || ' ' || u.last_name AS "ownerName",
        u.email AS "ownerEmail",
        c.due_date AS "dueDate",
        c.created_by AS "createdBy", c.created_at AS "createdAt", c.updated_at AS "updatedAt",
        NULL AS "frameworkName", NULL AS "guidance", NULL AS "implementationNotes",
        NULL AS "testingNotes", NULL AS "reviewedBy", NULL AS "lastReviewedAt",
        365 AS "reviewFrequencyDays"
      FROM controls c
      LEFT JOIN global.users u ON u.id = c.owner_id
      WHERE c.deleted_at IS NULL
        AND c.due_date < NOW()::date
        AND c.implementation_status NOT IN ('implemented', 'not_applicable')
      ORDER BY c.due_date ASC
    `;
    return rows.map(mapRow);
  },
};
