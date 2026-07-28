import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  createTrainingSchema,
  updateTrainingSchema,
  listTrainingsSchema,
  assignTrainingRecordsSchema,
} from './training.schema';
import * as ctrl from './training.controller';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

router.get('/',              requirePermission('training:read'),   validateQuery(listTrainingsSchema), asyncHandler(ctrl.listTrainings));
router.get('/:id',           requirePermission('training:read'),   asyncHandler(ctrl.getTraining));
router.post('/',             requirePermission('training:write'),  validate(createTrainingSchema), asyncHandler(ctrl.createTraining));
router.patch('/:id',         requirePermission('training:write'),  validate(updateTrainingSchema), asyncHandler(ctrl.updateTraining));
router.delete('/:id',        requirePermission('training:delete'), asyncHandler(ctrl.deleteTraining));

router.get('/:id/records',   requirePermission('training:read'),   asyncHandler(ctrl.listTrainingRecords));
router.post('/:id/records',  requirePermission('training:write'),  validate(assignTrainingRecordsSchema), asyncHandler(ctrl.assignTrainingRecords));

export default router;
