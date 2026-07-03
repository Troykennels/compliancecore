import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
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
router.post(
  '/shared/:token',
  validate(accessShareSchema),
  asyncHandler(ctrl.accessShare),
);

// ── All routes below require auth + tenant ────────────────────────────────────
router.use(authenticate(), resolveTenant);

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

router.post(
  '/upload',
  requirePermission('evidence:write'),
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
