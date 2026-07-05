import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './ai.controller';

const router = Router();
router.use(authenticate(), resolveTenant);

// Every AI route hits the paid Groq API with up to ~60 KB of prompt. Without a
// cap, one authenticated user (any role with ai:use, incl. viewer) could drive
// unbounded spend or exhaust connections on a hung upstream. Limit per-user
// (falls back to IP for safety). Keyed on the JWT subject so it can't be evaded
// by rotating IPs.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anonymous',
  message: { data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'AI request limit reached. Please slow down and try again shortly.' } },
});

router.use(aiLimiter);

router.post('/summarize-contract', requirePermission('ai:use'), asyncHandler(ctrl.summarizeContract));
router.post('/generate-policy',    requirePermission('ai:use'), asyncHandler(ctrl.generatePolicy));
router.post('/analyze-risk',       requirePermission('ai:use'), asyncHandler(ctrl.analyzeRisk));
router.post('/generate-checklist', requirePermission('ai:use'), asyncHandler(ctrl.generateChecklist));
router.post('/document-qa',        requirePermission('ai:use'), asyncHandler(ctrl.documentQa));
router.post('/search',             requirePermission('ai:use'), asyncHandler(ctrl.aiSearch));

export { router as aiRouter };
