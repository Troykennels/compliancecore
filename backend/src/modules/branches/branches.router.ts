import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { branchesController } from './branches.controller';
import {
  createBranchSchema,
  updateBranchSchema,
  listBranchesSchema,
} from './branches.schema';

const router = Router();

router.use(authenticate(), resolveTenant, enforceEntitlement());

// GET /api/branches
router.get(
  '/',
  validateQuery(listBranchesSchema),
  branchesController.list,
);

// GET /api/branches/:id
router.get('/:id', branchesController.getById);

// POST /api/branches
router.post(
  '/',
  requirePermission('org:write'),
  validate(createBranchSchema),
  branchesController.create,
);

// PATCH /api/branches/:id
router.patch(
  '/:id',
  requirePermission('org:write'),
  validate(updateBranchSchema),
  branchesController.update,
);

// DELETE /api/branches/:id
router.delete(
  '/:id',
  requirePermission('org:write'),
  branchesController.delete,
);

export default router;
