import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement, enforceLimit } from '../../middleware/entitlement.middleware';
import { countDepartments } from '../../lib/usage-counts';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { departmentsController } from './departments.controller';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentsSchema,
} from './departments.schema';

const router = Router();

router.use(authenticate(), resolveTenant, enforceEntitlement());

// GET /api/departments  — ?tree=true for hierarchy view
router.get(
  '/',
  validateQuery(listDepartmentsSchema),
  departmentsController.list,
);

// GET /api/departments/:id
router.get('/:id', departmentsController.getById);

// POST /api/departments
router.post(
  '/',
  requirePermission('org:write'),
  enforceLimit('departments', countDepartments),
  validate(createDepartmentSchema),
  departmentsController.create,
);

// PATCH /api/departments/:id
router.patch(
  '/:id',
  requirePermission('org:write'),
  validate(updateDepartmentSchema),
  departmentsController.update,
);

// DELETE /api/departments/:id
router.delete(
  '/:id',
  requirePermission('org:write'),
  departmentsController.delete,
);

export default router;
