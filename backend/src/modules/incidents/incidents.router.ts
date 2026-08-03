import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  createIncidentSchema, updateIncidentSchema, listIncidentsSchema, addIncidentUpdateSchema,
} from './incidents.schema';
import * as ctrl from './incidents.controller';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

// Static path before /:id so "stats" is never parsed as an incident id.
router.get('/stats',       requirePermission('incidents:read'),  asyncHandler(ctrl.getIncidentStats));
router.get('/',            requirePermission('incidents:read'),  validateQuery(listIncidentsSchema), asyncHandler(ctrl.listIncidents));
router.post('/',           requirePermission('incidents:write'), validate(createIncidentSchema), asyncHandler(ctrl.createIncident));
router.get('/:id',         requirePermission('incidents:read'),  asyncHandler(ctrl.getIncident));
router.patch('/:id',       requirePermission('incidents:write'), validate(updateIncidentSchema), asyncHandler(ctrl.updateIncident));
router.delete('/:id',      requirePermission('incidents:write'), asyncHandler(ctrl.deleteIncident));

router.get('/:id/updates',  requirePermission('incidents:read'),  asyncHandler(ctrl.listIncidentUpdates));
router.post('/:id/updates', requirePermission('incidents:write'), validate(addIncidentUpdateSchema), asyncHandler(ctrl.addIncidentUpdate));

export default router;
