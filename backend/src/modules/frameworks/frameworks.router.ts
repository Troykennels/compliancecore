import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './frameworks.controller';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

// Frameworks feed the controls module, so they reuse the controls permissions.
router.get('/',            requirePermission('controls:read'),  asyncHandler(ctrl.listFrameworks));
router.get('/:id',         requirePermission('controls:read'),  asyncHandler(ctrl.getFramework));
router.post('/:id/adopt',  requirePermission('controls:write'), asyncHandler(ctrl.adoptFramework));

export default router;
