import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { getAnalyticsOverview } from './analytics.controller';

const router = Router();
router.use(authenticate(), resolveTenant);

router.get('/overview', requirePermission('dashboard:read'), asyncHandler(getAnalyticsOverview));

export default router;
