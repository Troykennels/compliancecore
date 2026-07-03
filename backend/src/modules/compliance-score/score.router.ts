import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './score.controller';

const router = Router();
router.use(authenticate(), resolveTenant);

router.get('/current',  requirePermission('controls:read'), asyncHandler(ctrl.getCurrentScore));
router.get('/trend',    requirePermission('controls:read'), asyncHandler(ctrl.getScoreTrend));
router.get('/snapshot', requirePermission('controls:read'), asyncHandler(ctrl.getLatestSnapshot));
router.post('/snapshot', requirePermission('controls:write'), asyncHandler(ctrl.triggerSnapshot));

export default router;
