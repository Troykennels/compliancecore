import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { getAnalyticsOverview } from './analytics.controller';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

router.get('/overview', requirePermission('dashboard:read'), asyncHandler(getAnalyticsOverview));

export default router;
