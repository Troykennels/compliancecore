import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './signatures.controller';

const router = Router();
router.use(authenticate(), resolveTenant);

router.get('/',                          requirePermission('signatures:read'),   asyncHandler(ctrl.listSignatures));
router.post('/',                         requirePermission('signatures:create'), asyncHandler(ctrl.createSignature));
router.get('/document/:type/:id',        requirePermission('signatures:read'),   asyncHandler(ctrl.getDocumentSignatures));
router.get('/:id',                       requirePermission('signatures:read'),   asyncHandler(ctrl.getSignature));
router.post('/:id/verify',               requirePermission('signatures:read'),   asyncHandler(ctrl.verifySignature));
router.post('/:id/revoke',               requirePermission('signatures:manage'), asyncHandler(ctrl.revokeSignature));

export { router as signaturesRouter };
