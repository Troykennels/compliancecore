import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  createVendorSchema,
  updateVendorSchema,
  listVendorsSchema,
  createVendorAssessmentSchema,
} from './vendors.schema';
import * as ctrl from './vendors.controller';

const router = Router();
router.use(authenticate(), resolveTenant);

router.get('/',                    requirePermission('vendors:read'),   validateQuery(listVendorsSchema), asyncHandler(ctrl.listVendors));
router.get('/:id',                 requirePermission('vendors:read'),   asyncHandler(ctrl.getVendor));
router.post('/',                   requirePermission('vendors:write'),  validate(createVendorSchema), asyncHandler(ctrl.createVendor));
router.patch('/:id',               requirePermission('vendors:write'),  validate(updateVendorSchema), asyncHandler(ctrl.updateVendor));
router.delete('/:id',              requirePermission('vendors:delete'), asyncHandler(ctrl.deleteVendor));

router.get('/:id/assessments',     requirePermission('vendors:read'),   asyncHandler(ctrl.listVendorAssessments));
router.post('/:id/assessments',    requirePermission('vendors:write'),  validate(createVendorAssessmentSchema), asyncHandler(ctrl.createVendorAssessment));

export default router;
