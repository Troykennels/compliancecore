import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { getDashboardSummary } from './dashboard.controller';

const router = Router();
router.use(authenticate(), resolveTenant);
router.get('/', asyncHandler(getDashboardSummary));

export default router;
