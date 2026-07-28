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
