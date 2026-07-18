import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { createRiskSchema, updateRiskSchema, listRisksSchema } from './risks.schema';
import * as ctrl from './risks.controller';

const router = Router();
router.use(authenticate(), resolveTenant);

router.get('/',       requirePermission('risks:read'),   validateQuery(listRisksSchema), asyncHandler(ctrl.listRisks));
router.get('/stats',  requirePermission('risks:read'),   asyncHandler(ctrl.getRiskStats));
router.get('/:id',    requirePermission('risks:read'),   asyncHandler(ctrl.getRisk));
router.post('/',      requirePermission('risks:write'),  validate(createRiskSchema), asyncHandler(ctrl.createRisk));
router.patch('/:id',  requirePermission('risks:write'),  validate(updateRiskSchema), asyncHandler(ctrl.updateRisk));
router.delete('/:id', requirePermission('risks:delete'), asyncHandler(ctrl.deleteRisk));

export default router;
