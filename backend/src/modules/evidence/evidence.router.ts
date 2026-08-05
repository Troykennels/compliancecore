import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement, enforceLimit } from '../../middleware/entitlement.middleware';
import { countEvidenceGb } from '../../lib/usage-counts';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { makeRateLimiter } from '../../lib/rate-limit';
import {
  initiateUploadSchema,
  confirmUploadSchema,
  updateEvidenceSchema,
  addVersionSchema,
  listEvidenceSchema,
  createTagSchema,
  addTagToEvidenceSchema,
  createCategorySchema,
  updateCategorySchema,
  addLinkSchema,
  createShareSchema,
  accessShareSchema,
} from './evidence.schema';
import * as ctrl from './evidence.controller';

const router = Router();

// All evidence routes require authentication + tenant resolution,
// except the public share access endpoint.

// ── Public share access ───────────────────────────────────────────────────────
// No authentication — anyone with the share token can access if valid.
// The `tenant` query param identifies which schema to query.
//
// This is the only unauthenticated route that reaches a tenant schema, and it
// had no throttle at all. A password-protected share could be attacked at any
// rate the attacker liked, and since share passwords may be as short as four
// characters, that is minutes of work for a presigned download of the evidence.
// Each attempt also costs a bcrypt compare and a tenant transaction, so the
// same endpoint was a cheap way to load the database from the open internet.
//
// Keyed on the share token, not the caller: a token under attack is throttled
// no matter how many addresses the attempts come from, and one share being
// hammered never blocks a different, legitimate recipient.
const shareAccessLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `share:${req.params.token ?? 'unknown'}`,
  message: {
    data: null,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many attempts for this link. Please try again later.',
    },
  },
});

router.post(
  '/shared/:token',
  shareAccessLimiter,
  validate(accessShareSchema),
  asyncHandler(ctrl.accessShare),
);

// ── All routes below require auth + tenant ────────────────────────────────────
router.use(authenticate(), resolveTenant, enforceEntitlement());

// ── Categories ────────────────────────────────────────────────────────────────
router.get('/categories',        asyncHandler(ctrl.listCategories));
router.post(
  '/categories',
  requirePermission('evidence:write'),
  validate(createCategorySchema),
  asyncHandler(ctrl.createCategory),
);
router.patch(
  '/categories/:id',
  requirePermission('evidence:write'),
  validate(updateCategorySchema),
  asyncHandler(ctrl.updateCategory),
);
router.delete(
  '/categories/:id',
  requirePermission('evidence:write'),
  asyncHandler(ctrl.deleteCategory),
);

// ── Tags ──────────────────────────────────────────────────────────────────────
router.get('/tags',        asyncHandler(ctrl.listTags));
router.post(
  '/tags',
  requirePermission('evidence:write'),
  validate(createTagSchema),
  asyncHandler(ctrl.createTag),
);
router.delete(
  '/tags/:id',
  requirePermission('evidence:write'),
  asyncHandler(ctrl.deleteTag),
);

// ── Evidence List & Upload Initiation ─────────────────────────────────────────
router.get(
  '/',
  requirePermission('evidence:read'),
  validateQuery(listEvidenceSchema),
  asyncHandler(ctrl.listEvidence),
);

// Storage is the other allowance the pricing page sells upgrades on, and it was
// displayed but never enforced — a 5 GB plan could store unbounded evidence, at
// our S3 cost. Checked here, at the point a presigned URL is issued, because
// after that the bytes land in S3 whether we like it or not.
router.post(
  '/upload',
  requirePermission('evidence:write'),
  enforceLimit('evidenceGb', countEvidenceGb),
  validate(initiateUploadSchema),
  asyncHandler(ctrl.initiateUpload),
);

// ── Per-Evidence routes ───────────────────────────────────────────────────────
router.get(
  '/:id',
  requirePermission('evidence:read'),
  asyncHandler(ctrl.getEvidence),
);

router.patch(
  '/:id',
  requirePermission('evidence:write'),
  validate(updateEvidenceSchema),
  asyncHandler(ctrl.updateEvidence),
);

router.delete(
  '/:id',
  requirePermission('evidence:delete'),
  asyncHandler(ctrl.deleteEvidence),
);

// Confirm upload after S3 direct upload completes
router.post(
  '/:id/versions/:versionId/confirm',
  requirePermission('evidence:write'),
  validate(confirmUploadSchema),
  asyncHandler(ctrl.confirmUpload),
);

// ── Versions ──────────────────────────────────────────────────────────────────
router.get(
  '/:id/versions',
  requirePermission('evidence:read'),
  asyncHandler(ctrl.listVersions),
);

router.post(
  '/:id/versions',
  requirePermission('evidence:write'),
  validate(addVersionSchema),
  asyncHandler(ctrl.initiateVersionUpload),
);

router.get(
  '/:id/versions/:versionId/download',
  requirePermission('evidence:read'),
  asyncHandler(ctrl.getVersionDownloadUrl),
);

// ── Preview & Download ────────────────────────────────────────────────────────
router.get(
  '/:id/preview',
  requirePermission('evidence:read'),
  asyncHandler(ctrl.getPreviewUrl),
);

router.get(
  '/:id/download',
  requirePermission('evidence:read'),
  asyncHandler(ctrl.getDownloadUrl),
);

// ── Tags on Evidence ──────────────────────────────────────────────────────────
router.post(
  '/:id/tags',
  requirePermission('evidence:write'),
  validate(addTagToEvidenceSchema),
  asyncHandler(ctrl.addTagToEvidence),
);

router.delete(
  '/:id/tags/:tagId',
  requirePermission('evidence:write'),
  asyncHandler(ctrl.removeTagFromEvidence),
);

// ── Links ─────────────────────────────────────────────────────────────────────
router.post(
  '/:id/links',
  requirePermission('evidence:write'),
  validate(addLinkSchema),
  asyncHandler(ctrl.addLink),
);

router.delete(
  '/:id/links/:linkedType/:linkedId',
  requirePermission('evidence:write'),
  asyncHandler(ctrl.removeLink),
);

// ── Sharing ───────────────────────────────────────────────────────────────────
router.get(
  '/:id/shares',
  requirePermission('evidence:share'),
  asyncHandler(ctrl.listShares),
);

router.post(
  '/:id/shares',
  requirePermission('evidence:share'),
  validate(createShareSchema),
  asyncHandler(ctrl.createShare),
);

router.delete(
  '/:id/shares/:shareId',
  requirePermission('evidence:share'),
  asyncHandler(ctrl.revokeShare),
);

// ── OCR ───────────────────────────────────────────────────────────────────────
router.get(
  '/:id/ocr',
  requirePermission('evidence:read'),
  asyncHandler(ctrl.getOcrText),
);

router.post(
  '/:id/ocr/retry',
  requirePermission('evidence:write'),
  asyncHandler(ctrl.retryOcr),
);

// ── Audit Trail ───────────────────────────────────────────────────────────────
router.get(
  '/:id/audit',
  requirePermission('evidence:read'),
  asyncHandler(ctrl.getAuditTrail),
);

export default router;
