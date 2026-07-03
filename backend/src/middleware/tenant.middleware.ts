import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { ForbiddenError, NotFoundError } from '../lib/errors';

// In-memory schema name cache to avoid a DB round-trip on every request.
// TTL: 5 minutes. Evicted on tenant update (via invalidateTenantCache).
const schemaCache = new Map<string, { schemaName: string; name: string; plan: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateTenantCache(tenantId: string): void {
  schemaCache.delete(tenantId);
}

// Resolves the active tenant from req.user.tenantId and attaches req.tenant.
// Must run after authenticate() middleware.
export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return next(new ForbiddenError('No active tenant on this session.'));
    }

    const cached = schemaCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      req.tenant = { id: tenantId, schemaName: cached.schemaName, name: cached.name, plan: cached.plan };
      return next();
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, isActive: true, deletedAt: null },
      select: { id: true, schemaName: true, name: true, plan: true },
    });

    if (!tenant || !tenant.schemaName) {
      return next(new NotFoundError('Tenant not found or not provisioned.'));
    }

    const entry = {
      schemaName: tenant.schemaName,
      name: tenant.name,
      plan: tenant.plan,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    schemaCache.set(tenantId, entry);

    req.tenant = { id: tenantId, schemaName: tenant.schemaName, name: tenant.name, plan: tenant.plan };
    next();
  } catch (err) {
    next(err);
  }
}
