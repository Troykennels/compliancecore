import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './approvals.controller';

const router = Router();
router.use(authenticate(), resolveTenant);

// Workflow templates
router.get('/workflows',           requirePermission('approvals:read'),   asyncHandler(ctrl.listWorkflows));
router.post('/workflows',          requirePermission('approvals:manage'),  asyncHandler(ctrl.createWorkflow));
router.get('/workflows/:id',       requirePermission('approvals:read'),   asyncHandler(ctrl.getWorkflow));
router.patch('/workflows/:id',     requirePermission('approvals:manage'),  asyncHandler(ctrl.updateWorkflow));
router.delete('/workflows/:id',    requirePermission('approvals:manage'),  asyncHandler(ctrl.deleteWorkflow));

// Approval requests
router.get('/requests/my-pending', requirePermission('approvals:read'),   asyncHandler(ctrl.getMyPending));
router.get('/requests',            requirePermission('approvals:read'),   asyncHandler(ctrl.listRequests));
router.post('/requests',           requirePermission('approvals:write'),  asyncHandler(ctrl.createRequest));
router.get('/requests/:id',        requirePermission('approvals:read'),   asyncHandler(ctrl.getRequest));
router.post('/requests/:id/decide',requirePermission('approvals:decide'), asyncHandler(ctrl.decideRequest));
router.post('/requests/:id/cancel',requirePermission('approvals:write'),  asyncHandler(ctrl.cancelRequest));

export { router as approvalsRouter };
