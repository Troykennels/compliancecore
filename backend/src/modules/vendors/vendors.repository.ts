import { Prisma } from '@prisma/client';
import type { Vendor, VendorListResult, VendorAssessment } from './vendors.types';
import type {
  CreateVendorInput,
  UpdateVendorInput,
  ListVendorsInput,
  CreateVendorAssessmentInput,
} from './vendors.schema';

type Tx = Prisma.TransactionClient;

function mapRow(row: Record<string, unknown>): Vendor {
  return {
    id:               row.id as string,
    name:             row.name as string,
    description:      row.description as string | null,
    category:         row.category as string | null,
    website:          row.website as string | null,
    contactName:      row.contactName as string | null,
    contactEmail:     row.contactEmail as string | null,
    riskLevel:        row.riskLevel as Vendor['riskLevel'],
    status:           row.status as Vendor['status'],
    dataProcessed:    row.dataProcessed as string | null,
    servicesProvided: row.servicesProvided as string | null,
    ownerId:          row.ownerId as string | null,
    ownerName:        row.ownerName as string | null,
    ownerEmail:       row.ownerEmail as string | null,
    onboardedAt:      row.onboardedAt ? new Date(row.onboardedAt as string) : null,
    offboardedAt:     row.offboardedAt ? new Date(row.offboardedAt as string) : null,
    nextReviewDate:   row.nextReviewDate ? new Date(row.nextReviewDate as string) : null,
    createdBy:        row.createdBy as string | null,
    updatedBy:        row.updatedBy as string | null,
    createdAt:        new Date(row.createdAt as string),
    updatedAt:        new Date(row.updatedAt as string),
  };
}

function mapAssessmentRow(row: Record<string, unknown>): VendorAssessment {
  return {
    id:             row.id as string,
    vendorId:       row.vendorId as string,
    name:           row.name as string,
    status:         row.status as VendorAssessment['status'],
    score:          row.score === null || row.score === undefined ? null : Number(row.score),
    notes:          row.notes as string | null,
    assessedBy:     row.assessedBy as string | null,
    assessedByName: row.assessedByName as string | null,
    assessedAt:     row.assessedAt ? new Date(row.assessedAt as string) : null,
    dueDate:        row.dueDate ? new Date(row.dueDate as string) : null,
    createdAt:      new Date(row.createdAt as string),
  };
}

export const vendorsRepository = {
  async findAll(tx: Tx, filters: ListVendorsInput): Promise<VendorListResult> {
    const { page, limit, status, riskLevel, ownerId, q, category, sortBy, sortDir } = filters;

    const conditions: string[] = ['v.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (status) { conditions.push(`v.status = $${idx++}`); params.push(status); }
    if (riskLevel) { conditions.push(`v.risk_level = $${idx++}`); params.push(riskLevel); }
    if (ownerId) { conditions.push(`v.owner_id = $${idx++}::uuid`); params.push(ownerId); }
    if (category) { conditions.push(`v.category ILIKE $${idx++}`); params.push(`%${category}%`); }
    if (q) {
      conditions.push(`(v.name ILIKE $${idx} OR v.description ILIKE $${idx} OR v.category ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const allowedSortCols: Record<string, string> = {
      name: 'v.name', risk_level: 'v.risk_level', status: 'v.status',
      next_review_date: 'v.next_review_date', updated_at: 'v.updated_at',
    };
    const orderCol = allowedSortCols[sortBy ?? 'name'] ?? 'v.name';
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';

    const where = conditions.join(' AND ');
    const offset = ((page ?? 1) - 1) * (limit ?? 50);

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT
          v.id, v.name, v.description, v.category, v.website,
          v.contact_name AS "contactName", v.contact_email AS "contactEmail",
          v.risk_level AS "riskLevel", v.status,
          v.data_processed AS "dataProcessed", v.services_provided AS "servicesProvided",
          v.owner_id AS "ownerId",
          u.first_name || ' ' || u.last_name AS "ownerName",
          u.email AS "ownerEmail",
          v.onboarded_at AS "onboardedAt", v.offboarded_at AS "offboardedAt",
          v.next_review_date AS "nextReviewDate",
          v.created_by AS "createdBy", v.updated_by AS "updatedBy",
          v.created_at AS "createdAt", v.updated_at AS "updatedAt"
        FROM vendors v
        LEFT JOIN global.users u ON u.id = v.owner_id
        WHERE ${where}
        ORDER BY ${orderCol} ${dir} NULLS LAST
        LIMIT ${limit ?? 50} OFFSET ${offset}
      `, ...params),
      tx.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) FROM vendors v WHERE ${where}
      `, ...params),
    ]);

    return {
      vendors: rows.map(mapRow),
      total:   Number(countRows[0].count),
      page:    page ?? 1,
      limit:   limit ?? 50,
    };
  },

  async findById(tx: Tx, id: string): Promise<Vendor | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        v.id, v.name, v.description, v.category, v.website,
        v.contact_name AS "contactName", v.contact_email AS "contactEmail",
        v.risk_level AS "riskLevel", v.status,
        v.data_processed AS "dataProcessed", v.services_provided AS "servicesProvided",
        v.owner_id AS "ownerId",
        u.first_name || ' ' || u.last_name AS "ownerName",
        u.email AS "ownerEmail",
        v.onboarded_at AS "onboardedAt", v.offboarded_at AS "offboardedAt",
        v.next_review_date AS "nextReviewDate",
        v.created_by AS "createdBy", v.updated_by AS "updatedBy",
        v.created_at AS "createdAt", v.updated_at AS "updatedAt"
      FROM vendors v
      LEFT JOIN global.users u ON u.id = v.owner_id
      WHERE v.id = ${id}::uuid AND v.deleted_at IS NULL
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async create(tx: Tx, input: CreateVendorInput & { createdBy: string }): Promise<{ id: string }> {
    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO vendors (
        name, description, category, website, contact_name, contact_email,
        risk_level, status, data_processed, services_provided, owner_id,
        onboarded_at, offboarded_at, next_review_date, created_by, updated_by
      ) VALUES (
        ${input.name},
        ${input.description ?? null},
        ${input.category ?? null},
        ${input.website ?? null},
        ${input.contactName ?? null},
        ${input.contactEmail || null},
        ${input.riskLevel},
        ${input.status},
        ${input.dataProcessed ?? null},
        ${input.servicesProvided ?? null},
        ${input.ownerId ?? null}::uuid,
        ${input.onboardedAt ?? null}::date,
        ${input.offboardedAt ?? null}::date,
        ${input.nextReviewDate ?? null}::date,
        ${input.createdBy}::uuid,
        ${input.createdBy}::uuid
      )
      RETURNING id
    `;
    return rows[0];
  },

  async update(tx: Tx, id: string, input: UpdateVendorInput & { updatedBy: string }): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE vendors SET
        name              = COALESCE(${input.name ?? null}, name),
        description       = CASE WHEN ${input.description !== undefined} THEN ${input.description ?? null} ELSE description END,
        category          = CASE WHEN ${input.category !== undefined} THEN ${input.category ?? null} ELSE category END,
        website           = CASE WHEN ${input.website !== undefined} THEN ${input.website ?? null} ELSE website END,
        contact_name      = CASE WHEN ${input.contactName !== undefined} THEN ${input.contactName ?? null} ELSE contact_name END,
        contact_email     = CASE WHEN ${input.contactEmail !== undefined} THEN ${input.contactEmail || null} ELSE contact_email END,
        risk_level        = COALESCE(${input.riskLevel ?? null}, risk_level),
        status            = COALESCE(${input.status ?? null}, status),
        data_processed    = CASE WHEN ${input.dataProcessed !== undefined} THEN ${input.dataProcessed ?? null} ELSE data_processed END,
        services_provided = CASE WHEN ${input.servicesProvided !== undefined} THEN ${input.servicesProvided ?? null} ELSE services_provided END,
        owner_id          = CASE WHEN ${input.ownerId !== undefined} THEN ${input.ownerId ?? null}::uuid ELSE owner_id END,
        onboarded_at      = CASE WHEN ${input.onboardedAt !== undefined} THEN ${input.onboardedAt ?? null}::date ELSE onboarded_at END,
        offboarded_at     = CASE WHEN ${input.offboardedAt !== undefined} THEN ${input.offboardedAt ?? null}::date ELSE offboarded_at END,
        next_review_date  = CASE WHEN ${input.nextReviewDate !== undefined} THEN ${input.nextReviewDate ?? null}::date ELSE next_review_date END,
        updated_by        = ${input.updatedBy}::uuid,
        updated_at        = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async softDelete(tx: Tx, id: string, deletedBy: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE vendors SET deleted_at = NOW(), updated_by = ${deletedBy}::uuid
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async findAssessments(tx: Tx, vendorId: string): Promise<VendorAssessment[]> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        a.id, a.vendor_id AS "vendorId", a.name, a.status, a.score, a.notes,
        a.assessed_by AS "assessedBy",
        u.first_name || ' ' || u.last_name AS "assessedByName",
        a.assessed_at AS "assessedAt", a.due_date AS "dueDate", a.created_at AS "createdAt"
      FROM vendor_assessments a
      LEFT JOIN global.users u ON u.id = a.assessed_by
      WHERE a.vendor_id = ${vendorId}::uuid
      ORDER BY a.created_at DESC
    `;
    return rows.map(mapAssessmentRow);
  },

  async createAssessment(
    tx: Tx,
    vendorId: string,
    input: CreateVendorAssessmentInput & { assessedBy: string },
  ): Promise<{ id: string }> {
    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO vendor_assessments (
        vendor_id, name, status, score, notes, assessed_by, assessed_at, due_date
      ) VALUES (
        ${vendorId}::uuid,
        ${input.name},
        ${input.status},
        ${input.score ?? null},
        ${input.notes ?? null},
        ${input.assessedBy}::uuid,
        ${input.assessedAt ?? null}::timestamptz,
        ${input.dueDate ?? null}::date
      )
      RETURNING id
    `;
    return rows[0];
  },

  async findAssessmentById(tx: Tx, vendorId: string, id: string): Promise<VendorAssessment | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        a.id, a.vendor_id AS "vendorId", a.name, a.status, a.score, a.notes,
        a.assessed_by AS "assessedBy",
        u.first_name || ' ' || u.last_name AS "assessedByName",
        a.assessed_at AS "assessedAt", a.due_date AS "dueDate", a.created_at AS "createdAt"
      FROM vendor_assessments a
      LEFT JOIN global.users u ON u.id = a.assessed_by
      WHERE a.id = ${id}::uuid AND a.vendor_id = ${vendorId}::uuid
    `;
    return rows[0] ? mapAssessmentRow(rows[0]) : null;
  },
};
