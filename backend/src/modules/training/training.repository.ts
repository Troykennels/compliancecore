import { Prisma } from '@prisma/client';
import type { TrainingProgram, TrainingProgramListResult, TrainingRecord } from './training.types';
import type {
  CreateTrainingInput,
  UpdateTrainingInput,
  ListTrainingsInput,
  AssignTrainingRecordsInput,
} from './training.schema';

type Tx = Prisma.TransactionClient;

function mapRow(row: Record<string, unknown>): TrainingProgram {
  return {
    id:              row.id as string,
    title:           row.title as string,
    description:     row.description as string | null,
    category:        row.category as string | null,
    provider:        row.provider as string | null,
    durationMinutes: row.durationMinutes === null || row.durationMinutes === undefined
      ? null
      : Number(row.durationMinutes),
    isMandatory:     Boolean(row.isMandatory),
    frequencyDays:   row.frequencyDays === null || row.frequencyDays === undefined
      ? null
      : Number(row.frequencyDays),
    status:          row.status as TrainingProgram['status'],
    ownerId:         row.ownerId as string | null,
    ownerName:       row.ownerName as string | null,
    ownerEmail:      row.ownerEmail as string | null,
    createdBy:       row.createdBy as string | null,
    updatedBy:       row.updatedBy as string | null,
    createdAt:       new Date(row.createdAt as string),
    updatedAt:       new Date(row.updatedAt as string),
  };
}

function mapRecordRow(row: Record<string, unknown>): TrainingRecord {
  return {
    id:          row.id as string,
    programId:   row.programId as string,
    userId:      row.userId as string,
    userName:    row.userName as string | null,
    userEmail:   row.userEmail as string | null,
    status:      row.status as TrainingRecord['status'],
    score:       row.score === null || row.score === undefined ? null : Number(row.score),
    assignedAt:  new Date(row.assignedAt as string),
    dueDate:     row.dueDate ? new Date(row.dueDate as string) : null,
    completedAt: row.completedAt ? new Date(row.completedAt as string) : null,
    createdAt:   new Date(row.createdAt as string),
  };
}

export const trainingRepository = {
  async findAll(tx: Tx, filters: ListTrainingsInput): Promise<TrainingProgramListResult> {
    const { page, limit, status, isMandatory, ownerId, q, category, sortBy, sortDir } = filters;

    const conditions: string[] = ['t.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }
    if (isMandatory !== undefined) { conditions.push(`t.is_mandatory = $${idx++}`); params.push(isMandatory); }
    if (ownerId) { conditions.push(`t.owner_id = $${idx++}::uuid`); params.push(ownerId); }
    if (category) { conditions.push(`t.category ILIKE $${idx++}`); params.push(`%${category}%`); }
    if (q) {
      conditions.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx} OR t.provider ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const allowedSortCols: Record<string, string> = {
      title: 't.title', category: 't.category', provider: 't.provider',
      status: 't.status', created_at: 't.created_at', updated_at: 't.updated_at',
    };
    const orderCol = allowedSortCols[sortBy ?? 'title'] ?? 't.title';
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';

    const where = conditions.join(' AND ');
    const offset = ((page ?? 1) - 1) * (limit ?? 50);

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT
          t.id, t.title, t.description, t.category, t.provider,
          t.duration_minutes AS "durationMinutes",
          t.is_mandatory AS "isMandatory",
          t.frequency_days AS "frequencyDays",
          t.status,
          t.owner_id AS "ownerId",
          u.first_name || ' ' || u.last_name AS "ownerName",
          u.email AS "ownerEmail",
          t.created_by AS "createdBy", t.updated_by AS "updatedBy",
          t.created_at AS "createdAt", t.updated_at AS "updatedAt"
        FROM training_programs t
        LEFT JOIN global.users u ON u.id = t.owner_id
        WHERE ${where}
        ORDER BY ${orderCol} ${dir} NULLS LAST
        LIMIT ${limit ?? 50} OFFSET ${offset}
      `, ...params),
      tx.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) FROM training_programs t WHERE ${where}
      `, ...params),
    ]);

    return {
      programs: rows.map(mapRow),
      total:    Number(countRows[0].count),
      page:     page ?? 1,
      limit:    limit ?? 50,
    };
  },

  async findById(tx: Tx, id: string): Promise<TrainingProgram | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        t.id, t.title, t.description, t.category, t.provider,
        t.duration_minutes AS "durationMinutes",
        t.is_mandatory AS "isMandatory",
        t.frequency_days AS "frequencyDays",
        t.status,
        t.owner_id AS "ownerId",
        u.first_name || ' ' || u.last_name AS "ownerName",
        u.email AS "ownerEmail",
        t.created_by AS "createdBy", t.updated_by AS "updatedBy",
        t.created_at AS "createdAt", t.updated_at AS "updatedAt"
      FROM training_programs t
      LEFT JOIN global.users u ON u.id = t.owner_id
      WHERE t.id = ${id}::uuid AND t.deleted_at IS NULL
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async create(tx: Tx, input: CreateTrainingInput & { createdBy: string }): Promise<{ id: string }> {
    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO training_programs (
        title, description, category, provider, duration_minutes,
        is_mandatory, frequency_days, status, owner_id, created_by, updated_by
      ) VALUES (
        ${input.title},
        ${input.description ?? null},
        ${input.category ?? null},
        ${input.provider ?? null},
        ${input.durationMinutes ?? null},
        ${input.isMandatory ?? false},
        ${input.frequencyDays ?? null},
        ${input.status},
        ${input.ownerId ?? null}::uuid,
        ${input.createdBy}::uuid,
        ${input.createdBy}::uuid
      )
      RETURNING id
    `;
    return rows[0];
  },

  async update(tx: Tx, id: string, input: UpdateTrainingInput & { updatedBy: string }): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE training_programs SET
        title            = COALESCE(${input.title ?? null}, title),
        description      = CASE WHEN ${input.description !== undefined} THEN ${input.description ?? null} ELSE description END,
        category         = CASE WHEN ${input.category !== undefined} THEN ${input.category ?? null} ELSE category END,
        provider         = CASE WHEN ${input.provider !== undefined} THEN ${input.provider ?? null} ELSE provider END,
        duration_minutes = CASE WHEN ${input.durationMinutes !== undefined} THEN ${input.durationMinutes ?? null} ELSE duration_minutes END,
        is_mandatory     = COALESCE(${input.isMandatory ?? null}, is_mandatory),
        frequency_days   = CASE WHEN ${input.frequencyDays !== undefined} THEN ${input.frequencyDays ?? null} ELSE frequency_days END,
        status           = COALESCE(${input.status ?? null}, status),
        owner_id         = CASE WHEN ${input.ownerId !== undefined} THEN ${input.ownerId ?? null}::uuid ELSE owner_id END,
        updated_by       = ${input.updatedBy}::uuid,
        updated_at       = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async softDelete(tx: Tx, id: string, deletedBy: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE training_programs SET deleted_at = NOW(), updated_by = ${deletedBy}::uuid
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async findRecords(tx: Tx, programId: string): Promise<TrainingRecord[]> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        r.id, r.program_id AS "programId", r.user_id AS "userId",
        u.first_name || ' ' || u.last_name AS "userName",
        u.email AS "userEmail",
        r.status, r.score,
        r.assigned_at AS "assignedAt", r.due_date AS "dueDate",
        r.completed_at AS "completedAt", r.created_at AS "createdAt"
      FROM training_records r
      LEFT JOIN global.users u ON u.id = r.user_id
      WHERE r.program_id = ${programId}::uuid
      ORDER BY r.assigned_at DESC
    `;
    return rows.map(mapRecordRow);
  },

  async assignRecords(
    tx: Tx,
    programId: string,
    input: AssignTrainingRecordsInput,
  ): Promise<number> {
    let assigned = 0;
    for (const userId of input.userIds) {
      const result = await tx.$executeRaw`
        INSERT INTO training_records (program_id, user_id, status, due_date)
        VALUES (
          ${programId}::uuid,
          ${userId}::uuid,
          ${input.status},
          ${input.dueDate ?? null}::date
        )
        ON CONFLICT (program_id, user_id) DO NOTHING
      `;
      assigned += Number(result);
    }
    return assigned;
  },
};
