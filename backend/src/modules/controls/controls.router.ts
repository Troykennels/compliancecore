import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { createControlSchema, updateControlSchema, listControlsSchema } from './controls.schema';
import * as ctrl from './controls.controller';

const router = Router();
router.use(authenticate(), resolveTenant);

router.get('/',          requirePermission('controls:read'),  validateQuery(listControlsSchema), asyncHandler(ctrl.listControls));
router.get('/overdue',   requirePermission('controls:read'),  asyncHandler(ctrl.getOverdueControls));
router.get('/stats',     requirePermission('controls:read'),  asyncHandler(ctrl.getControlStatusCounts));
router.get('/:id',       requirePermission('controls:read'),  asyncHandler(ctrl.getControl));
router.post('/',         requirePermission('controls:write'), validate(createControlSchema), asyncHandler(ctrl.createControl));
router.patch('/:id',     requirePermission('controls:write'), validate(updateControlSchema), asyncHandler(ctrl.updateControl));
router.post('/:id/review', requirePermission('controls:write'), asyncHandler(ctrl.markReviewed));
router.delete('/:id',    requirePermission('controls:delete'), asyncHandler(ctrl.deleteControl));

export default router;
