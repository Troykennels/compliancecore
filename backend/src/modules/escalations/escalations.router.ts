import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validateUuidParam } from '../../middleware/validate-params.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './escalations.controller';

const router = Router();
router.use(authenticate(), resolveTenant);

// Rules
router.get('/rules',              requirePermission('escalations:read'),   asyncHandler(ctrl.listRules));
router.post('/rules',             requirePermission('escalations:manage'), asyncHandler(ctrl.createRule));
router.get('/rules/:id',          requirePermission('escalations:read'),   validateUuidParam('id'), asyncHandler(ctrl.getRule));
router.patch('/rules/:id',        requirePermission('escalations:manage'), validateUuidParam('id'), asyncHandler(ctrl.updateRule));
router.post('/rules/:id/toggle',  requirePermission('escalations:manage'), validateUuidParam('id'), asyncHandler(ctrl.toggleRule));
router.delete('/rules/:id',       requirePermission('escalations:manage'), validateUuidParam('id'), asyncHandler(ctrl.deleteRule));

// Events
router.get('/events',             requirePermission('escalations:read'),   asyncHandler(ctrl.listEvents));
router.post('/events/:id/resolve',requirePermission('escalations:manage'), validateUuidParam('id'), asyncHandler(ctrl.resolveEvent));

export { router as escalationsRouter };
