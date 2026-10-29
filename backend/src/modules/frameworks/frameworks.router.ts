import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement, enforceLimit } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { countAdoptedFrameworks } from '../../lib/usage-counts';
import * as ctrl from './frameworks.controller';
import { implementationRouter } from './implementation.router';
import { complianceRecordsRouter } from './compliance-records.router';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());
router.use(complianceRecordsRouter);
router.use(implementationRouter);

// Frameworks feed the controls module, so they reuse the controls permissions.
router.get('/',            requirePermission('controls:read'),  asyncHandler(ctrl.listFrameworks));
router.get('/:id',         requirePermission('controls:read'),  asyncHandler(ctrl.getFramework));
// The framework allowance is one of the two things the pricing page sells an
// upgrade on, and it was resolved and displayed but never checked — a ₦25,000
// Starter tenant could adopt all eighteen. Re-adopting a framework the tenant
// already has stays allowed: it is idempotent and consumes no new allowance.
router.post(
  '/:id/adopt',
  requirePermission('controls:write'),
  enforceLimit('frameworks', countAdoptedFrameworks, {
    // The id in the path is the framework being adopted. If its controls are
    // already present this is a no-op re-adoption, not a new framework.
    skipIf: async (req) => ctrl.isFrameworkAlreadyAdopted(req),
  }),
  asyncHandler(ctrl.adoptFramework),
);

/*
  Removing an adopted framework.

  QA's only outright failure: adoption was a one-way door, so a framework picked
  by mistake could only be undone by contacting support. No allowance guard here
  — giving a seat back is never something to ration — but `controls:delete`
  rather than `controls:write`, because this withdraws a whole control set from
  the organisation's compliance scope and that is a heavier act than editing one.

  DELETE on the same path that adopts it, so the pair reads as one toggle.
*/
router.get(
  '/:id/adopt/impact',
  requirePermission('controls:read'),
  asyncHandler(ctrl.getUnadoptImpact),
);
router.delete(
  '/:id/adopt',
  requirePermission('controls:delete'),
  asyncHandler(ctrl.unadoptFramework),
);

export default router;
