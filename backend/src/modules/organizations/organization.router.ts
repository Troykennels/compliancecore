import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { organizationController } from './organization.controller';
import { updateOrganizationSchema, createOrganizationSchema } from './organization.schema';

const router = Router();

router.use(authenticate());

// POST /api/organizations — create the caller's first organization (onboarding).
// No tenant permission is required: the user does not belong to a tenant yet.
router.post('/', validate(createOrganizationSchema), organizationController.create);

// GET /api/organizations/profile
router.get('/profile', organizationController.getProfile);

// PATCH /api/organizations/profile
router.patch(
  '/profile',
  requirePermission('org:write'),
  validate(updateOrganizationSchema),
  organizationController.updateProfile,
);

// POST /api/organizations/onboarding/complete
router.post(
  '/onboarding/complete',
  requirePermission('org:write'),
  organizationController.completeOnboarding,
);

export default router;
