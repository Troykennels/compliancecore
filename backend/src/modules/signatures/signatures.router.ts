import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './signatures.controller';
import { ValidationError } from '../../lib/errors';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

router.get('/',                          requirePermission('signatures:read'),   asyncHandler(ctrl.listSignatures));
router.post('/',                         requirePermission('signatures:create'), asyncHandler(ctrl.createSignature));
router.get('/document/:type/:id/preview', requirePermission('signatures:create'), (req, res, next) => {
  const modules: Record<string, string> = { policy: 'policies', control: 'controls', risk: 'risks', vendor: 'vendors', audit: 'audits', training: 'training', evidence: 'evidence' };
  const module = Object.hasOwn(modules, req.params.type) ? modules[req.params.type] : undefined;
  if (!module) return next(new ValidationError('Unsupported document type'));
  return requirePermission(`${module}:read`)(req, res, next);
}, asyncHandler(ctrl.previewDocument));
router.get('/document/:type/:id',        requirePermission('signatures:read'),   asyncHandler(ctrl.getDocumentSignatures));
router.get('/:id',                       requirePermission('signatures:read'),   asyncHandler(ctrl.getSignature));
router.post('/:id/verify',               requirePermission('signatures:read'),   asyncHandler(ctrl.verifySignature));
router.post('/:id/revoke',               requirePermission('signatures:manage'), asyncHandler(ctrl.revokeSignature));

export { router as signaturesRouter };
