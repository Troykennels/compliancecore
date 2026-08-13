import { Prisma } from '@prisma/client';
import type {
  Framework, FrameworkCategory, FrameworkDetail, FrameworkLibraryControl,
} from './frameworks.types';

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
    libraryControlCount: Number(row.libraryControlCount ?? 0),
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
        COALESCE(ctl.adopted_count, 0)   AS "adoptedControlCount",
        COALESCE(lib.library_count, 0)   AS "libraryControlCount"
      FROM framework_data.frameworks f
      LEFT JOIN (
        SELECT framework_id, COUNT(*)::int AS category_count
        FROM framework_data.framework_categories
        GROUP BY framework_id
      ) cat ON cat.framework_id = f.id
      LEFT JOIN (
        SELECT framework_id, COUNT(*)::int AS library_count
        FROM framework_data.framework_controls
        GROUP BY framework_id
      ) lib ON lib.framework_id = f.id
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
        COALESCE(ctl.adopted_count, 0)   AS "adoptedControlCount",
        COALESCE(lib.library_count, 0)   AS "libraryControlCount"
      FROM framework_data.frameworks f
      LEFT JOIN (
        SELECT framework_id, COUNT(*)::int AS category_count
        FROM framework_data.framework_categories
        GROUP BY framework_id
      ) cat ON cat.framework_id = f.id
      LEFT JOIN (
        SELECT framework_id, COUNT(*)::int AS library_count
        FROM framework_data.framework_controls
        GROUP BY framework_id
      ) lib ON lib.framework_id = f.id
      LEFT JOIN (
        SELECT framework_id, COUNT(*)::int AS adopted_count
        FROM controls
        WHERE deleted_at IS NULL AND framework_id IS NOT NULL
        GROUP BY framework_id
      ) ctl ON ctl.framework_id = f.id
      WHERE f.id = ${id}::uuid AND f.deleted_at IS NULL
    `;
    if (!rows[0]) return null;

    const [categories, controls] = await Promise.all([
      frameworksRepository.findCategories(tx, id),
      frameworksRepository.findControls(tx, id),
    ]);
    return { ...mapFramework(rows[0]), categories, controls };
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

  // The framework's published control library (ISO 27001 Annex A, SOC 2 TSC,
  // NDPR articles, …). This is what adoption actually copies into the tenant.
  async findControls(tx: Tx, frameworkId: string): Promise<FrameworkLibraryControl[]> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        fc.control_ref  AS "controlRef",
        fc.title,
        fc.description,
        fc.guidance,
        fc.sort_order   AS "sortOrder",
        c.code          AS "categoryCode",
        c.name          AS "categoryName"
      FROM framework_data.framework_controls fc
      LEFT JOIN framework_data.framework_categories c ON c.id = fc.category_id
      WHERE fc.framework_id = ${frameworkId}::uuid
      ORDER BY fc.sort_order ASC, fc.control_ref ASC
    `;
    return rows.map((r) => ({
      controlRef:   r.controlRef as string,
      title:        r.title as string,
      description:  (r.description as string | null) ?? null,
      guidance:     (r.guidance as string | null) ?? null,
      sortOrder:    Number(r.sortOrder ?? 0),
      categoryCode: (r.categoryCode as string | null) ?? null,
      categoryName: (r.categoryName as string | null) ?? null,
    }));
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

  /**
   * What removing this framework would cost, counted in one pass.
   *
   * `touched` deliberately errs towards caution: anything other than a control
   * still sitting at its adoption defaults counts as work. A false positive
   * costs the user one extra confirmation click; a false negative silently
   * discards somebody's audit preparation.
   *
   * Evidence is joined through the polymorphic evidence_links table, which is
   * how the Evidence Hub attaches a document to a control.
   */
  async unadoptImpact(tx: Tx, frameworkId: string): Promise<{
    controls: number; touched: number; implemented: number;
    withOwner: number; withNotes: number; withEvidence: number;
  }> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      WITH scoped AS (
        SELECT
          c.id,
          c.implementation_status <> 'not_implemented'                   AS is_implemented,
          c.owner_id IS NOT NULL                                         AS has_owner,
          (COALESCE(NULLIF(TRIM(c.implementation_notes), ''), NULLIF(TRIM(c.testing_notes), '')) IS NOT NULL)
                                                                         AS has_notes,
          (c.last_reviewed_at IS NOT NULL OR c.due_date IS NOT NULL)     AS has_dates,
          EXISTS (
            SELECT 1 FROM evidence_links el
             WHERE el.linked_type = 'control' AND el.linked_id = c.id
          )                                                              AS has_evidence
        FROM controls c
        WHERE c.framework_id = ${frameworkId}::uuid AND c.deleted_at IS NULL
      )
      SELECT
        COUNT(*)::int                                      AS "controls",
        COUNT(*) FILTER (
          WHERE is_implemented OR has_owner OR has_notes OR has_dates OR has_evidence
        )::int                                             AS "touched",
        COUNT(*) FILTER (WHERE is_implemented)::int        AS "implemented",
        COUNT(*) FILTER (WHERE has_owner)::int             AS "withOwner",
        COUNT(*) FILTER (WHERE has_notes)::int             AS "withNotes",
        COUNT(*) FILTER (WHERE has_evidence)::int          AS "withEvidence"
      FROM scoped
    `;
    const r = rows[0] ?? {};
    return {
      controls:     Number(r.controls ?? 0),
      touched:      Number(r.touched ?? 0),
      implemented:  Number(r.implemented ?? 0),
      withOwner:    Number(r.withOwner ?? 0),
      withNotes:    Number(r.withNotes ?? 0),
      withEvidence: Number(r.withEvidence ?? 0),
    };
  },

  /**
   * Remove a framework's controls from the tenant.
   *
   * SOFT delete, and that is the whole design. A hard delete would take the
   * control rows out from under everything that points at them by id — evidence
   * links, tasks, approvals, audit findings — none of which are real foreign
   * keys, because they are polymorphic. Setting deleted_at leaves every one of
   * those rows intact and resolvable, keeps the audit trail honest about what
   * was once in scope, and means an accidental removal is recoverable by an
   * operator with a single UPDATE rather than from a backup.
   *
   * It also frees the plan allowance for nothing extra: countAdoptedFrameworks
   * counts DISTINCT framework_id WHERE deleted_at IS NULL, so the seat is
   * released the moment this runs.
   */
  async softDeleteFrameworkControls(tx: Tx, frameworkId: string, actorId: string): Promise<number> {
    return tx.$executeRaw`
      UPDATE controls
         SET deleted_at = NOW(),
             updated_at = NOW(),
             updated_by = ${actorId}::uuid
       WHERE framework_id = ${frameworkId}::uuid
         AND deleted_at IS NULL
    `;
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
      category: string | null;
      guidance: string | null;
      createdBy: string;
    },
  ): Promise<number> {
    const result = await tx.$executeRaw`
      INSERT INTO controls (
        framework_id, control_ref, title, description, category, guidance,
        criticality, implementation_status, created_by, updated_by
      ) VALUES (
        ${input.frameworkId}::uuid,
        ${input.controlRef},
        ${input.title},
        ${input.description},
        ${input.category},
        ${input.guidance},
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
