import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  createAuditSchema,
  updateAuditSchema,
  listAuditsSchema,
  createFindingSchema,
  updateFindingSchema,
} from './audits.schema';
import * as ctrl from './audits.controller';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

router.get('/',                  requirePermission('audits:read'),   validateQuery(listAuditsSchema), asyncHandler(ctrl.listAudits));
router.get('/:id',               requirePermission('audits:read'),   asyncHandler(ctrl.getAudit));
router.post('/',                 requirePermission('audits:write'),  validate(createAuditSchema), asyncHandler(ctrl.createAudit));
router.patch('/:id',             requirePermission('audits:write'),  validate(updateAuditSchema), asyncHandler(ctrl.updateAudit));
router.delete('/:id',            requirePermission('audits:delete'), asyncHandler(ctrl.deleteAudit));

router.get('/:id/findings',      requirePermission('audits:read'),   asyncHandler(ctrl.listFindings));
router.post('/:id/findings',     requirePermission('audits:write'),  validate(createFindingSchema), asyncHandler(ctrl.createFinding));
router.patch('/findings/:findingId',  requirePermission('audits:write'),  validate(updateFindingSchema), asyncHandler(ctrl.updateFinding));
router.delete('/findings/:findingId', requirePermission('audits:delete'), asyncHandler(ctrl.deleteFinding));

export default router;
