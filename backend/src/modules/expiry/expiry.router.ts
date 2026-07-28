import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { createExpiryItemSchema, updateExpiryItemSchema, listExpiryItemsSchema } from './expiry.schema';
import * as ctrl from './expiry.controller';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

router.get('/',        requirePermission('expiry:read'),  validateQuery(listExpiryItemsSchema), asyncHandler(ctrl.listExpiry));
router.get('/stats',   requirePermission('expiry:read'),  asyncHandler(ctrl.getExpiryStatusCounts));
router.get('/expiring-soon', requirePermission('expiry:read'), asyncHandler(ctrl.expiringSoon));
router.get('/:id',     requirePermission('expiry:read'),  asyncHandler(ctrl.getExpiryItem));
router.post('/',       requirePermission('expiry:write'), validate(createExpiryItemSchema), asyncHandler(ctrl.createExpiryItem));
router.patch('/:id',   requirePermission('expiry:write'), validate(updateExpiryItemSchema), asyncHandler(ctrl.updateExpiryItem));
router.delete('/:id',  requirePermission('expiry:write'), asyncHandler(ctrl.deleteExpiryItem));

export default router;
