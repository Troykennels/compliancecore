import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getEntitlement, LIMIT_LABELS, exceedsLimit, type LimitMetric } from '../lib/entitlements';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

// Methods that create or change data. GET/HEAD/OPTIONS are always allowed —
// see the reasoning in lib/entitlements.ts about not locking customers out of
// their own compliance records.
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Paths that must keep working even in read_only, because they are how a
// customer gets *out* of read_only. Blocking checkout when someone's trial
// expires would make the product impossible to pay for.
const ALWAYS_ALLOWED = [
  '/api/payments',
  '/api/billing/subscription',
  '/api/billing/payment-methods',
  '/api/auth',
];

/**
 * Blocks writes for tenants whose trial or subscription has lapsed beyond the
 * grace period. Attaches req.entitlement for downstream handlers either way, so
 * limit checks and the UI banner can reuse it without a second lookup.
 *
 * Must run after resolveTenant.
 */
export function enforceEntitlement(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const tenantId = req.tenant?.id;
    if (!tenantId) return next();

    try {
      const ent = await getEntitlement(tenantId);
      req.entitlement = ent;

      if (!WRITE_METHODS.has(req.method)) return next();
      if (ALWAYS_ALLOWED.some((p) => req.originalUrl.startsWith(p))) return next();
      if (ent.canWrite) return next();

      return next(
        new AppError(
          'Your subscription has expired. Choose a plan to continue making changes — your existing data stays available to view and export.',
          402,
          'SUBSCRIPTION_REQUIRED',
        ),
      );
    } catch (err) {
      // Never let an entitlement lookup failure take the API down. Failing open
      // risks a little unpaid usage; failing closed would block paying
      // customers because of our own outage.
      logger.error({ err, tenantId }, 'Entitlement check failed — allowing request');
      return next();
    }
  };
}

/**
 * Blocks a create when the tenant is already at its plan limit.
 *
 * `countCurrent` is passed in rather than queried here because the number lives
 * in each module's own tenant schema, which only that module knows how to read.
 */
export function enforceLimit(
  metric: LimitMetric,
  countCurrent: (req: Request) => Promise<number>,
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const ent = req.entitlement ?? (req.tenant?.id ? await getEntitlement(req.tenant.id) : null);
      if (!ent) return next();

      const limit = ent.limits[metric];
      if (limit === null) return next();

      const current = await countCurrent(req);
      if (!exceedsLimit(ent, metric, current)) return next();

      return next(
        new AppError(
          `Your ${ent.planName ?? 'current'} plan includes ${limit} ${LIMIT_LABELS[metric]} and you are using ${current}. Upgrade your plan to add more.`,
          402,
          'PLAN_LIMIT_REACHED',
          { metric, limit, current },
        ),
      );
    } catch (err) {
      logger.error({ err, metric }, 'Plan limit check failed — allowing request');
      return next();
    }
  };
}
