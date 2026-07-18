import { Prisma } from '@prisma/client';
import type { Framework, FrameworkCategory, FrameworkDetail } from './frameworks.types';

type Tx = Prisma.TransactionClient;

function mapFramework(row: Record<string, unknown>): Framework {
  return {
    id:                  row.id as string,
    code:                row.code as string,
    name:                row.name as string,
    shortName:           row.shortName as string | null,
    version:             row.version as string | null,
    jurisdiction:        row.jurisdiction as string | null,
    issuingBody:         row.issuingBody as string | null,
    description:         row.description as string | null,
    isActive:            row.isActive as boolean,
    effectiveDate:       row.effectiveDate ? new Date(row.effectiveDate as string) : null,
    categoryCount:       Number(row.categoryCount ?? 0),
    adoptedControlCount: Number(row.adoptedControlCount ?? 0),
  };
}

function mapCategory(row: Record<string, unknown>): FrameworkCategory {
  return {
    id:          row.id as string,
    frameworkId: row.frameworkId as string,
    code:        row.code as string,
    name:        row.name as string,
    description: row.description as string | null,
    sortOrder:   Number(row.sortOrder ?? 0),
  };
}

export const frameworksRepository = {
  // List all shared frameworks with a category count and this tenant's
  // adopted-control count per framework (LEFT JOIN on the tenant controls table).
  async findAll(tx: Tx): Promise<Framework[]> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        f.id, f.code, f.name,
        f.short_name     AS "shortName",
        f.version,
        f.jurisdiction,
        f.issuing_body   AS "issuingBody",
        f.description,
        f.is_active      AS "isActive",
        f.effective_date AS "effectiveDate",
        COALESCE(cat.category_count, 0)  AS "categoryCount",
        COALESCE(ctl.adopted_count, 0)   AS "adoptedControlCount"
      FROM framework_data.frameworks f
      LEFT JOIN (
        SELECT framework_id, COUNT(*)::int AS category_count
        FROM framework_data.framework_categories
        GROUP BY framework_id
      ) cat ON cat.framework_id = f.id
      LEFT JOIN (
        SELECT framework_id, COUNT(*)::int AS adopted_count
        FROM controls
        WHERE deleted_at IS NULL AND framework_id IS NOT NULL
        GROUP BY framework_id
      ) ctl ON ctl.framework_id = f.id
      WHERE f.deleted_at IS NULL
      ORDER BY f.name ASC
    `;
    return rows.map(mapFramework);
  },

  async findById(tx: Tx, id: string): Promise<FrameworkDetail | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        f.id, f.code, f.name,
        f.short_name     AS "shortName",
        f.version,
        f.jurisdiction,
        f.issuing_body   AS "issuingBody",
        f.description,
        f.is_active      AS "isActive",
        f.effective_date AS "effectiveDate",
        COALESCE(cat.category_count, 0)  AS "categoryCount",
        COALESCE(ctl.adopted_count, 0)   AS "adoptedControlCount"
      FROM framework_data.frameworks f
      LEFT JOIN (
        SELECT framework_id, COUNT(*)::int AS category_count
        FROM framework_data.framework_categories
        GROUP BY framework_id
      ) cat ON cat.framework_id = f.id
      LEFT JOIN (
        SELECT framework_id, COUNT(*)::int AS adopted_count
        FROM controls
        WHERE deleted_at IS NULL AND framework_id IS NOT NULL
        GROUP BY framework_id
      ) ctl ON ctl.framework_id = f.id
      WHERE f.id = ${id}::uuid AND f.deleted_at IS NULL
    `;
    if (!rows[0]) return null;

    const categories = await frameworksRepository.findCategories(tx, id);
    return { ...mapFramework(rows[0]), categories };
  },

  async findCategories(tx: Tx, frameworkId: string): Promise<FrameworkCategory[]> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        id,
        framework_id AS "frameworkId",
        code, name, description,
        sort_order   AS "sortOrder"
      FROM framework_data.framework_categories
      WHERE framework_id = ${frameworkId}::uuid
      ORDER BY sort_order ASC, code ASC
    `;
    return rows.map(mapCategory);
  },

  // Returns the set of control_refs already present in this tenant for a framework,
  // so adoption can skip categories that were already adopted.
  async existingControlRefs(tx: Tx, frameworkId: string): Promise<Set<string>> {
    const rows = await tx.$queryRaw<{ controlRef: string }[]>`
      SELECT control_ref AS "controlRef"
      FROM controls
      WHERE framework_id = ${frameworkId}::uuid AND deleted_at IS NULL
    `;
    return new Set(rows.map((r) => r.controlRef));
  },

  // Insert one starter control from a framework category. ON CONFLICT DO NOTHING
  // guards against any partial unique index on control_ref; the service also
  // pre-filters via existingControlRefs. Returns 1 if a row was inserted, else 0.
  async insertStarterControl(
    tx: Tx,
    input: {
      frameworkId: string;
      controlRef: string;
      title: string;
      description: string | null;
      createdBy: string;
    },
  ): Promise<number> {
    const result = await tx.$executeRaw`
      INSERT INTO controls (
        framework_id, control_ref, title, description,
        criticality, implementation_status, created_by, updated_by
      ) VALUES (
        ${input.frameworkId}::uuid,
        ${input.controlRef},
        ${input.title},
        ${input.description},
        'medium',
        'not_implemented',
        ${input.createdBy}::uuid,
        ${input.createdBy}::uuid
      )
      ON CONFLICT DO NOTHING
    `;
    return result;
  },
};
