import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { createCalendarEventSchema, updateCalendarEventSchema, listCalendarEventsSchema } from './calendar.schema';
import * as ctrl from './calendar.controller';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

router.get('/',          requirePermission('calendar:read'),  validateQuery(listCalendarEventsSchema), asyncHandler(ctrl.listEvents));
router.get('/upcoming',  requirePermission('calendar:read'),  asyncHandler(ctrl.getUpcoming));
router.get('/:id',       requirePermission('calendar:read'),  asyncHandler(ctrl.getEvent));
router.post('/',         requirePermission('calendar:write'), validate(createCalendarEventSchema), asyncHandler(ctrl.createEvent));
router.patch('/:id',     requirePermission('calendar:write'), validate(updateCalendarEventSchema), asyncHandler(ctrl.updateEvent));
router.delete('/:id',    requirePermission('calendar:write'), asyncHandler(ctrl.deleteEvent));

export default router;
