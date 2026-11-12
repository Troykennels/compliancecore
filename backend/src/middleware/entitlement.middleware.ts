import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getEntitlement, LIMIT_LABELS, exceedsLimit, type LimitMetric } from '../lib/entitlements';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { moduleForPath, LOCK_ALL_METHODS, MODULE_LABEL } from '../lib/plan-modules';
import { hasPermission } from './rbac.middleware';

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
  // Joining an organisation is how a person becomes able to act at all, and the
  // org's own state will govern what they can do once inside. Blocking the
  // acceptance itself just strands them on a broken link.
  '/api/settings/team/members/accept-invite',
  // Starting a NEW organisation must not be blocked by an old one that lapsed.
  // A new tenant gets its own trial, and the alternative is telling someone
  // they cannot become a customer again because they stopped being one.
  '/api/organizations/onboarding',
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
    // Falls back to the token's tenant, matching enforceLimit. The settings and
    // organizations routers authenticate without running resolveTenant, so
    // req.tenant is absent there even though the caller plainly belongs to a
    // tenant — reading only req.tenant meant this silently allowed everything
    // on exactly those two routers.
    const tenantId = req.tenant?.id ?? req.user?.tenantId;
    if (!tenantId) return next();

    try {
      const ent = await getEntitlement(tenantId);
      req.entitlement = ent;

      // The platform owner is not a customer of the platform. Without this,
      // ORION SOFT's own account is billed like any tenant: nagged to
      // subscribe, and eventually blocked from writing to the very product it
      // operates — including while investigating a customer's problem.
      if (req.user?.isSuperadmin) return next();

      // Plan module locks (catalogue 2026.2). A locked module's records stay
      // viewable and exportable; only creating or changing is refused. AI tools
      // refuse every request (each one is a paid generation).
      const module = moduleForPath(req.originalUrl);
      if (module && ent.lockedModules.includes(module)
        && (WRITE_METHODS.has(req.method) || LOCK_ALL_METHODS.has(module))) {
        const label = MODULE_LABEL[module] ?? module;
        const canBuy = hasPermission(req.user?.permissions ?? [], 'billing:write');
        return next(new AppError(
          canBuy
            ? `${label} is not included in your ${ent.planName ?? 'current'} plan. Upgrade in Plans and upgrade to use it; your existing records stay as they are.`
            : `${label} is not included in your organisation's plan. You can ask your administrator to upgrade from Plans and upgrade.`,
          402, 'PLAN_UPGRADE_REQUIRED', { module, label },
        ));
      }

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
      // Plan modules fail SAFELY (prompt section 6: never unlock a paid module by
      // accident); core work keeps failing open so our outage never locks a
      // customer out of their own records.
      if (moduleForPath(req.originalUrl) && !req.user?.isSuperadmin) {
        logger.error({ err, tenantId }, 'Entitlement check failed on a plan module — refusing for now');
        return next(new AppError('This feature is temporarily unavailable. Please try again in a moment.', 503, 'ENTITLEMENT_UNAVAILABLE'));
      }
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
  opts?: {
    /**
     * Skips the check when this request does not actually consume allowance —
     * re-adopting a framework the tenant already has, for instance, which is
     * idempotent. Without it, an at-limit tenant could not repeat a harmless
     * no-op action.
     */
    skipIf?: (req: Request) => Promise<boolean>;
  },
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (opts?.skipIf && (await opts.skipIf(req))) return next();
      // Same fallback as the counters: some routers authenticate without
      // running resolveTenant, so req.tenant may be absent even though the
      // caller clearly belongs to a tenant.
      const tenantId = req.tenant?.id ?? req.user?.tenantId;
      const ent = req.entitlement ?? (tenantId ? await getEntitlement(tenantId) : null);
      if (!ent) return next();

      // Same reasoning as enforceEntitlement: plan allowances are a commercial
      // construct, and the operator of the platform is not buying from it.
      if (req.user?.isSuperadmin) return next();

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
