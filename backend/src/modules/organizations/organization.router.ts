import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission, requireRole } from '../../middleware/rbac.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { validate } from '../../middleware/validate.middleware';
import { makeRateLimiter } from '../../lib/rate-limit';
import { asyncHandler } from '../../lib/asyncHandler';
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

// ── Full data export ────────────────────────────────────────────────────────
// Owner and admin only: this returns every record the organisation holds, so it
// is the single most sensitive response the API produces. Roles that can
// otherwise read the same data one page at a time are deliberately excluded —
// a compliance_manager or auditor has no need to walk out with the lot in one
// file, and the export is precisely what an attacker with a stolen session
// would reach for first.
//
// resolveTenant is applied here specifically: the rest of this router works off
// req.user.tenantId against the global schema, but the export has to read the
// tenant's own schema.
router.get(
  '/export',
  requireRole('owner', 'admin'),
  resolveTenant,
  // Building the archive scans every table in the tenant schema. Without a cap,
  // repeatedly requesting it is a cheap way to load the database.
  makeRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anonymous',
    message: {
      data: null,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Export limit reached. You can download your data again in an hour.',
      },
    },
  }),
  asyncHandler(organizationController.exportAll),
);

// ── Compliance scoping questionnaire ────────────────────────────────────────
// GET is readable by anyone who can read the org, so the dashboard can surface
// "you have not scoped your programme yet". Saving is an org:write action.
router.get('/scoping', organizationController.getScoping);
router.post('/scoping', requirePermission('org:write'), organizationController.saveScoping);

export default router;
