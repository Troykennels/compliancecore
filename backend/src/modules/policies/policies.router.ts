import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { createPolicySchema, updatePolicySchema, listPoliciesSchema } from './policies.schema';
import * as ctrl from './policies.controller';

const router = Router();
router.use(authenticate(), resolveTenant);

router.get('/',            requirePermission('policies:read'),  validateQuery(listPoliciesSchema), asyncHandler(ctrl.listPolicies));
router.get('/:id',         requirePermission('policies:read'),  asyncHandler(ctrl.getPolicy));
router.post('/',           requirePermission('policies:write'), validate(createPolicySchema), asyncHandler(ctrl.createPolicy));
router.patch('/:id',       requirePermission('policies:write'), validate(updatePolicySchema), asyncHandler(ctrl.updatePolicy));
router.post('/:id/publish', requirePermission('policies:write'), asyncHandler(ctrl.publishPolicy));
router.delete('/:id',      requirePermission('policies:delete'), asyncHandler(ctrl.deletePolicy));

export default router;
