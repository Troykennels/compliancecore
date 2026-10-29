import { Router, type Request } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { ok } from '../../lib/response';
import { AppError } from '../../lib/errors';
import { privacyService, activitySchema, requestSchema, assessmentSchema, decisionSchema } from './privacy.service';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

const actor = (req: Request) => ({ id: req.user!.id, email: req.user!.email, role: req.user!.role ?? null });
const schema = (req: Request) => req.tenant!.schemaName;
router.param('id', (_req, _res, next, value) => z.string().uuid().safeParse(value).success ? next() : next(new AppError('Record not found.', 404)));

router.get('/summary', requirePermission('privacy:read'), asyncHandler(async (req, res) => ok(res, req, await privacyService.summary(schema(req)))));

router.get('/activities', requirePermission('privacy:read'), asyncHandler(async (req, res) => ok(res, req, await privacyService.listActivities(schema(req)))));
router.post('/activities', requirePermission('privacy:write'), validate(activitySchema), asyncHandler(async (req, res) => ok(res, req, await privacyService.saveActivity(schema(req), req.body, actor(req)), 201)));
router.put('/activities/:id', requirePermission('privacy:write'), validate(activitySchema), asyncHandler(async (req, res) => ok(res, req, await privacyService.saveActivity(schema(req), req.body, actor(req), req.params.id))));

router.get('/requests', requirePermission('privacy:read'), asyncHandler(async (req, res) => ok(res, req, await privacyService.listRequests(schema(req)))));
router.post('/requests', requirePermission('privacy:write'), validate(requestSchema), asyncHandler(async (req, res) => ok(res, req, await privacyService.saveRequest(schema(req), req.body, actor(req)), 201)));
router.put('/requests/:id', requirePermission('privacy:write'), validate(requestSchema), asyncHandler(async (req, res) => ok(res, req, await privacyService.saveRequest(schema(req), req.body, actor(req), req.params.id))));

router.get('/assessments', requirePermission('privacy:read'), asyncHandler(async (req, res) => ok(res, req, await privacyService.listAssessments(schema(req)))));
router.post('/assessments', requirePermission('privacy:write'), validate(assessmentSchema), asyncHandler(async (req, res) => ok(res, req, await privacyService.saveAssessment(schema(req), req.body, actor(req)), 201)));
router.put('/assessments/:id', requirePermission('privacy:write'), validate(assessmentSchema), asyncHandler(async (req, res) => ok(res, req, await privacyService.saveAssessment(schema(req), req.body, actor(req), req.params.id))));
router.post('/assessments/:id/decision', requirePermission('privacy:write'), validate(decisionSchema), asyncHandler(async (req, res) => ok(res, req, await privacyService.decideAssessment(schema(req), req.params.id, req.body, actor(req)))));

export default router;
