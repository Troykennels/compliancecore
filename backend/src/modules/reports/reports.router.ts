import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validateUuidParam } from '../../middleware/validate-params.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './reports.controller';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

// Executive dashboard data
router.get('/dashboard',        requirePermission('reports:read'),  asyncHandler(ctrl.getExecutiveDashboard));

// Exports
router.get('/export/pdf',       requirePermission('reports:read'),  asyncHandler(ctrl.exportPdf));
router.get('/export/excel',     requirePermission('reports:read'),  asyncHandler(ctrl.exportExcel));

// Scheduled reports CRUD
router.get('/scheduled',        requirePermission('reports:read'),  asyncHandler(ctrl.listScheduledReports));
router.post('/scheduled',       requirePermission('reports:write'), asyncHandler(ctrl.createScheduledReport));
router.patch('/scheduled/:id',  requirePermission('reports:write'), validateUuidParam('id'), asyncHandler(ctrl.updateScheduledReport));
router.delete('/scheduled/:id', requirePermission('reports:write'), validateUuidParam('id'), asyncHandler(ctrl.deleteScheduledReport));

export { router as reportsRouter };
