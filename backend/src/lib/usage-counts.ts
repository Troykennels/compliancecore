import type { Request } from 'express';
import { prisma, withTenantSchema } from './prisma';

// Current usage per limited metric, for enforceLimit().
//
// Each counter lives here rather than in enforceLimit because the numbers come
// from different places: team members are global (tenant_memberships), while
// branches and departments live inside the tenant's own schema and can only be
// read through withTenantSchema.
//
// Counts must match what the plan limit means to a customer, so soft-deleted
// and deactivated rows are excluded — a plan that says "3 team members" should
// not be consumed by someone who was removed.

export async function countUsers(req: Request): Promise<number> {
  // Falls back to the token's tenantId: the settings router deliberately does
  // not run resolveTenant (accept-invite has to work for a user who is not a
  // member yet), so req.tenant is undefined on the invite route this guards.
  const tenantId = req.tenant?.id ?? req.user?.tenantId;
  if (!tenantId) return 0;
  return prisma.tenantMembership.count({
    where: { tenantId, deletedAt: null, isActive: true },
  });
}

async function countInTenantTable(req: Request, table: 'branches' | 'departments'): Promise<number> {
  const schemaName = req.tenant?.schemaName;
  if (!schemaName) return 0;
  return withTenantSchema(schemaName, async (tx) => {
    // Table name is a literal from the union type above, never user input.
    const rows = (await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM ${table} WHERE deleted_at IS NULL`,
    )) as Array<{ n: number }>;
    return rows[0]?.n ?? 0;
  });
}

export const countBranches = (req: Request): Promise<number> => countInTenantTable(req, 'branches');
export const countDepartments = (req: Request): Promise<number> => countInTenantTable(req, 'departments');

/**
 * Distinct frameworks the tenant has adopted.
 *
 * Counted from the controls table rather than a join table: adopting a
 * framework is what creates its controls, so this is the same thing a customer
 * means by "how many frameworks am I running".
 */
export async function countAdoptedFrameworks(req: Request): Promise<number> {
  const schemaName = req.tenant?.schemaName;
  if (!schemaName) return 0;
  return withTenantSchema(schemaName, async (tx) => {
    const rows = (await tx.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT framework_id)::int AS n
         FROM controls
        WHERE deleted_at IS NULL AND framework_id IS NOT NULL`,
    )) as Array<{ n: number }>;
    return rows[0]?.n ?? 0;
  });
}

/**
 * Evidence storage in use, in whole GB, rounded down.
 *
 * Rounded DOWN on purpose: a tenant on a 5 GB plan holding 5.4 GB counts as 5
 * and is blocked from adding more, rather than being told they are already over
 * a limit they were allowed to reach.
 */
export async function countEvidenceGb(req: Request): Promise<number> {
  const schemaName = req.tenant?.schemaName;
  if (!schemaName) return 0;
  return withTenantSchema(schemaName, async (tx) => {
    // Summed over VERSIONS, not evidence records: the bytes live on
    // evidence_versions, and every version is a real object in S3 that the
    // tenant is actually consuming. Versions belonging to soft-deleted evidence
    // are excluded, since deleting an item should give the space back.
    const rows = (await tx.$queryRawUnsafe(
      `SELECT COALESCE(SUM(v.file_size_bytes), 0)::bigint AS bytes
         FROM evidence_versions v
         JOIN evidence e ON e.id = v.evidence_id
        WHERE e.deleted_at IS NULL`,
    )) as Array<{ bytes: bigint | string }>;
    const bytes = Number(rows[0]?.bytes ?? 0);
    return Math.floor(bytes / (1024 ** 3));
  });
}
