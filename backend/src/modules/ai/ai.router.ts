import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './ai.controller';

const router = Router();
router.use(authenticate(), resolveTenant);

router.post('/summarize-contract', requirePermission('ai:use'), asyncHandler(ctrl.summarizeContract));
router.post('/generate-policy',    requirePermission('ai:use'), asyncHandler(ctrl.generatePolicy));
router.post('/analyze-risk',       requirePermission('ai:use'), asyncHandler(ctrl.analyzeRisk));
router.post('/generate-checklist', requirePermission('ai:use'), asyncHandler(ctrl.generateChecklist));
router.post('/document-qa',        requirePermission('ai:use'), asyncHandler(ctrl.documentQa));
router.post('/search',             requirePermission('ai:use'), asyncHandler(ctrl.aiSearch));

export { router as aiRouter };
