import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement, enforceLimit } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { countAdoptedFrameworks } from '../../lib/usage-counts';
import * as ctrl from './frameworks.controller';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

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

export default router;
