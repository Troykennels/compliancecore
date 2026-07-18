import { Prisma } from '@prisma/client';
import type { Risk, RiskListResult, RiskStatusCount, RiskLevelCount } from './risks.types';
import type { CreateRiskInput, UpdateRiskInput, ListRisksInput } from './risks.schema';

type Tx = Prisma.TransactionClient;

function mapRow(row: Record<string, unknown>): Risk {
  return {
    id:                 row.id as string,
    title:              row.title as string,
    description:        row.description as string | null,
    category:           row.category as Risk['category'],
    inherentLikelihood: Number(row.inherentLikelihood),
    inherentImpact:     Number(row.inherentImpact),
    inherentScore:      Number(row.inherentScore),
    treatment:          row.treatment as Risk['treatment'],
    residualLikelihood: Number(row.residualLikelihood),
    residualImpact:     Number(row.residualImpact),
    residualScore:      Number(row.residualScore),
    status:             row.status as Risk['status'],
    mitigationPlan:     row.mitigationPlan as string | null,
    ownerId:            row.ownerId as string | null,
    ownerName:          row.ownerName as string | null,
    ownerEmail:         row.ownerEmail as string | null,
    reviewDate:         row.reviewDate ? new Date(row.reviewDate as string) : null,
    nextReviewDate:     row.nextReviewDate ? new Date(row.nextReviewDate as string) : null,
    createdBy:          row.createdBy as string | null,
    createdAt:          new Date(row.createdAt as string),
    updatedAt:          new Date(row.updatedAt as string),
  };
}

const SELECT_COLS = `
  r.id, r.title, r.description, r.category,
  r.inherent_likelihood AS "inherentLikelihood",
  r.inherent_impact     AS "inherentImpact",
  r.inherent_score      AS "inherentScore",
  r.treatment,
  r.residual_likelihood AS "residualLikelihood",
  r.residual_impact     AS "residualImpact",
  r.residual_score      AS "residualScore",
  r.status, r.mitigation_plan AS "mitigationPlan",
  r.owner_id AS "ownerId",
  u.first_name || ' ' || u.last_name AS "ownerName",
  u.email AS "ownerEmail",
  r.review_date AS "reviewDate", r.next_review_date AS "nextReviewDate",
  r.created_by AS "createdBy", r.created_at AS "createdAt", r.updated_at AS "updatedAt"
`;

export const risksRepository = {
  async findAll(tx: Tx, filters: ListRisksInput): Promise<RiskListResult> {
    const { page, limit, status, category, ownerId, q, sortBy, sortDir } = filters;

    const conditions: string[] = ['r.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (status) { conditions.push(`r.status = $${idx++}`); params.push(status); }
    if (category) { conditions.push(`r.category = $${idx++}`); params.push(category); }
    if (ownerId) { conditions.push(`r.owner_id = $${idx++}::uuid`); params.push(ownerId); }
    if (q) {
      conditions.push(`(r.title ILIKE $${idx} OR r.description ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const allowedSortCols: Record<string, string> = {
      title: 'r.title', category: 'r.category',
      inherent_score: 'r.inherent_score', residual_score: 'r.residual_score',
      status: 'r.status', updated_at: 'r.updated_at',
    };
    const orderCol = allowedSortCols[sortBy ?? 'inherent_score'] ?? 'r.inherent_score';
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

    const where = conditions.join(' AND ');
    const offset = ((page ?? 1) - 1) * (limit ?? 50);

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT ${SELECT_COLS}
        FROM risks r
        LEFT JOIN global.users u ON u.id = r.owner_id
        WHERE ${where}
        ORDER BY ${orderCol} ${dir} NULLS LAST
        LIMIT ${limit ?? 50} OFFSET ${offset}
      `, ...params),
      tx.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) FROM risks r WHERE ${where}
      `, ...params),
    ]);

    return {
      risks: rows.map(mapRow),
      total: Number(countRows[0].count),
      page:  page ?? 1,
      limit: limit ?? 50,
    };
  },

  async findById(tx: Tx, id: string): Promise<Risk | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        r.id, r.title, r.description, r.category,
        r.inherent_likelihood AS "inherentLikelihood",
        r.inherent_impact     AS "inherentImpact",
        r.inherent_score      AS "inherentScore",
        r.treatment,
        r.residual_likelihood AS "residualLikelihood",
        r.residual_impact     AS "residualImpact",
        r.residual_score      AS "residualScore",
        r.status, r.mitigation_plan AS "mitigationPlan",
        r.owner_id AS "ownerId",
        u.first_name || ' ' || u.last_name AS "ownerName",
        u.email AS "ownerEmail",
        r.review_date AS "reviewDate", r.next_review_date AS "nextReviewDate",
        r.created_by AS "createdBy", r.created_at AS "createdAt", r.updated_at AS "updatedAt"
      FROM risks r
      LEFT JOIN global.users u ON u.id = r.owner_id
      WHERE r.id = ${id}::uuid AND r.deleted_at IS NULL
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async create(tx: Tx, input: CreateRiskInput & { createdBy: string }): Promise<{ id: string }> {
    const inherentLikelihood = input.inherentLikelihood ?? 3;
    const inherentImpact     = input.inherentImpact ?? 3;
    const residualLikelihood = input.residualLikelihood ?? 3;
    const residualImpact     = input.residualImpact ?? 3;
    // Scores computed server-side — never trust the client.
    const inherentScore = inherentLikelihood * inherentImpact;
    const residualScore = residualLikelihood * residualImpact;

    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO risks (
        title, description, category,
        inherent_likelihood, inherent_impact, inherent_score,
        treatment, residual_likelihood, residual_impact, residual_score,
        status, mitigation_plan, owner_id, review_date, next_review_date,
        created_by, updated_by
      ) VALUES (
        ${input.title},
        ${input.description ?? null},
        ${input.category},
        ${inherentLikelihood},
        ${inherentImpact},
        ${inherentScore},
        ${input.treatment},
        ${residualLikelihood},
        ${residualImpact},
        ${residualScore},
        ${input.status},
        ${input.mitigationPlan ?? null},
        ${input.ownerId ?? null}::uuid,
        ${input.reviewDate ?? null}::date,
        ${input.nextReviewDate ?? null}::date,
        ${input.createdBy}::uuid,
        ${input.createdBy}::uuid
      )
      RETURNING id
    `;
    return rows[0];
  },

  async update(tx: Tx, id: string, input: UpdateRiskInput & { updatedBy: string }): Promise<boolean> {
    // Scores recomputed server-side from the effective likelihood/impact values.
    const result = await tx.$executeRaw`
      UPDATE risks SET
        title               = COALESCE(${input.title ?? null}, title),
        description         = CASE WHEN ${input.description !== undefined} THEN ${input.description ?? null} ELSE description END,
        category            = COALESCE(${input.category ?? null}, category),
        inherent_likelihood = COALESCE(${input.inherentLikelihood ?? null}, inherent_likelihood),
        inherent_impact     = COALESCE(${input.inherentImpact ?? null}, inherent_impact),
        inherent_score      = COALESCE(${input.inherentLikelihood ?? null}, inherent_likelihood) * COALESCE(${input.inherentImpact ?? null}, inherent_impact),
        treatment           = COALESCE(${input.treatment ?? null}, treatment),
        residual_likelihood = COALESCE(${input.residualLikelihood ?? null}, residual_likelihood),
        residual_impact     = COALESCE(${input.residualImpact ?? null}, residual_impact),
        residual_score      = COALESCE(${input.residualLikelihood ?? null}, residual_likelihood) * COALESCE(${input.residualImpact ?? null}, residual_impact),
        status              = COALESCE(${input.status ?? null}, status),
        mitigation_plan     = CASE WHEN ${input.mitigationPlan !== undefined} THEN ${input.mitigationPlan ?? null} ELSE mitigation_plan END,
        owner_id            = CASE WHEN ${input.ownerId !== undefined} THEN ${input.ownerId ?? null}::uuid ELSE owner_id END,
        review_date         = CASE WHEN ${input.reviewDate !== undefined} THEN ${input.reviewDate ?? null}::date ELSE review_date END,
        next_review_date    = CASE WHEN ${input.nextReviewDate !== undefined} THEN ${input.nextReviewDate ?? null}::date ELSE next_review_date END,
        updated_by          = ${input.updatedBy}::uuid,
        updated_at          = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async softDelete(tx: Tx, id: string, deletedBy: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE risks SET deleted_at = NOW(), updated_by = ${deletedBy}::uuid
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async getStatusCounts(tx: Tx): Promise<RiskStatusCount[]> {
    const rows = await tx.$queryRaw<RiskStatusCount[]>`
      SELECT status, COUNT(*)::int AS count
      FROM risks
      WHERE deleted_at IS NULL
      GROUP BY status
    `;
    return rows;
  },

  async getLevelCounts(tx: Tx): Promise<RiskLevelCount[]> {
    const rows = await tx.$queryRaw<RiskLevelCount[]>`
      SELECT
        CASE
          WHEN inherent_score >= 15 THEN 'high'
          WHEN inherent_score >= 8  THEN 'medium'
          ELSE 'low'
        END AS level,
        COUNT(*)::int AS count
      FROM risks
      WHERE deleted_at IS NULL
      GROUP BY 1
    `;
    return rows;
  },
};
